// Copyright (c) 2026 IBM Corp.
// All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  CodeSnippet,
  DataTableSkeleton,
  InlineNotification,
  Modal,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tooltip,
} from '@carbon/react';
import { Add, Checkmark, Information, Renew, TrashCan } from '@carbon/icons-react';
import secretStoreService from '../services/secretStoreService';
import SecretVersionPicker from './SecretVersionPicker';
import SecretGroupSourcePicker from './SecretGroupSourcePicker';
import { SecretError } from './SecretStoreForms';
import { useToast } from './ToastManager';
import '../styles/secret-store.scss';
import { prepareSecretBindings } from '../utils/secretFlow';
import { formatDate } from '../utils/formatters';

const emptyRequirement = () => ({ name: '', consumer: '', kind: 'retrievable', type: 'plain' });
const kinds = ['plain', 'aes', 'aes-xts', 'hmac-sha', 'ec', 'association'];
export default function BuildSecretFlow({ buildId, buildStatus }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const { showSuccess } = useToast();
  const refresh = useCallback(async () => {
    try {
      setData(await secretStoreService.flow(buildId));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [buildId]);
  useEffect(() => {
    let active = true;
    setData(null);
    secretStoreService
      .flow(buildId)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [buildId, buildStatus]);
  const save = async (operation, payload) => {
    const next = await secretStoreService[operation](buildId, {
      expected_revision: data.revision,
      ...payload,
    });
    setData(next);
    setError(null);
    setModal(null);
    const messages = {
      target: ['Deployment target saved', 'The Auditor can now review this target revision.'],
      requirements: [
        'Requirements saved',
        'Owners can now approve their matching secret versions.',
      ],
      approveTarget: [
        'Deployment target approved',
        'The worker verified the public artifacts for request preparation.',
      ],
      approveSources: [
        'Your versions approved',
        'Your signed approval binds these versions to the target and consumers.',
      ],
      prepare: [
        'Encrypted requests ready',
        'The published UV IDs can now be used by the workload.',
      ],
    };
    showSuccess(...messages[operation]);
  };
  const prepare = async () => {
    setBusy(true);
    setError(null);
    try {
      await save('prepare', {});
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const requirements = data?.requirements || [];
  return (
    <section className="secret-store secret-flow" aria-label="Build secret flow">
      <div className="secret-store__section-heading">
        <div>
          <h2>Runtime secrets</h2>
          <p>Prepare secrets before adding workload and environment YAML.</p>
        </div>
        <Button kind="ghost" renderIcon={Renew} disabled={busy} onClick={refresh}>
          Refresh
        </Button>
      </div>
      <SecretError error={error} />
      {!data ? (
        <DataTableSkeleton columnCount={4} rowCount={4} showHeader={false} showToolbar={false} />
      ) : (
        <>
          {data.target?.mode === 'SIMULATION' && (
            <InlineNotification
              kind="warning"
              hideCloseButton
              lowContrast
              title="Development simulation"
              subtitle="Real encrypted requests; no hardware Add/Retrieve verification. This profile must not be used for production deployment."
            />
          )}
          {data.preparation_error && (
            <InlineNotification
              kind="warning"
              hideCloseButton
              title="Approval needs attention"
              subtitle={data.preparation_error}
            />
          )}
          {!data.target && data.can_contribute && data.own_sources?.length > 0 && (
            <div>
              <InlineNotification
                kind="warning"
                hideCloseButton
                title="Unprepared legacy sources"
                subtitle="Select a target and map these versions to requirements, or remove your old references before continuing without secrets."
              />
              <Button
                kind="tertiary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await secretStoreService.setBuildSources(buildId, {
                      expected_revision: data.source_revision,
                      sources: [],
                    });
                    await refresh();
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Remove my old references
              </Button>
            </div>
          )}
          <div className="secret-flow__steps">
            <section className="secret-flow__step">
              <div className="secret-flow__heading">
                <h3>1. Deployment target</h3>
                <Tag type={data.target_approved ? 'green' : 'cool-gray'}>
                  {data.target_approved ? 'Auditor approved' : 'Environment Operator'}
                </Tag>
              </div>
              {data.target ? (
                <>
                  <p>
                    {data.target.name} · CCRV {data.target.runtime_version}
                  </p>
                  <dl className="secret-flow__metadata">
                    <dt>Runtime image</dt>
                    <dd>{data.target.image_source}</dd>
                    <dt>Image SHA-256</dt>
                    <dd>{data.target.image_digest}</dd>
                    <dt>SE-header SHA-256</dt>
                    <dd>{data.target.header_sha256}</dd>
                    <dt>Permitted hosts</dt>
                    <dd>{data.target.hosts.map((h) => h.id).join(', ')}</dd>
                  </dl>
                  <p className="secret-store__helper">
                    Hardware acceptance:{' '}
                    {data.target_evidence?.hardware_status === 'NOT_TESTED_ON_TARGET'
                      ? 'Not tested on target'
                      : 'Not verified'}
                    . The Manager host is not used as the deployment target.
                  </p>
                </>
              ) : (
                <p>
                  Select the protected runtime image, its SE header, permitted target-machine HKDs
                  and runtime encryption certificate.
                </p>
              )}
              <div className="secret-store__actions">
                {data.can_target && (
                  <Button kind="tertiary" onClick={() => setModal('target')}>
                    {data.target ? 'Change target' : 'Select target'}
                  </Button>
                )}
                {data.can_approve_target && data.target && (
                  <Button kind="tertiary" renderIcon={Checkmark} onClick={() => setModal('review')}>
                    Review target
                  </Button>
                )}
              </div>
            </section>
            <section className="secret-flow__step">
              <div className="secret-flow__heading">
                <h3>2. Requirements and owner approvals</h3>
                <Tag type="cool-gray">{requirements.length} / 8</Tag>
              </div>
              <TableContainer>
                <Table size="md" aria-label="Runtime secret requirements">
                  <TableHead>
                    <TableRow>
                      <TableHeader>Logical name</TableHeader>
                      <TableHeader>Consumer</TableHeader>
                      <TableHeader>Type</TableHeader>
                      <TableHeader>Owner approval</TableHeader>
                      <TableHeader>Approved by</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requirements.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.consumer}</TableCell>
                        <TableCell>{r.kind === 'association' ? 'Association' : r.type}</TableCell>
                        <TableCell>
                          {data.approval_states?.[r.name] === 'APPROVED' ? 'Approved' : 'Pending'}
                        </TableCell>
                        <TableCell>
                          {data.approval_details?.[r.name] ? (
                            <div className="secret-flow__approver">
                              <span title={data.approval_details[r.name].approved_by.id}>
                                {data.approval_details[r.name].approved_by.name || data.approval_details[r.name].approved_by.id}
                              </span>
                              <time dateTime={data.approval_details[r.name].approved_at}>
                                {formatDate(data.approval_details[r.name].approved_at)}
                              </time>
                            </div>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!requirements.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          No runtime secrets requested. Builds without secret sources can continue
                          normally.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {data.own_sources?.length > 0 && (
                <p className="secret-store__helper">
                  Your pinned sources:{' '}
                  {data.own_sources.map((s) => `${s.alias} (version ${s.version})`).join(', ')}.
                </p>
              )}
              <p className="secret-store__helper">
                Only owners select their own encrypted versions. Other contributors see logical
                requirements, never private aliases or stored values.
              </p>
              <div className="secret-store__actions">
                {data.can_requirements && (
                  <Button kind="tertiary" onClick={() => setModal('requirements')}>
                    Edit requirements
                  </Button>
                )}
                {data.can_contribute && data.target && (
                  <Button kind="tertiary" onClick={() => setModal('sources')}>
                    Approve my secrets
                  </Button>
                )}
              </div>
            </section>
            <section className="secret-flow__step">
              <div className="secret-flow__heading">
                <h3>3. Prepare encrypted requests</h3>
                <Tag type={data.prepared ? 'green' : 'cool-gray'}>
                  {data.frozen ? 'Frozen with workload' : data.prepared ? 'Prepared' : 'Auditor'}
                </Tag>
              </div>
              <p>
                The trusted worker checks the signed approvals and creates requests with pvsecret.
                Workload submission freezes this manifest.
              </p>
              {data.can_prepare && (
                <Button
                  disabled={
                    busy ||
                    !data.target_approved ||
                    !requirements.length ||
                    requirements.some((r) => data.approval_states?.[r.name] !== 'APPROVED')
                  }
                  onClick={prepare}
                >
                  {busy
                    ? 'Preparing requests…'
                    : data.prepared
                      ? 'Verify prepared requests'
                      : 'Prepare requests'}
                </Button>
              )}
              {data.prepared && (
                <div className="secret-flow__ids">
                  <h4>UV IDs for workload consumers</h4>
                  <p className="secret-store__helper">
                    The Environment section receives these public references as *_SECRET_ID
                    variables, together with the encrypted requests. IDs identify secrets; they
                    do not grant access or contain secret values.
                  </p>
                  {data.artifacts.map((a) => (
                    <div key={a.name}>
                      <p>
                        {a.name} · {a.consumer} · {a.kind}
                      </p>
                      <CodeSnippet type="single" feedback="Copied">
                        {a.secret_id}
                      </CodeSnippet>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          {modal === 'target' && (
            <TargetModal
              current={data.target}
              onClose={() => setModal(null)}
              onSave={(payload) => save('target', payload)}
            />
          )}
          {modal === 'requirements' && (
            <RequirementsModal
              initial={requirements}
              onClose={() => setModal(null)}
              onSave={(requirements) => save('requirements', { requirements })}
            />
          )}
          {modal === 'sources' && (
            <ApprovalModal
              data={data}
              onClose={() => setModal(null)}
              onSave={(sources) =>
                save('approveSources', {
                  sources,
                  source_revision: data.source_revision,
                  target_revision_id: data.target_revision_id,
                  target_digest: data.target_digest,
                })
              }
            />
          )}
          {modal === 'review' && (
            <ReviewModal
              target={data.target}
              fingerprints={data.artifact_fingerprints}
              onClose={() => setModal(null)}
              onSave={() =>
                save('approveTarget', {
                  target_revision_id: data.target_revision_id,
                  target_digest: data.target_digest,
                  header_provenance_confirmed: true,
                })
              }
            />
          )}
        </>
      )}
    </section>
  );
}

function FlowModal({ heading, label, onClose, onSave, disabled, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      size="lg"
      modalHeading={heading}
      primaryButtonText={busy ? 'Working…' : label}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={busy || disabled}
      loadingStatus={busy ? 'active' : 'inactive'}
      loadingDescription="Working…"
      preventCloseOnClickOutside
      onRequestClose={(event) => {
        // A hovered tooltip can be open while keyboard focus remains in another field.
        // Let Carbon dismiss that hint before Escape closes the surrounding modal.
        if (
          event?.key === 'Escape' &&
          event.target?.closest?.('[role="dialog"]')?.querySelector(
            '[role="tooltip"][aria-hidden="false"]'
          )
        ) return;
        if (!busy) onClose();
      }}
      onRequestSubmit={submit}
    >
      <fieldset className="secret-flow__fieldset" disabled={busy}>
        <div className="secret-store__form">
          <SecretError error={error} />
          {children}
        </div>
      </fieldset>
    </Modal>
  );
}
// Public artifacts only. File encoding is not cryptography; hashing/crypto remains in Electron main.
async function publicFile(file, max = 65536) {
  if (!file || file.size > max) throw new Error('Choose a public artifact smaller than 64 KiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const n of bytes) binary += String.fromCharCode(n);
  return btoa(binary);
}
const targetFieldHelp = {
  reuse: {
    what: 'Choose one of your saved target revisions, or create a new revision to enter a different destination.',
    source: 'Profiles appear after you save a deployment target. Reusing a revision keeps its public artifacts and settings together.',
  },
  name: {
    what: 'A short, recognizable name for this deployment destination, for example Production runtime.',
    source: 'Choose this label yourself so you and the Auditor can recognize the target later.',
  },
  runtime_version: {
    what: 'The release version of the CCRV protected runtime that will run the contract.',
    source: 'Use the runtime-image provider’s release notes or image metadata. The application container has its own separate version.',
  },
  image_source: {
    what: 'The trusted release URL or artifact reference for the protected runtime boot image.',
    source: 'Ask the destination platform operator or use the runtime provider’s release page. This field identifies the boot image; the workload container is configured later.',
  },
  image_digest: {
    what: 'The SHA-256 checksum of that exact protected runtime image: 64 lowercase hexadecimal characters, optionally prefixed with sha256:.',
    source: 'Obtain the expected checksum from a trusted release manifest and verify your runtime-image file against it.',
  },
  header: {
    what: 'Upload the public Secure Execution (SE) header belonging to that exact protected runtime image, up to 64 KiB.',
    source: 'Request the public header from the runtime-image provider or the platform operator supplying the image. It binds prepared requests to the intended protected image.',
  },
  header_sha256: {
    what: 'The expected SHA-256 of the uploaded SE header: 64 lowercase hexadecimal characters without a prefix.',
    source: 'Obtain it independently from trusted runtime-provider metadata or a separate trusted channel. A checksum calculated only from an untrusted upload does not establish its origin.',
  },
  hkds: {
    what: 'Upload 1–16 current public host key documents (HKDs), one for each destination machine permitted to run this contract.',
    source: 'Ask the destination hardware/platform administrator for verified HKDs. Use the destination’s documents even when the Manager runs elsewhere. Preserve both certificates in a hybrid HKD.',
  },
  runtime_certificate: {
    what: 'Upload the current public PEM certificate used to encrypt contracts for the selected runtime release.',
    source: 'Use the contract-encryption certificate distributed by the runtime-image provider for this release. An HKD, private key or logging certificate serves a different purpose.',
  },
  mode: {
    what: 'Native uses the real target’s public artifacts. Development simulation explicitly selects the software test flow and also requires worker opt-in.',
    source: 'Choose with the platform operator. Native preparation validates artifacts; successful Add and Retrieve still need verification inside a supported destination guest.',
  },
  capabilities: {
    what: 'Optionally upload JSON with add, list, lock, retrieve, secret_types, recorded_at (RFC 3339) and evidence. Native reports must be no older than seven days when preparing requests.',
    source: 'Ask the destination operator for a report collected inside its Secure Execution guest. Without one, hardware support remains unverified. An operator report is not hardware attestation.',
  },
};

function TargetField({ label, help, children }) {
  const info = targetFieldHelp[help];
  return (
    <div className="secret-target__field">
      {children}
      <Tooltip
        className="secret-target__help"
        align="top-end"
        autoAlign
        description={
          <span className="secret-target__help-content">
            <span>
              <strong>What to enter</strong>
              {info.what}
            </span>
            <span>
              <strong>Where to get it</strong>
              {info.source}
            </span>
          </span>
        }
      >
        <button type="button" className="secret-target__help-button" aria-label={`About ${label}`}>
          <Information size={16} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}

function PublicUpload({ id, label, help, onFile, value, multiple = false }) {
  const [error, setError] = useState(null);
  return (
    <TargetField label={label} help={help}>
      <label htmlFor={id} className="cds--label">
        {label}
      </label>
      <input
        id={id}
        type="file"
        multiple={multiple}
        onChange={async (e) => {
          setError(null);
          try {
            const files = [...e.target.files];
            await onFile(multiple ? files : files[0]);
          } catch (e) {
            setError(e);
          }
        }}
      />
      <p className="secret-store__helper">{value || 'No file selected'}</p>
      <SecretError error={error} />
    </TargetField>
  );
}
function TargetModal({ current, onClose, onSave }) {
  const [target, setTarget] = useState(
    current || {
      name: '',
      platform: 'ccrv',
      runtime_version: '',
      image_source: '',
      image_digest: '',
      header_sha256: '',
      header: '',
      hosts: [],
      runtime_certificate: '',
      mode: 'NATIVE',
    }
  );
  const [profiles, setProfiles] = useState([]);
  const [reuse, setReuse] = useState('');
  useEffect(() => {
    let active = true;
    secretStoreService
      .targets()
      .then((p) => {
        if (active) setProfiles(p || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const field = (key, label, helperText) => (
    <TargetField label={label} help={key}>
      <TextInput
        id={`target-${key}`}
        labelText={label}
        helperText={helperText}
        value={target[key]}
        onChange={(e) => setTarget({ ...target, [key]: e.target.value })}
      />
    </TargetField>
  );
  return (
    <FlowModal
      heading="Deployment target"
      label="Save target revision"
      onClose={onClose}
      onSave={() => onSave(reuse ? { target_revision_id: reuse } : { target })}
    >
      <p>Use artifacts for the machine and protected runtime that will run the contract.</p>
      {profiles.length > 0 && (
        <TargetField label="Personal target profiles" help="reuse">
          <Select
            id="target-reuse"
            labelText="Personal target profiles"
            value={reuse}
            onChange={(e) => setReuse(e.target.value)}
          >
            <SelectItem value="" text="Create a new revision" />
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id} text={`${p.name} · revision ${p.revision}`} />
            ))}
          </Select>
        </TargetField>
      )}
      {!reuse && (
        <>
          {field('name', 'Target name')}
          {field('runtime_version', 'CCRV runtime version')}
          {field(
            'image_source',
            'Protected runtime image source',
            'Trusted release URL or artifact reference; not the workload OCI image.'
          )}
          {field('image_digest', 'Runtime image SHA-256')}
          <PublicUpload
            id="target-header"
            label="Public SE header"
            help="header"
            value={target.header ? 'SE header selected' : ''}
            onFile={async (f) => {
              const header = await publicFile(f);
              setTarget((t) => ({ ...t, header }));
            }}
          />
          {field(
            'header_sha256',
            'Expected SE-header SHA-256',
            'Obtain this independently from the trusted runtime-image provider.'
          )}
          <PublicUpload
            id="target-hkds"
            multiple
            label="Permitted destination-machine HKDs"
            help="hkds"
            value={target.hosts.map((h) => h.id).join(', ')}
            onFile={async (files) => {
              if (!files.length || files.length > 16)
                throw new Error('Choose 1–16 public host key documents.');
              const hosts = await Promise.all(
                files.map(async (f) => ({
                  id: f.name.replace(/\.(crt|cer|pem)$/i, ''),
                  description: f.name,
                  data: await publicFile(f),
                }))
              );
              setTarget((t) => ({ ...t, hosts }));
            }}
          />
          <p className="secret-store__helper">
            Name each HKD file HKD-MODEL-PLANTSERIAL.crt. Hybrid HKDs contain both certificates in
            one PEM file.
          </p>
          <PublicUpload
            id="target-runtime-cert"
            label="Runtime contract-encryption certificate"
            help="runtime_certificate"
            value={target.runtime_certificate ? 'Certificate selected' : ''}
            onFile={async (f) => {
              if (f.size > 65536) throw new Error('Certificate is too large.');
              const runtime_certificate = await f.text();
              setTarget((t) => ({ ...t, runtime_certificate }));
            }}
          />
          <TargetField label="Execution mode" help="mode">
            <RadioButtonGroup
              name="target-mode"
              legendText="Execution mode"
              valueSelected={target.mode}
              onChange={(mode) => setTarget({ ...target, mode })}
            >
              <RadioButton id="target-native" value="NATIVE" labelText="Native target" />
              <RadioButton
                id="target-simulation"
                value="SIMULATION"
                labelText="Explicit development simulation"
              />
            </RadioButtonGroup>
          </TargetField>
          <PublicUpload
            id="target-capabilities"
            label="Target capability report (optional JSON)"
            help="capabilities"
            value={target.capabilities ? 'Report attached' : ''}
            onFile={async (f) => {
              if (f.size > 16384) throw new Error('Capability report exceeds 16 KiB.');
              const capabilities = JSON.parse(await f.text());
              setTarget((t) => ({ ...t, capabilities }));
            }}
          />
          <p className="secret-store__helper">
            Native preparation verifies HKD trust and request format. Hardware support is verified
            only on the destination guest; this step performs no Add or Retrieve call.
          </p>
        </>
      )}
    </FlowModal>
  );
}
function RequirementsModal({ initial, onClose, onSave }) {
  const [items, setItems] = useState(initial.map((r) => ({ ...r })));
  const update = (i, key, value) =>
    setItems(items.map((r, n) => (i === n ? { ...r, [key]: value } : r)));
  return (
    <FlowModal
      heading="Runtime secret requirements"
      label="Save requirements"
      onClose={onClose}
      onSave={() => onSave(items)}
    >
      <p>
        Declare public logical names and the workload consumers. Changes invalidate owner approvals
        and prepared requests.
      </p>
      {items.map((r, i) => (
        <div className="secret-flow__requirement" key={i}>
          <TextInput
            id={`requirement-name-${i}`}
            labelText="Logical name"
            placeholder="DATABASE_PASSWORD"
            value={r.name}
            onChange={(e) => update(i, 'name', e.target.value)}
          />
          <TextInput
            id={`requirement-consumer-${i}`}
            labelText="Workload consumer"
            placeholder="api-service"
            value={r.consumer}
            onChange={(e) => update(i, 'consumer', e.target.value)}
          />
          <Select
            id={`requirement-type-${i}`}
            labelText="Use"
            value={r.type}
            onChange={(e) => {
              const type = e.target.value;
              setItems(
                items.map((r, n) =>
                  i === n
                    ? { ...r, type, kind: type === 'association' ? 'association' : 'retrievable' }
                    : r
                )
              );
            }}
          >
            {kinds.map((type) => (
              <SelectItem
                key={type}
                value={type}
                text={
                  type === 'association'
                    ? 'Association · 32-byte resource binding'
                    : `Retrievable · ${type}`
                }
              />
            ))}
          </Select>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={TrashCan}
            onClick={() => setItems(items.filter((_, n) => n !== i))}
          >
            Remove requirement
          </Button>
        </div>
      ))}
      <Button
        kind="tertiary"
        renderIcon={Add}
        disabled={items.length >= 8}
        onClick={() => setItems([...items, emptyRequirement()])}
      >
        Add requirement
      </Button>
    </FlowModal>
  );
}
function ApprovalModal({ data, onClose, onSave }) {
  const [mode, setMode] = useState('secrets');
  const [selected, setSelected] = useState(data.own_sources || []);
  const [group, setGroup] = useState([]);
  const [mapping, setMapping] = useState(
    Object.fromEntries((data.own_approvals || []).map((a) => [a.version_id, a.name]))
  );
  const groupChanged = useCallback((members) => setGroup(members), []);
  const candidates = mode === 'groups' ? group : selected;
  return (
    <FlowModal
      heading="Approve my secret versions"
      label="Sign owner approval"
      onClose={onClose}
      disabled={candidates.length > 8 || candidates.some((c) => !mapping[c.version_id])}
      onSave={() => {
        return onSave(prepareSecretBindings(candidates, mapping, data.requirements));
      }}
    >
      <p>
        This signed approval replaces your contributions to this build. It binds each exact version,
        consumer and secret type to target {data.target.name}. Saving an empty selection revokes
        your contributions before workload submission.
      </p>
      <RadioButtonGroup
        name="flow-source"
        legendText="Select from my store"
        valueSelected={mode}
        onChange={setMode}
      >
        <RadioButton id="flow-individual" value="secrets" labelText="Secrets" />
        <RadioButton id="flow-group" value="groups" labelText="Personal group" />
      </RadioButtonGroup>
      {mode === 'secrets' ? (
        <SecretVersionPicker selected={selected} onChange={setSelected} />
      ) : (
        <SecretGroupSourcePicker onChange={groupChanged} />
      )}
      {candidates.length > 8 && (
        <InlineNotification
          kind="error"
          hideCloseButton
          title="Too many versions"
          subtitle="This runtime supports at most eight requests after group expansion. Choose a smaller group."
        />
      )}
      {candidates.map((c) => (
        <Select
          id={`map-${c.version_id}`}
          key={c.version_id}
          labelText={`${c.alias} · version ${c.version}`}
          value={mapping[c.version_id] || ''}
          onChange={(e) => setMapping({ ...mapping, [c.version_id]: e.target.value })}
        >
          <SelectItem value="" text="Choose a logical requirement" />
          {data.requirements.map((r) => (
            <SelectItem
              key={r.name}
              value={r.name}
              text={`${r.name} · ${r.consumer} · ${r.type}`}
            />
          ))}
        </Select>
      ))}
      <p className="secret-store__helper">
        Catalog values and aliases remain private. The Auditor receives encrypted requests and
        public UV IDs.
      </p>
    </FlowModal>
  );
}
function ReviewModal({ target, fingerprints, onClose, onSave }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <FlowModal
      heading="Review deployment target"
      label="Verify and approve target"
      onClose={onClose}
      onSave={onSave}
      disabled={!confirmed}
    >
      <p>
        {target.name} · {target.mode} · CCRV {target.runtime_version}
      </p>
      <CodeSnippet type="multi">{`Image: ${target.image_source}\nImage SHA-256: ${target.image_digest}\nSE header SHA-256: ${target.header_sha256}\nHosts: ${target.hosts.map((h) => h.id).join(', ')}`}</CodeSnippet>
      {fingerprints && (
        <CodeSnippet type="multi">{`Runtime certificate SHA-256: ${fingerprints.runtime_certificate_sha256}\n${Object.entries(
          fingerprints.host_certificates_sha256 || {}
        )
          .map(([id, values]) => `${id}: ${values.join(', ')}`)
          .join('\n')}`}</CodeSnippet>
      )}
      <details>
        <summary>Runtime encryption certificate</summary>
        <CodeSnippet type="multi">{target.runtime_certificate}</CodeSnippet>
      </details>
      <Checkbox
        id="target-provenance"
        labelText="I verified the runtime-image source, expected SE-header digest and runtime encryption certificate independently. These HKDs belong to the permitted deployment machines."
        checked={confirmed}
        onChange={(_, { checked }) => setConfirmed(checked)}
      />
      <p className="secret-store__helper">
        The worker validates the public artifacts with pvsecret. Native mode requires a current,
        verified host-key certificate chain. Approval does not attest a running guest.
      </p>
    </FlowModal>
  );
}
