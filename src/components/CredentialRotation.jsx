import React, { useState } from 'react';
import {
  DataTable, TableContainer, Table, TableHead, TableRow, TableHeader,
  TableBody, TableCell, TableToolbar, TableToolbarContent, TableToolbarSearch,
  TableSelectAll, TableSelectRow, TableBatchActions, TableBatchAction,
  InlineNotification, Modal, Tag, Select, SelectItem, InlineLoading,
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

const CredentialRotation = ({ health, initialFilter = 'attention', refreshing, onRefresh }) => {
  const [kind, setKind] = useState(() => {
    if (initialFilter === 'key') return 'key';
    if (initialFilter === 'soon' && !health.credentials.some(item => item.kind === 'password' && item.status === 'soon')) return 'key';
    return 'password';
  });
  const [statusFilter, setStatusFilter] = useState(initialFilter === 'soon' ? 'soon' : 'attention');
  const [search, setSearch] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [selectionVersion, setSelectionVersion] = useState(0);

  const rows = health.credentials.filter(item => (
    item.kind === kind &&
    (statusFilter === 'all' || (statusFilter === 'soon' ? item.status === 'soon' : item.needsAttention)) &&
    `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase())
  )).map(item => ({
    id: item.userId,
    name: item.name,
    email: item.email,
    expiry: item.expiresAt ? formatDateOnly(item.expiresAt) : 'Not available',
    remaining: item.daysRemaining === null ? 'Not available'
      : item.status === 'required' ? 'Update required'
      : item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)} days overdue`
      : item.daysRemaining === 0 ? 'Today' : `${item.daysRemaining} days`,
    status: item.status,
    disabled: kind === 'key' && item.status === 'missing',
  }));

  const changeFilter = (setter, value) => {
    setter(value);
    setSelectionVersion(version => version + 1);
  };
  const performAction = async () => {
    if (!confirmation?.open || processing) return;
    setProcessing(true);
    setResult(null);
    try {
      const operation = confirmation.kind === 'password'
        ? rotationService.bulkForcePasswordChange.bind(rotationService)
        : rotationService.bulkRevokeKeys.bind(rotationService);
      const outcome = await operation(confirmation.users.map(user => user.id));
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
      setProcessing(false);
    }
  };
  const closeConfirmation = () => {
    if (!processing) setConfirmation(current => ({ ...current, open: false }));
  };
  const credentialLabel = kind === 'password' ? 'passwords' : 'public keys';

  return (
    <section className="credential-review" aria-labelledby="credential-review-heading" aria-busy={processing || refreshing}>
      <div className="analytics-section-header">
        <div>
          <h2 id="credential-review-heading" className="app-section-heading">Review account credentials</h2>
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
        <DataTable key={`${kind}:${statusFilter}:${selectionVersion}:${refreshing}`} rows={rows} headers={HEADERS}>
          {({ rows: tableRows, headers, selectedRows, getHeaderProps, getRowProps,
            getSelectionProps, getTableProps, getTableContainerProps, getBatchActionProps }) => {
            const batch = getBatchActionProps();
            return (
              <TableContainer {...getTableContainerProps()} title={kind === 'password' ? 'Passwords' : 'Public keys'}
                description={`${rows.length} ${rows.length === 1 ? 'account matches' : 'accounts match'} the current filters. Select accounts to manage credentials.`}>
                <TableToolbar>
                  <TableBatchActions {...batch}>
                    <TableBatchAction renderIcon={kind === 'password' ? Renew : TrashCan}
                      tabIndex={batch.shouldShowBatchActions ? 0 : -1}
                      disabled={processing || refreshing}
                      onClick={() => setConfirmation({ open: true, kind, users: selectedRows.map(row => ({ id: row.id, name: rows.find(item => item.id === row.id)?.name })) })}>
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
        primaryButtonText={processing ? 'Updating…' : confirmation?.kind === 'password' ? 'Require password change' : 'Revoke public keys'}
        secondaryButtonText="Cancel" primaryButtonDisabled={processing || !confirmation?.users.length}
        secondaryButtonDisabled={processing} onRequestClose={closeConfirmation} onSecondarySubmit={closeConfirmation}
        onRequestSubmit={performAction} preventCloseOnClickOutside>
        <p>{confirmation?.kind === 'password'
          ? 'These users will need to change their password the next time they sign in.'
          : 'These users will be unable to sign requests until they register a new public key.'}</p>
        <ul className="credential-review__confirmation">{confirmation?.users.map(user => <li key={user.id}>{user.name}</li>)}</ul>
        {processing && <InlineLoading description="Updating selected accounts…" />}
      </Modal>
    </section>
  );
};

export default CredentialRotation;
