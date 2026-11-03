import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSystemLogs, formatLogDetails, serializeSystemLogsCsv,
} from '../src/utils/systemLogs.js';

const CSV_HEADER = '"Timestamp","Actor","Action","Resource","IP Address","Status","Details"';

test('detail strings remain exact, including existing JSON strings and newlines', () => {
  for (const value of ['{"attempt":0}', 'First line\nSecond "quoted" line', '']) {
    assert.equal(formatLogDetails(value), value);
  }
});

test('structured details are readable while zero and false are preserved', () => {
  assert.equal(formatLogDetails({ attempts: 0, accepted: false }), '{\n  "attempts": 0,\n  "accepted": false\n}');
  assert.equal(formatLogDetails(['first', 0, false]), '[\n  "first",\n  0,\n  false\n]');
  assert.equal(formatLogDetails(0), '0');
  assert.equal(formatLogDetails(false), 'false');
  assert.equal(formatLogDetails(null), '');
  assert.equal(formatLogDetails(undefined), '');
});

test('search finds actor names, emails, raw timestamps, addresses and nested details', () => {
  const logs = [
    { id: 'a', timestamp: '2026-10-26T08:30:00Z', actor_name: 'Jamie Chen', actor_email: 'jamie@example.test', action: 'USER_UPDATED', ip_address: '192.0.2.10', status: 'SUCCESS', details: { request: { reference: 'CASE-42' } } },
    { id: 'b', actor_name: 'Sam Patel', actor_email: 'sam@example.test', status: 'FAILED', details: 'Permission denied' },
  ];
  for (const query of ['  JAMIE CHEN  ', 'JAMIE@EXAMPLE.TEST', '2026-10-26T08:30', '192.0.2.10', 'case-42', 'user_updated']) {
    assert.deepEqual(filterSystemLogs(logs, query).map(log => log.id), ['a'], query);
  }
  assert.deepEqual(filterSystemLogs(logs, 'permission').map(log => log.id), ['b']);
  assert.deepEqual(filterSystemLogs(logs, 'not present'), []);
});

test('status and search filters compose, with normalized and unknown outcomes', () => {
  const logs = [
    { id: 'a', actor_name: 'Jamie', status: ' success ' },
    { id: 'b', actor_name: 'Jamie', status: 'FAILED' },
    { id: 'c', actor_name: 'Sam', status: null },
    { id: 'd', actor_name: 'Alex', status: '' },
  ];
  assert.deepEqual(filterSystemLogs(logs, 'jamie', ' failed ').map(log => log.id), ['b']);
  assert.deepEqual(filterSystemLogs(logs, '', 'SUCCESS').map(log => log.id), ['a']);
  assert.deepEqual(filterSystemLogs(logs, '', 'UNKNOWN').map(log => log.id), ['c', 'd']);
  assert.deepEqual(filterSystemLogs(logs, 'unknown').map(log => log.id), ['c', 'd']);
  assert.equal(filterSystemLogs(logs, ' ', 'all').length, 4);
});

test('filtering and exporting preserve input records and their original ordering', () => {
  const logs = Object.freeze([
    Object.freeze({ id: 'newer', status: 'SUCCESS', details: Object.freeze({ result: false }) }),
    Object.freeze({ id: 'older', status: 'SUCCESS', details: 'unchanged' }),
  ]);
  const snapshot = JSON.stringify(logs);
  const filtered = filterSystemLogs(logs, '', 'SUCCESS');
  assert.notEqual(filtered, logs);
  assert.equal(filtered[0], logs[0]);
  assert.deepEqual(filtered.map(log => log.id), ['newer', 'older']);
  serializeSystemLogsCsv(filtered);
  assert.equal(JSON.stringify(logs), snapshot);
});

test('an empty CSV retains all seven existing export headers', () => {
  assert.equal(serializeSystemLogsCsv([]), CSV_HEADER);
});

test('CSV quotes commas and embedded newlines, doubles quotes and retains original timestamps', () => {
  const logs = [{
    timestamp: '2026-10-26T08:30:00.123456Z',
    actor_name: 'Jamie "J", Chen', actor_email: 'jamie@example.test',
    action: 'USER_UPDATED', resource: 'user,\n"42"', ip_address: '192.0.2.10',
    status: 'SUCCESS', details: 'First line\nSecond "quoted" line,\nEnd',
  }];
  const row = '"2026-10-26T08:30:00.123456Z","Jamie ""J"", Chen","USER_UPDATED","user,\n""42""","192.0.2.10","SUCCESS","First line\nSecond ""quoted"" line,\nEnd"';
  assert.equal(serializeSystemLogsCsv(logs), CSV_HEADER + '\r\n' + row);
});

test('CSV handles nullable fields, actor fallbacks, nested JSON, zero and false', () => {
  const logs = [
    { actor_email: 'alex@example.test', action: 0, resource: false, details: { attempts: 0, accepted: false } },
    { details: null },
  ];
  const rows = '"","alex@example.test","0","false","","","{\n  ""attempts"": 0,\n  ""accepted"": false\n}"\r\n"","System","","","","",""';
  assert.equal(serializeSystemLogsCsv(logs), CSV_HEADER + '\r\n' + rows);
});

test('untrusted formula-prefixed text is protected even after whitespace or control characters', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-HYPERLINK("example")', '@SUM(1,2)', ' \t=1+1', '\r@SUM(1,2)', '\u0000=1+1', '\u00a0=1+1', '\ufeff=1+1']) {
    const row = { actor_name: value, action: value, resource: value, ip_address: value, status: value, details: value };
    const cell = '"\'' + value.replaceAll('"', '""') + '"';
    assert.equal(serializeSystemLogsCsv([row]), CSV_HEADER + '\r\n' + ['""', cell, cell, cell, cell, cell, cell].join(','), value);
    assert.equal(row.details, value);
  }
});

test('spreadsheet protection leaves ISO dates, typed negative numbers and Unicode unchanged', () => {
  const logs = [{ timestamp: '2026-10-26T08:30:00Z', actor_name: 'José 李', action: -42, resource: false, details: 0 }];
  assert.equal(serializeSystemLogsCsv(logs), CSV_HEADER + '\r\n"2026-10-26T08:30:00Z","José 李","-42","false","","","0"');
});
