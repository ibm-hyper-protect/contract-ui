import React, { useRef, useState } from 'react';
import {
  DataTable, TableContainer, Table, TableHead, TableRow, TableHeader,
  TableBody, TableCell, TableToolbar, TableToolbarContent, TableToolbarSearch,
  TableSelectAll, TableSelectRow, TableBatchActions, TableBatchAction,
  InlineNotification, Modal, Tag, Select, SelectItem, CodeSnippet,
} from '@carbon/react';
import { Renew, TrashCan } from '@carbon/icons-react';
import rotationService from '../services/rotationService';
import { StatePanel } from './StatePanel';
import { CREDENTIAL_STATUS } from '../utils/credentialHealth';
import { formatDateOnly } from '../utils/formatters';

const HEADERS = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'expiry', header: 'Expires' },
  { key: 'remaining', header: 'Time remaining' },
  { key: 'status', header: 'Status' },
];

const CredentialReview = ({ health, initialFilter = 'attention', refreshing, onRefresh }) => {
  const [kind, setKind] = useState(() => {
    if (initialFilter === 'key') return 'key';
    if (initialFilter === 'soon' && !health.credentials.some(item => item.kind === 'password' && item.status === 'soon')) return 'key';
    return 'password';
  });
  const [statusFilter, setStatusFilter] = useState(initialFilter === 'soon' ? 'soon' : 'attention');
  const [search, setSearch] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [processing, setProcessing] = useState(false);
  // The modal's Escape handler can retain the callback from when it opened.
  const operationInFlight = useRef(false);
  const [result, setResult] = useState(null);
  const [selectionVersion, setSelectionVersion] = useState(0);

  const deviceKeys = kind === 'key' && health.deviceKeys;
  const headers = deviceKeys
    ? [...HEADERS.slice(0, 2), { key: 'label', header: 'Device' }, { key: 'fingerprint', header: 'Fingerprint' }, ...HEADERS.slice(2)]
    : HEADERS;
  const rows = health.credentials.filter(item => (
    item.kind === kind &&
    (statusFilter === 'all' || (statusFilter === 'soon' ? item.status === 'soon' : item.needsAttention)) &&
    `${item.name} ${item.email} ${item.label || ''} ${item.fingerprint || ''}`.toLowerCase().includes(search.toLowerCase())
  )).map(item => ({
    id: deviceKeys ? item.id : item.userId,
    userId: item.userId,
    keyId: item.keyId,
    label: item.label || 'Unlabelled key',
    fingerprint: item.fingerprint || 'Not registered',
    name: item.name,
    email: item.email,
    expiry: item.expiresAt ? formatDateOnly(item.expiresAt) : 'Not available',
    remaining: item.daysRemaining === null ? 'Not available'
      : item.status === 'required' ? 'Update required'
      : item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)} days overdue`
      : item.daysRemaining === 0 ? 'Today' : `${item.daysRemaining} days`,
    status: item.status,
    disabled: kind === 'key' && (item.status === 'missing' || (deviceKeys && !item.keyId)),
  }));

  const changeFilter = (setter, value) => {
    setter(value);
    setSelectionVersion(version => version + 1);
  };
  const performAction = async () => {
    if (!confirmation?.open || operationInFlight.current) return;
    operationInFlight.current = true;
    setProcessing(true);
    setResult(null);
    try {
      const outcome = confirmation.deviceKeys
        ? await rotationService.bulkRevokeCredentialKeys(confirmation.users)
        : await (confirmation.kind === 'password'
          ? rotationService.bulkForcePasswordChange(confirmation.users.map(user => user.userId))
          : rotationService.bulkRevokeKeys(confirmation.users.map(user => user.userId)));
      const failed = outcome.failed.length;
      const succeeded = outcome.success.length;
      setResult({
        kind: failed ? 'warning' : 'success',
        title: failed ? 'Some updates failed' : 'Credentials updated',
        message: `${succeeded} of ${confirmation.users.length} ${confirmation.kind === 'password' ? 'password updates required' : 'public keys revoked'}.${failed ? ` ${failed} failed; refresh and review before trying again.` : ''}`,
      });
      setConfirmation(current => ({ ...current, open: false }));
      setSelectionVersion(version => version + 1);
      await onRefresh();
    } catch (error) {
      setResult({ kind: 'error', title: 'Unable to update credentials', message: error.message });
      setConfirmation(current => ({ ...current, open: false }));
    } finally {
      operationInFlight.current = false;
      setProcessing(false);
    }
  };
  const closeConfirmation = () => {
    if (!operationInFlight.current) setConfirmation(current => ({ ...current, open: false }));
  };
  const credentialLabel = kind === 'password' ? 'passwords' : 'public keys';

  return (
    <section className="credential-review" aria-labelledby="credential-review-heading" aria-busy={processing || refreshing}>
      <div className="analytics-section-header">
        <div>
          <h2 id="credential-review-heading" className="analytics-section-heading">Review account credentials</h2>
          <p className="analytics-section-copy">Enabled accounts only. Review upcoming expiries within 30 days. Disabled accounts are excluded.</p>
        </div>
        <Tag type="gray" size="sm">{health.attentionUsers} {health.attentionUsers === 1 ? 'user needs' : 'users need'} attention</Tag>
      </div>
      {result && <InlineNotification className="analytics-notification" kind={result.kind} lowContrast
        title={result.title} subtitle={result.message} onCloseButtonClick={() => setResult(null)} />}
      <div className="credential-review__filters">
        <Select id="credential-kind" labelText="Credential" value={kind}
          disabled={processing || refreshing} onChange={event => changeFilter(setKind, event.target.value)}>
          <SelectItem value="password" text="Passwords" />
          <SelectItem value="key" text="Public keys" />
        </Select>
        <Select id="credential-status" labelText="Show" value={statusFilter}
          disabled={processing || refreshing} onChange={event => changeFilter(setStatusFilter, event.target.value)}>
          <SelectItem value="attention" text="Needs attention" />
          <SelectItem value="soon" text="Expiring within 30 days" />
          <SelectItem value="all" text="All credentials" />
        </Select>
      </div>
      <div className="credential-review__table">
        <DataTable key={`${kind}:${statusFilter}:${selectionVersion}:${refreshing}`} rows={rows} headers={headers}>
          {({ rows: tableRows, headers, selectedRows, getHeaderProps, getRowProps,
            getSelectionProps, getTableProps, getTableContainerProps, getBatchActionProps }) => {
            const batch = getBatchActionProps();
            return (
              <TableContainer {...getTableContainerProps()} title={kind === 'password' ? 'Passwords' : 'Public keys'}
                description={deviceKeys ? `${rows.length} device key records match the current filters. Select individual keys to revoke.` : `${rows.length} ${rows.length === 1 ? 'account matches' : 'accounts match'} the current filters. Select accounts to manage credentials.`}>
                <TableToolbar>
                  <TableBatchActions {...batch}>
                    <TableBatchAction renderIcon={kind === 'password' ? Renew : TrashCan}
                      tabIndex={batch.shouldShowBatchActions ? 0 : -1}
                      disabled={processing || refreshing}
                      onClick={() => setConfirmation({ open: true, kind, deviceKeys, users: selectedRows.map(row => rows.find(item => item.id === row.id)).filter(item => item && !item.disabled) })}>
                      {kind === 'password' ? 'Require password change' : 'Revoke public keys'}
                    </TableBatchAction>
                  </TableBatchActions>
                  <TableToolbarContent aria-hidden={batch.shouldShowBatchActions}>
                    <TableToolbarSearch persistent value={search} placeholder="Search by name or email"
                      tabIndex={batch.shouldShowBatchActions ? -1 : 0} disabled={processing || refreshing}
                      onChange={event => {
                        batch.onCancel();
                        setSearch(event?.target?.value || '');
                      }} />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()} aria-label={`Account ${credentialLabel}`}>
                  <TableHead><TableRow>
                    <TableSelectAll {...getSelectionProps()} disabled={!rows.some(row => !row.disabled) || processing || refreshing} />
                    {headers.map(header => {
                      const { key, ...props } = getHeaderProps({ header });
                      return <TableHeader key={key} {...props}>{header.header}</TableHeader>;
                    })}
                  </TableRow></TableHead>
                  <TableBody>
                    {tableRows.map(row => {
                      const { key, ...props } = getRowProps({ row });
                      return <TableRow key={key} {...props}>
                        <TableSelectRow {...getSelectionProps({ row })} disabled={row.disabled || processing || refreshing} />
                        {row.cells.map(cell => <TableCell key={cell.id}>
                          {cell.info.header === 'status'
                            ? <Tag size="sm" type={CREDENTIAL_STATUS[cell.value].type}>{CREDENTIAL_STATUS[cell.value].label}</Tag>
                            : cell.info.header === 'fingerprint' && cell.value !== 'Not registered'
                              ? <CodeSnippet type="single">{cell.value}</CodeSnippet>
                              : cell.value}
                        </TableCell>)}
                      </TableRow>;
                    })}
                  </TableBody>
                </Table>
                {!rows.length && <StatePanel
                  title={search ? 'No matching accounts' : statusFilter === 'soon' ? `No ${credentialLabel} expiring soon` : statusFilter === 'all' ? 'No enabled accounts' : `No ${credentialLabel} need attention`}
                  description={search ? 'Try another name or email, or clear the search.' : 'Change the filters to review other credentials.'} />}
              </TableContainer>
            );
          }}
        </DataTable>
      </div>
      {kind === 'key' && <p className="analytics-section-copy credential-review__note">Unregistered public keys cannot be revoked. The account owner must register a key in Account Settings.</p>}
      <Modal open={Boolean(confirmation?.open)} danger
        modalHeading={confirmation?.kind === 'password' ? 'Require a password change?' : 'Revoke these public keys?'}
        primaryButtonText={confirmation?.kind === 'password' ? 'Require password change' : 'Revoke public keys'}
        secondaryButtonText="Cancel" primaryButtonDisabled={processing || !confirmation?.users.length}
        loadingStatus={processing ? 'active' : 'inactive'} loadingDescription="Updating selected accounts…"
        onRequestClose={closeConfirmation} onSecondarySubmit={closeConfirmation}
        onRequestSubmit={performAction} preventCloseOnClickOutside>
        <p>{confirmation?.kind === 'password'
          ? 'These users will need to change their password the next time they sign in.'
          : confirmation?.deviceKeys
            ? 'Only the selected device keys will be revoked. Other keys remain available for signing.'
            : 'These users will be unable to sign requests until they register a new public key.'}</p>
        <ul className="credential-review__confirmation">{confirmation?.users.map(user => <li key={user.id}>{user.name}{confirmation.deviceKeys && <> — {user.label}<br /><code>{user.fingerprint}</code></>}</li>)}</ul>
      </Modal>
    </section>
  );
};

export default CredentialReview;
