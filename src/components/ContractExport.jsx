import React, { useState } from 'react';
import { Button, Layer, Tag, Tile } from '@carbon/react';
import { Checkmark, Download, Renew, View } from '@carbon/icons-react';
import { useBuildStore } from '../store/buildStore';
import buildService from '../services/buildService';
import exportService from '../services/exportService';
import verificationService from '../services/verificationService';
import { BUILD_STATUS, BUILD_STATUS_CONFIG } from '../utils/constants';
import { getContractContent } from '../utils/contractContent';
import {
  CompletionNotice,
  ContractMetadata,
  ContractPreview,
  useCompletionOperation,
} from './ContractCompletion';

function ContractExportForm({ buildId, buildStatus, onStatusUpdate }) {
  const [exportData, setExportData] = useState(null);
  const [content, setContent] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [verification, setVerification] = useState(null);
  const { active, operation, begin, end } = useCompletionOperation();
  const downloaded =
    acknowledged || buildStatus === BUILD_STATUS.CONTRACT_DOWNLOADED;
  const ready = buildStatus === BUILD_STATUS.FINALIZED && !downloaded;
  const busy = !!operation;

  async function loadContract() {
    if (!ready || saved || !begin('load')) return;
    setError(null);
    setCancelled(false);
    try {
      const data = await exportService.exportContract(buildId);
      const yaml = getContractContent(data);
      if (!data.contract_hash)
        throw new Error(
          'The server did not return a contract hash. Try loading it again.',
        );
      if (!active.current) return;
      setExportData(data);
      setContent(yaml);
    } catch (err) {
      if (!active.current) return;
      // Another operator may have acknowledged this build while this tab was open.
      const build = await buildService.getBuild(buildId).catch(() => null);
      if (!active.current) return;
      if (build?.status === BUILD_STATUS.CONTRACT_DOWNLOADED) {
        setAcknowledged(true);
        onStatusUpdate?.(BUILD_STATUS.CONTRACT_DOWNLOADED);
      } else
        setError({
          title: 'Contract could not be loaded',
          message: err.message,
        });
    } finally {
      end();
    }
  }

  async function acknowledge(receipt) {
    try {
      await exportService.acknowledgeDownload(buildId, receipt.hash);
    } catch (err) {
      // A lost response does not mean the acknowledgement was rejected.
      const build = await buildService.getBuild(buildId).catch(() => null);
      if (build?.status !== BUILD_STATUS.CONTRACT_DOWNLOADED) throw err;
    }
    useBuildStore
      .getState()
      .updateBuildStatus(buildId, BUILD_STATUS.CONTRACT_DOWNLOADED);
    if (!active.current) return;
    setAcknowledged(true);
    setPreviewOpen(false);
    onStatusUpdate?.(BUILD_STATUS.CONTRACT_DOWNLOADED);
  }

  async function saveAndAcknowledge() {
    if (!ready || !exportData || !content || !begin('save')) return;
    setError(null);
    setCancelled(false);
    let receipt = saved;
    try {
      if (!receipt) {
        const result = await exportService.saveContractLocally(
          buildId,
          content,
          `contract-${buildId}.yaml`,
        );
        receipt = { path: result.path, hash: exportData.contract_hash };
        if (active.current) setSaved(receipt);
      }
      // A retry sends only the acknowledgement; it never saves a second file.
      await acknowledge(receipt);
    } catch (err) {
      if (!active.current) return;
      setPreviewOpen(false);
      if (err.code === 'SAVE_CANCELLED') setCancelled(true);
      else
        setError({
          title: receipt
            ? 'File saved — acknowledgement pending'
            : 'Contract could not be saved',
          message: receipt
            ? `Saved to ${receipt.path}. ${err.message} Retry the acknowledgement to finish this build.`
            : err.message,
        });
    } finally {
      end();
    }
  }

  async function verify() {
    if ((!ready && !downloaded) || !begin('verify')) return;
    setError(null);
    setVerification(null);
    try {
      const result = await verificationService.verifyContractIntegrity(buildId);
      if (active.current) setVerification(result);
    } catch (err) {
      if (active.current)
        setError({ title: 'Verification unavailable', message: err.message });
    } finally {
      end();
    }
  }

  return (
    <section
      className="contract-completion"
      aria-labelledby="export-contract-heading"
    >
      <header className="contract-completion__header">
        <div>
          <h2 id="export-contract-heading">Export contract</h2>
          <p>
            Review the signed contract, save a local copy, and acknowledge the
            download.
          </p>
        </div>
        <Tag
          type={downloaded ? 'green' : saved ? 'blue' : ready ? 'teal' : 'gray'}
        >
          {downloaded
            ? 'Downloaded'
            : saved
              ? 'Acknowledgement pending'
              : ready
                ? 'Ready to export'
                : 'Waiting for finalisation'}
        </Tag>
      </header>
      {error && (
        <CompletionNotice title={error.title}>{error.message}</CompletionNotice>
      )}
      {cancelled && (
        <CompletionNotice kind="info" title="Save cancelled">
          No file was saved and no acknowledgement was sent. You can try again.
        </CompletionNotice>
      )}
      {!ready && !downloaded && (
        <CompletionNotice
          kind="info"
          title={
            buildStatus === BUILD_STATUS.CANCELLED
              ? 'Build cancelled'
              : 'Finalise the contract first'
          }
        >
          {buildStatus === BUILD_STATUS.CANCELLED
            ? 'A cancelled build cannot be exported.'
            : `The assigned auditor must finalise this build before it can be exported. Current stage: ${BUILD_STATUS_CONFIG[buildStatus]?.label || 'Unknown'}.`}
        </CompletionNotice>
      )}

      <Layer>
        <Tile className="contract-completion__card">
          <h3>
            {downloaded
              ? 'Download acknowledged'
              : saved
                ? 'File saved'
                : 'Review and download'}
          </h3>
          <p>
            {downloaded
              ? 'The contract download has been acknowledged. Another download is unavailable for this build.'
              : saved
                ? 'The contract was saved locally. Retry its signed acknowledgement to complete this build.'
                : 'Load the final contract to inspect its contents before saving. Loading and previewing do not acknowledge a download.'}
          </p>
          {saved && (
            <p className="contract-completion__path">Saved to {saved.path}</p>
          )}
          {exportData && (
            <ContractMetadata data={exportData} content={content} />
          )}
          {!downloaded && (
            <div className="contract-completion__actions">
              {saved ? (
                <Button
                  renderIcon={Renew}
                  onClick={saveAndAcknowledge}
                  disabled={!ready || busy}
                >
                  {operation === 'save'
                    ? 'Sending acknowledgement…'
                    : 'Retry acknowledgement'}
                </Button>
              ) : exportData ? (
                <>
                  <Button
                    renderIcon={Download}
                    onClick={saveAndAcknowledge}
                    disabled={!ready || busy}
                  >
                    {operation === 'save'
                      ? 'Saving contract…'
                      : 'Save and acknowledge'}
                  </Button>
                  <Button
                    kind="tertiary"
                    renderIcon={View}
                    onClick={() => setPreviewOpen(true)}
                    disabled={!ready || busy}
                  >
                    Preview contract
                  </Button>
                </>
              ) : (
                <Button
                  renderIcon={Download}
                  onClick={loadContract}
                  disabled={!ready || busy}
                >
                  {operation === 'load' ? 'Loading contract…' : 'Load contract'}
                </Button>
              )}
            </div>
          )}
        </Tile>
      </Layer>

      <Layer>
        <Tile className="contract-completion__card">
          <div className="contract-completion__card-heading">
            <h3>Contract integrity</h3>
            {verification && (
              <Tag type={verification.valid ? 'green' : 'red'}>
                {verification.valid ? 'Verified' : 'Check failed'}
              </Tag>
            )}
          </div>
          <p>
            Check the contract hash and section integrity against the server
            records. Verification does not save or download the contract.
          </p>
          {verification && (
            <CompletionNotice
              kind={verification.valid ? 'success' : 'error'}
              title={
                verification.valid
                  ? 'Integrity checks passed'
                  : 'Integrity checks failed'
              }
            >
              {verification.valid
                ? 'The server reports that the contract and its sections are intact.'
                : verification.errors?.join(' ') ||
                  verification.details ||
                  'The contract did not pass integrity checks. Contact the build auditor before using it.'}
            </CompletionNotice>
          )}
          <div className="contract-completion__actions">
            <Button
              kind="tertiary"
              renderIcon={Checkmark}
              onClick={verify}
              disabled={(!ready && !downloaded) || busy}
            >
              {operation === 'verify'
                ? 'Verifying contract…'
                : verification
                  ? 'Verify again'
                  : 'Verify integrity'}
            </Button>
          </div>
        </Tile>
      </Layer>
      <ContractPreview
        open={previewOpen}
        content={content}
        buildId={buildId}
        onClose={() => {
          if (!busy) setPreviewOpen(false);
        }}
        download={ready && !saved ? saveAndAcknowledge : undefined}
        busy={operation === 'save'}
      />
    </section>
  );
}

export default function ContractExport(props) {
  return <ContractExportForm key={props.buildId} {...props} />;
}
