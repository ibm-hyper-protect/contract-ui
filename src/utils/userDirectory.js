import { ROLE_NAMES } from './constants.js';

export const getUserRoles = user => {
  const roles = user.roles ?? user.role ?? [];
  return [...new Set((Array.isArray(roles) ? roles : [roles])
    .map(role => typeof role === 'string' ? role : role?.role_name || role?.name)
    .filter(Boolean)
    .map(role => role.trim().toUpperCase()))];
};

export const filterDirectoryUsers = (users, { query = '', role = 'all', access = 'active' } = {}) => {
  const search = query.trim().toLowerCase();
  return users.filter(user => {
    if (access === 'active' && !user.is_active) return false;
    if (access === 'inactive' && user.is_active) return false;
    const roles = getUserRoles(user);
    if (role !== 'all' && !roles.includes(role)) return false;
    return !search || [user.name, user.full_name, user.email, ...roles, ...roles.map(value => ROLE_NAMES[value])]
      .filter(Boolean).join(' ').toLowerCase().includes(search);
  });
};
