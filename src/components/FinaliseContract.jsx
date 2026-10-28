import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  InlineLoading,
  Layer,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react';
import { Checkmark, Renew, View } from '@carbon/icons-react';
import buildService from '../services/buildService';
import { BUILD_STATUS, BUILD_STATUS_CONFIG } from '../utils/constants';
import { getContractContent } from '../utils/contractContent';
import {
  CompletionNotice,
  ContractMetadata,
  ContractPreview,
  useCompletionOperation,
} from './ContractCompletion';

function FinaliseContractForm({ buildId, buildStatus, onStatusUpdate }) {
  const [status, setStatus] = useState(buildStatus || '');
  const [details, setDetails] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [preview, setPreview] = useState(null);
  const { active, operation, begin, end } = useCompletionOperation();
  const statusCallback = useRef(onStatusUpdate);
  statusCallback.current = onStatusUpdate;

  const complete =
    accepted ||
    status === BUILD_STATUS.FINALIZED ||
    status === BUILD_STATUS.CONTRACT_DOWNLOADED;
  const ready = status === BUILD_STATUS.ATTESTATION_KEY_REGISTERED && !complete;
  const busy = !!operation;

  useEffect(() => {
    setStatus(buildStatus || '');
  }, [buildStatus]);

  useEffect(() => {
    let current = true;
    buildService
      .getBuild(buildId)
      .then((build) => {
        if (!current) return;
        setStatus(build.status);
        setDetails(build);
        statusCallback.current?.(build.status);
      })
      .catch((err) => {
        if (current) setStatusError(err.message);
      })
      .finally(() => {
        if (current) setLoadingStatus(false);
      });
    return () => {
      current = false;
    };
  }, [buildId]);

  async function retryStatus() {
    if (!begin('status')) return;
    setStatusError('');
    setLoadingStatus(true);
    try {
      const build = await buildService.getBuild(buildId);
      if (!active.current) return;
      setStatus(build.status);
      setDetails(build);
      statusCallback.current?.(build.status);
    } catch (err) {
      if (active.current) setStatusError(err.message);
    } finally {
      if (active.current) setLoadingStatus(false);
      end();
    }
  }

  async function finalise(event) {
    event.preventDefault();
    if (!ready || loadingStatus || statusError || busy) return;
    if (!passphrase) {
      setInvalid(true);
      return;
    }
    if (!begin('finalise')) return;
    setError('');
    try {
      const result = await buildService.finalizeBuildV2(buildId, {
        signing_key_passphrase: passphrase,
      });
      if (!active.current) return;
      setAccepted(true);
      setStatus(BUILD_STATUS.FINALIZED);
      setPassphrase('');
      setDetails(result || {});
      statusCallback.current?.(BUILD_STATUS.FINALIZED);
    } catch (err) {
      if (active.current) setError(err.message);
    } finally {
      end();
    }
  }

  async function openPreview() {
    if (!complete || !begin('preview')) return;
    setError('');
    try {
      // The build read endpoint includes YAML for assigned auditors; userdata is operator-only.
      const data = await buildService.getBuild(buildId);
      const content = getContractContent(data);
      if (!active.current) return;
      setDetails((previous) => ({ ...previous, ...data }));
      setPreview(content);
    } catch (err) {
      if (active.current) setError(err.message);
    } finally {
      end();
    }
  }

  return (
    <section
      className="contract-completion"
      aria-labelledby="finalise-contract-heading"
    >
      <header className="contract-completion__header">
        <div>
          <h2 id="finalise-contract-heading">Finalise contract</h2>
          <p>
            Assemble and sign the workload and environment into a deployment
            contract.
          </p>
        </div>
        <Tag type={complete ? 'green' : ready ? 'teal' : 'gray'}>
          {complete
            ? 'Finalised'
            : ready
              ? 'Ready to finalise'
              : 'Waiting for prerequisites'}
        </Tag>
      </header>
      {loadingStatus && <InlineLoading description="Checking build status…" />}
      {statusError && (
        <>
          <CompletionNotice title="Build status unavailable">
            {statusError}
          </CompletionNotice>
          <Button
            kind="ghost"
            renderIcon={Renew}
            disabled={busy}
            onClick={retryStatus}
          >
            Retry status check
          </Button>
        </>
      )}
      {error && (
        <CompletionNotice
          title={
            complete
              ? 'Contract preview unavailable'
              : 'Contract could not be finalised'
          }
        >
          {error}
        </CompletionNotice>
      )}
      {complete ? (
        <Layer>
          <Tile className="contract-completion__card">
            <h3>Contract signed and ready</h3>
            <p>
              The assigned environment operator can now save the contract and
              acknowledge its download.
            </p>
            <ContractMetadata data={details} />
            <div className="contract-completion__actions">
              <Button
                kind="tertiary"
                renderIcon={View}
                onClick={openPreview}
                disabled={busy || loadingStatus}
              >
                {operation === 'preview'
                  ? 'Loading preview…'
                  : 'Preview contract'}
              </Button>
            </div>
          </Tile>
        </Layer>
      ) : (
        <>
          {!loadingStatus && !statusError && !ready && (
            <CompletionNotice
              kind="info"
              title={
                status === BUILD_STATUS.CANCELLED
                  ? 'Build cancelled'
                  : 'Complete the earlier build stages'
              }
            >
              {status === BUILD_STATUS.CANCELLED
                ? 'A cancelled build cannot be finalised.'
                : `Register the signing key, submit the workload and environment, then add the attestation key. Current stage: ${BUILD_STATUS_CONFIG[status]?.label || 'Unknown'}.`}
            </CompletionNotice>
          )}
          <Layer>
            <Tile className="contract-completion__card">
              <h3>Sign the contract</h3>
              <p>
                The latest signing and attestation keys registered for this
                build will be used.
              </p>
              <form onSubmit={finalise}>
                <fieldset
                  disabled={!ready || loadingStatus || !!statusError || busy}
                  className="contract-completion__fieldset"
                >
                  <TextInput
                    id="finalise-passphrase"
                    type="password"
                    labelText="Signing key passphrase"
                    value={passphrase}
                    onChange={(event) => {
                      setPassphrase(event.target.value);
                      setInvalid(false);
                    }}
                    invalid={invalid}
                    invalidText="Enter the signing key passphrase."
                    autoComplete="off"
                    helperText="Use the passphrase set when the signing key was registered. It is cleared after finalisation."
                  />
                  <div className="contract-completion__actions">
                    <Button type="submit" renderIcon={Checkmark}>
                      {operation === 'finalise'
                        ? 'Finalising contract…'
                        : 'Finalise contract'}
                    </Button>
                  </div>
                </fieldset>
              </form>
            </Tile>
          </Layer>
        </>
      )}
      <ContractPreview
        open={preview !== null}
        content={preview || ''}
        buildId={buildId}
        onClose={() => setPreview(null)}
      />
    </section>
  );
}

export default function FinaliseContract(props) {
  return <FinaliseContractForm key={props.buildId} {...props} />;
}
