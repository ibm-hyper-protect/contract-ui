import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tile,
  Toggletip,
  ToggletipButton,
  ToggletipContent,
} from '@carbon/react';
import { StatePanel } from './StatePanel';
import { ROLE_NAMES } from '../utils/constants';
import { filterDirectoryUsers, getUserRoles } from '../utils/userDirectory';
import { getPrimaryRole, sortRolesByPriority } from '../utils/roles';

const COMPACT_LABELS = {
  name: 'User',
  role: 'Roles',
  keyStatus: 'Signing key',
  passwordStatus: 'Password',
};

const UserRoleSummary = ({ user }) => {
  const roles = sortRolesByPriority(getUserRoles(user));
  if (!roles.length) return <Tag type="gray" size="sm">None</Tag>;
  const primaryRole = getPrimaryRole(roles);
  const name = user.name || user.full_name || user.email;

  return (
    <div className="user-directory__roles">
      <Tag type={user.is_active ? 'blue' : 'gray'} size="sm">{ROLE_NAMES[primaryRole] || primaryRole}</Tag>
      {roles.length > 1 && (
        <Toggletip align="bottom" autoAlign>
          <ToggletipButton
            className="user-directory__role-count"
            label={`Show all ${roles.length} roles for ${name}`}
          >
            +{roles.length - 1}
          </ToggletipButton>
          <ToggletipContent>
            <p>Assigned roles</p>
            <ul className="user-directory__role-list" aria-label={`Assigned roles for ${name}`}>
              {roles.map(role => <li key={role}>{ROLE_NAMES[role] || role}</li>)}
            </ul>
          </ToggletipContent>
        </Toggletip>
      )}
    </div>
  );
};

