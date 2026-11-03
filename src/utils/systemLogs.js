const CSV_COLUMNS = [
  ['Timestamp', log => log.timestamp],
  ['Actor', log => log.actor_name || log.actor_email || 'System'],
  ['Action', log => log.action],
  ['Resource', log => log.resource],
  ['IP Address', log => log.ip_address],
  ['Status', log => log.status],
  ['Details', log => log.details],
];

export const formatLogDetails = value => {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
};

const normalizeStatus = status => String(status ?? '').trim().toUpperCase() || 'UNKNOWN';

export const filterSystemLogs = (logs = [], query = '', status = 'all') => {
  const search = String(query ?? '').trim().toLowerCase();
  const selectedStatus = normalizeStatus(status);
  return logs.filter(log => {
    const logStatus = normalizeStatus(log.status);
    if (selectedStatus !== 'ALL' && logStatus !== selectedStatus) return false;
    return !search || [...Object.values(log), logStatus]
      .map(formatLogDetails).join(' ').toLowerCase().includes(search);
  });
};

const quoteCsvCell = value => {
  let text = formatLogDetails(value);
  // Quoting alone does not stop spreadsheets interpreting untrusted text as formulas.
  // Preserve typed numbers and ISO timestamps; protect formula-prefixed string cells.
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export const serializeSystemLogsCsv = (logs = []) => [
  CSV_COLUMNS.map(([header]) => quoteCsvCell(header)).join(','),
  ...logs.map(log => CSV_COLUMNS.map(([, getValue]) => quoteCsvCell(getValue(log))).join(',')),
].join('\r\n');
