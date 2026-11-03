import React, { useEffect, useRef, useState } from 'react';
import { CodeSnippet, InlineNotification, Modal } from '@carbon/react';
import { formatDate } from '../utils/formatters';
import { getContractSize } from '../utils/contractContent';

/** One operation at a time; ignore results after leaving or switching builds. */
export function useCompletionOperation() {
  const active = useRef(false);
  const lock = useRef(false);
  const [operation, setOperation] = useState('');
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return {
    active,
    operation,
    begin(name) {
      if (lock.current || !active.current) return false;
      lock.current = true;
      setOperation(name);
      return true;
    },
    end() {
      lock.current = false;
      if (active.current) setOperation('');
    },
  };
}

export function CompletionNotice({ kind = 'error', title, children }) {
  return (
    <InlineNotification
      kind={kind}
      title={title}
      subtitle={children}
      lowContrast
      hideCloseButton
      className="contract-completion__notice"
    />
  );
}

export function ContractMetadata({ data, content }) {
  return (
    <dl className="contract-completion__metadata">
      {content && (
        <div>
          <dt>Contract size</dt>
          <dd>{getContractSize(content)}</dd>
        </div>
      )}
      {Array.isArray(data?.sections) && (
        <div>
          <dt>Included sections</dt>
          <dd>{data.sections.length}</dd>
        </div>
      )}
      {(data?.finalized_at || data?.exported_at) && (
        <div>
          <dt>{data.finalized_at ? 'Finalised' : 'Exported'}</dt>
          <dd>{formatDate(data.finalized_at || data.exported_at)}</dd>
        </div>
      )}
      {data?.contract_hash && (
        <div className="contract-completion__hash">
          <dt>Contract hash</dt>
          <dd>
            <CodeSnippet
              type="single"
              wrapText
              copyButtonDescription="Copy contract hash"
            >
              {data.contract_hash}
            </CodeSnippet>
          </dd>
        </div>
      )}
    </dl>
  );
}

export function ContractPreview({
  open,
  onClose,
  content,
  buildId,
  download,
  busy,
}) {
  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      onRequestSubmit={download}
      modalHeading="Contract preview"
      modalLabel="Signed contract YAML"
      size="lg"
      className="contract-completion-preview"
      passiveModal={!download}
      primaryButtonText="Save and acknowledge"
      secondaryButtonText="Close"
      loadingStatus={busy ? 'active' : 'inactive'}
      loadingDescription="Saving contract…"
      primaryButtonDisabled={!content || !!busy}
      preventCloseOnClickOutside={!!busy}
    >
      <p className="contract-completion-preview__copy">
        {download
          ? 'Choose where to save the contract. A signed acknowledgement is sent after the file is saved.'
          : 'Review the signed contract. The assigned environment operator can save and acknowledge it in Export contract.'}
      </p>
      <p className="contract-completion-preview__id">Build ID: {buildId}</p>
      <CodeSnippet
        type="multi"
        wrapText
        copyButtonDescription="Copy contract YAML"
        minCollapsedNumberOfRows={14}
        maxCollapsedNumberOfRows={20}
      >
        {content}
      </CodeSnippet>
    </Modal>
  );
}
