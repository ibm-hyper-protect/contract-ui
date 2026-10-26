import React, { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tile,
} from '@carbon/react';
import { Download, Renew, WarningAlt } from '@carbon/icons-react';
import PageHeader from '../components/PageHeader';
import { ErrorStatePanel, StatePanel } from '../components/StatePanel';
import systemLogService from '../services/systemLogService';
import userService from '../services/userService';
import { formatDate } from '../utils/formatters';
import { filterSystemLogs, formatLogDetails, serializeSystemLogsCsv } from '../utils/systemLogs';

const LOG_LIMIT = 200;
const headers = [
  { key: 'timestamp', header: 'Time' },
  { key: 'actor_name', header: 'Actor' },
  { key: 'action', header: 'Event' },
  { key: 'resource', header: 'Resource' },
  { key: 'status', header: 'Outcome' },
];
const outcomes = {
  SUCCESS: { label: 'Success', type: 'green' },
  FAILED: { label: 'Failed', type: 'red' },
  WARNING: { label: 'Warning', type: 'warm-gray', icon: WarningAlt },
  UNKNOWN: { label: 'Unknown', type: 'gray' },
};
const normalizeOutcome = status => String(status ?? '').trim().toUpperCase() || 'UNKNOWN';
const getOutcome = status => outcomes[normalizeOutcome(status)] || { label: String(status), type: 'gray' };
const displayTime = timestamp => {
  if (!timestamp) return 'Not available';
  return Number.isNaN(new Date(timestamp).getTime()) ? String(timestamp) : formatDate(timestamp);
};

const EventDetails = ({ log }) => (
  <div className="system-logs__details">
    <h3>Event details</h3>
    <dl className="system-logs__metadata">
      {[
        ['Event ID', log.id], ['Timestamp', log.timestamp],
        ['Actor email', log.actor_email || 'System'], ['IP address', log.ip_address],
        ['Event', log.action], ['Resource', log.resource],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? 'Not available'}</dd>
        </div>
      ))}
    </dl>
    <h4>Details</h4>
    <pre>{formatLogDetails(log.details) || 'No additional details.'}</pre>
  </div>
);