const UserDirectory = ({ users, columns, activeRows, inactiveRows, currentUserId, busy = false }) => {
  const id = useId();
  const directoryHeaders = useMemo(() => {
    const compact = columns.filter(column => !['email', 'keyExpiresAt'].includes(column.key))
      .map(column => ({ ...column, header: COMPACT_LABELS[column.key] || column.header }));
    compact.splice(2, 0, { key: 'status', header: 'Access' });
    return compact;
  }, [columns]);
  const keyExpiryLabel = columns.find(column => column.key === 'keyExpiresAt')?.header || 'Key expiry';
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [access, setAccess] = useState('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const availableRoles = useMemo(() => [...new Set([
    ...Object.keys(ROLE_NAMES), ...users.flatMap(getUserRoles), ...(role === 'all' ? [] : [role]),
  ])], [users, role]);
  const filteredUsers = useMemo(() => filterDirectoryUsers(users, { query, role, access }), [users, query, role, access]);
  const models = useMemo(() => new Map([...activeRows, ...inactiveRows].map(row => [row.id, row])), [activeRows, inactiveRows]);
  const records = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  const lastPage = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  useEffect(() => { setPage(previous => Math.min(previous, lastPage)); }, [lastPage]);
  const rows = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .map(user => models.get(user.id)).filter(Boolean);
  const visibleIds = new Set(rows.map(row => row.id));
  const activeCount = users.filter(user => user.is_active).length;
  const hasFilters = Boolean(query || role !== 'all' || access !== 'active');
  const clearFilters = () => {
    setQuery('');
    setRole('all');
    setAccess('active');
    setPage(1);
  };
  const noActiveUsers = users.length > 0 && !activeCount && !hasFilters;

  const renderCell = (cell, user, model) => {
    switch (cell.info.header) {
      case 'name':
        return (
          <div className="user-directory__identity">
            <span className="user-directory__name">
              {cell.value}
              {user.id === currentUserId && <Tag type="blue" size="sm">You</Tag>}
            </span>
            <span className="user-directory__secondary">{user.email}</span>
          </div>
        );
      case 'status':
        return <Tag type={user.is_active ? 'green' : 'gray'}>{user.is_active ? 'Active' : 'Inactive'}</Tag>;
      case 'role':
        return <UserRoleSummary user={user} />;
      case 'keyStatus':
        return (
          <div className="user-directory__credential">
            {cell.value || <span aria-label="Not applicable">—</span>}
            {model.keyExpiresAt && model.keyExpiresAt !== 'N/A' && (
              <span className="user-directory__secondary">{keyExpiryLabel}: {model.keyExpiresAt}</span>
            )}
          </div>
        );
      default:
        return cell.value || <span aria-label="Not applicable">—</span>;
    }
  };

  return (
    <Tile className="user-directory" aria-labelledby={`${id}-title`} aria-busy={busy}>
      <div className="user-directory__header">
        <div className="user-directory__heading">
          <h2 id={`${id}-title`}>Account directory</h2>
          <div className="user-directory__counts">
            <Tag type="gray">{activeCount} active</Tag>
            <Tag type="gray">{users.length - activeCount} inactive</Tag>
          </div>
        </div>
        <p>Find users and manage their roles and account access.</p>
      </div>
      <DataTable rows={rows} headers={directoryHeaders} size="lg">
        {({ rows, headers, getHeaderProps, getRowProps, getCellProps, getTableProps, getTableContainerProps }) => (
          <TableContainer {...getTableContainerProps()}>
            <TableToolbar aria-label="Account filters">
              <TableToolbarContent>
                <TableToolbarSearch
                  persistent
                  labelText="Search users"
                  placeholder="Search users…"
                  value={query}
                  disabled={busy}
                  onChange={(event, value) => { setQuery(value ?? event?.target?.value ?? ''); setPage(1); }}
                />
                <Select
                  id={`${id}-role`}
                  labelText="Role"
                  inline
                  value={role}
                  disabled={busy}
                  className="user-directory__filter"
                  onChange={event => { setRole(event.target.value); setPage(1); }}
                >
                  <SelectItem value="all" text="All roles" />
                  {availableRoles.map(value => <SelectItem key={value} value={value} text={ROLE_NAMES[value] || value} />)}
                </Select>
                <Select
                  id={`${id}-access`}
                  labelText="Access"
                  inline
                  value={access}
                  disabled={busy}
                  className="user-directory__filter"
                  onChange={event => { setAccess(event.target.value); setPage(1); }}
                >
                  <SelectItem value="active" text="Active accounts" />
                  <SelectItem value="inactive" text="Inactive accounts" />
                  <SelectItem value="all" text="All accounts" />
                </Select>
              </TableToolbarContent>
            </TableToolbar>
            <div className="user-directory__results">
              <p role="status">{busy ? 'Updating accounts…' : `${filteredUsers.length} of ${users.length} accounts`}</p>
              {hasFilters && <Button kind="ghost" size="sm" onClick={clearFilters} disabled={busy}>Clear filters</Button>}
            </div>
            {filteredUsers.length ? (
              <>
                <div className="user-directory__scroll" role="region" aria-label="User accounts table" tabIndex={0}>
                  <Table {...getTableProps()} aria-label="User accounts">
                    <TableHead>
                      <TableRow>
                        {headers.map(header => {
                          const { key, ...props } = getHeaderProps({ header });
                          return <TableHeader key={key} {...props}>{header.header}</TableHeader>;
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map(row => {
                        // Carbon synchronizes its internal rows after a page or snapshot change.
                        if (!visibleIds.has(row.id)) return null;
                        const user = records.get(row.id);
                        const model = models.get(row.id);
                        const { key, ...props } = getRowProps({ row });
                        return (
                          <TableRow key={key} {...props}>
                            {row.cells.map(cell => {
                              const { key: cellKey, ...cellProps } = getCellProps({ cell });
                              return <TableCell key={cellKey} {...cellProps}>{renderCell(cell, user, model)}</TableCell>;
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  pageSizes={[10, 20, 50, 100]}
                  totalItems={filteredUsers.length}
                  disabled={busy}
                  onChange={({ page: nextPage, pageSize: nextSize }) => {
                    setPage(nextSize === pageSize ? nextPage : 1);
                    setPageSize(nextSize);
                  }}
                />
              </>
            ) : (
              <StatePanel
                className="user-directory__empty"
                title={!users.length ? 'No users yet' : noActiveUsers ? 'No active accounts' : 'No matching users'}
                description={!users.length ? 'Create an account to get started.' : noActiveUsers
                  ? 'Choose all accounts to view inactive users and restore their access.'
                  : 'Try another search or clear the filters to see active accounts.'}
                action={noActiveUsers ? (
                  <Button kind="tertiary" onClick={() => { setAccess('all'); setPage(1); }}>Show all accounts</Button>
                ) : null}
              />
            )}
          </TableContainer>
        )}
      </DataTable>
    </Tile>
  );
};

export default UserDirectory;