const SystemLogs = () => {
  const id = useId();
  const requestVersion = useRef(0);
  const [logs, setLogs] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [outcome, setOutcome] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadLogs = useCallback(async ({ showLoader = false } = {}) => {
    const version = ++requestVersion.current;
    if (showLoader) setIsLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [data, users] = await Promise.all([
        systemLogService.getSystemLogs(LOG_LIMIT, 0),
        userService.listUsers().catch(() => []),
      ]);
      if (version !== requestVersion.current) return;
      const names = new Map(users.map(user => [user.email, user.name || user.email]));
      setLogs(data.map(log => ({
        ...log,
        actor_name: names.get(log.actor_email) || log.actor_email || 'System',
      })));
      setHasLoaded(true);
    } catch (loadError) {
      if (version === requestVersion.current) setError(loadError.message || 'Please try again.');
    } finally {
      if (version === requestVersion.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadLogs({ showLoader: true });
    // Discard responses from a previous mount, including Strict Mode's first effect.
    return () => { requestVersion.current += 1; };
  }, [loadLogs]);

  const filteredLogs = useMemo(() => filterSystemLogs(logs, searchValue, outcome), [logs, searchValue, outcome]);
  const availableOutcomes = useMemo(() => [...new Set([
    ...Object.keys(outcomes), ...logs.map(log => normalizeOutcome(log.status)),
    ...(outcome === 'all' ? [] : [outcome]),
  ])], [logs, outcome]);
  const lastPage = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  useEffect(() => { setPage(previous => Math.min(previous, lastPage)); }, [lastPage]);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const logsById = new Map(paginatedLogs.map(log => [log.id, log]));
  const hasFilters = Boolean(searchValue || outcome !== 'all');
  const clearFilters = () => {
    setSearchValue('');
    setOutcome('all');
    setPage(1);
  };

  const handleExport = () => {
    const url = URL.createObjectURL(new Blob([serializeSystemLogsCsv(filteredLogs)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-logs-${new Date().toISOString().replaceAll(':', '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const renderCell = (cell, log) => {
    switch (cell.info.header) {
      case 'timestamp':
        return <time dateTime={log.timestamp}>{displayTime(log.timestamp)}</time>;
      case 'actor_name':
        return (
          <div className="system-logs__actor">
            <span>{log.actor_name}</span>
            {log.actor_email && log.actor_email !== log.actor_name && <span>{log.actor_email}</span>}
          </div>
        );
      case 'status': {
        const status = getOutcome(log.status);
        return <Tag type={status.type} renderIcon={status.icon}>{status.label}</Tag>;
      }
      default:
        return cell.value || 'Not available';
    }
  };

  return (
    <div className="app-page app-page--wide system-logs-page">
      <PageHeader
        title="System logs"
        description="Review authentication, user activity, and administrative events."
        actions={(
          <Button kind="tertiary" size="md" renderIcon={Renew} onClick={() => loadLogs()} disabled={isLoading || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        )}
      />
      {isLoading ? (
        <div role="status" aria-label="Loading system logs">
          <DataTableSkeleton rowCount={10} columnCount={6} showHeader={false} showToolbar />
        </div>
      ) : error && !hasLoaded ? (
        <ErrorStatePanel
          title="Unable to load system logs"
          description={error}
          action={<Button onClick={() => loadLogs({ showLoader: true })}>Retry</Button>}
        />
      ) : (
        <>
          {error && (
            <div className="system-logs__refresh-error">
              <InlineNotification
                kind="error"
                title="Refresh failed"
                subtitle="Showing the previously loaded events. Try again to get the latest activity."
                hideCloseButton
                lowContrast
              />
              <Button kind="tertiary" size="md" onClick={() => loadLogs()} disabled={refreshing}>Retry</Button>
            </div>
          )}
          <Tile className="system-logs__panel" aria-labelledby={`${id}-title`}>
            <div className="system-logs__panel-header">
              <h2 id={`${id}-title`}>Recent activity</h2>
              <p>Up to {LOG_LIMIT} recent events. Expand a row to inspect the full record.</p>
            </div>
            <DataTable rows={paginatedLogs} headers={headers} size="lg">
              {({ rows, headers, getHeaderProps, getRowProps, getCellProps, getTableProps, getTableContainerProps }) => (
                <TableContainer {...getTableContainerProps()}>
                  <TableToolbar aria-label="Event filters and export">
                    <TableToolbarContent>
                      <TableToolbarSearch
                        persistent
                        labelText="Search events"
                        placeholder="Search events…"
                        value={searchValue}
                        onChange={(event, value) => {
                          setSearchValue(value ?? event?.target?.value ?? '');
                          setPage(1);
                        }}
                      />
                      <Select
                        id={`${id}-outcome`}
                        labelText="Outcome"
                        inline
                        value={outcome}
                        onChange={event => { setOutcome(event.target.value); setPage(1); }}
                        className="system-logs__outcome"
                      >
                        <SelectItem value="all" text="All outcomes" />
                        {availableOutcomes.map(value => <SelectItem key={value} value={value} text={getOutcome(value).label} />)}
                      </Select>
                      <Button renderIcon={Download} onClick={handleExport} disabled={!filteredLogs.length}>Export CSV</Button>
                    </TableToolbarContent>
                  </TableToolbar>
                  <div className="system-logs__results">
                    <p role="status">{filteredLogs.length} of {logs.length} loaded events</p>
                    {hasFilters && <Button kind="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
                  </div>
                  {filteredLogs.length ? (
                    <div className="system-logs__table-scroll" role="region" aria-label="System events table" tabIndex={0}>
                      <Table {...getTableProps()} aria-label="System events">
                        <TableHead>
                          <TableRow>
                            <TableExpandHeader id={`${id}-expand`} />
                            {headers.map(header => (
                              <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map(row => {
                            const log = logsById.get(row.id);
                            // Carbon updates its internal rows after receiving a new page or snapshot.
                            if (!log) return null;
                            const { key, ...rowProps } = getRowProps({ row });
                            const detailId = `${id}-details-${row.id}`;
                            return (
                              <Fragment key={key}>
                                <TableExpandRow
                                  {...rowProps}
                                  expandHeader={`${id}-expand`}
                                  aria-label={row.isExpanded ? 'Collapse event details' : 'Expand event details'}
                                  aria-controls={detailId}
                                >
                                  {row.cells.map(cell => {
                                    const { key: cellKey, ...cellProps } = getCellProps({ cell });
                                    return <TableCell key={cellKey} {...cellProps}>{renderCell(cell, log)}</TableCell>;
                                  })}
                                </TableExpandRow>
                                <TableExpandedRow colSpan={headers.length + 1} id={detailId} hidden={!row.isExpanded}>
                                  {row.isExpanded && <EventDetails log={log} />}
                                </TableExpandedRow>
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <StatePanel
                      className="system-logs__empty"
                      title={logs.length ? 'No matching events' : 'No system events yet'}
                      description={logs.length ? 'Try another search or clear the filters to see all loaded events.' : 'System activity will appear here when events are recorded.'}
                    />
                  )}
                  <Pagination
                    page={currentPage}
                    pageSize={pageSize}
                    pageSizes={[10, 20, 50, 100]}
                    totalItems={filteredLogs.length}
                    onChange={({ page: nextPage, pageSize: nextSize }) => {
                      setPage(nextSize === pageSize ? nextPage : 1);
                      setPageSize(nextSize);
                    }}
                  />
                </TableContainer>
              )}
            </DataTable>
          </Tile>
        </>
      )}
    </div>
  );
};

export default SystemLogs;
