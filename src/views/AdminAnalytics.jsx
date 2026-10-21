import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DonutChart, GroupedBarChart } from '@carbon/charts-react';
import {
  Tile, Tabs, TabList, Tab, TabPanels, TabPanel, Button, Tag,
  InlineNotification, Layer, useTheme,
} from '@carbon/react';
import { ArrowRight, CheckmarkFilled, Renew, WarningAlt } from '@carbon/icons-react';
import CredentialRotation from '../components/CredentialRotation';
import { FullPageLoader } from '../components/LoadingSpinner';
import { ErrorStatePanel, StatePanel } from '../components/StatePanel';
import userService from '../services/userService';
import buildService from '../services/buildService';
import { BUILD_STATUS, BUILD_STATUS_CONFIG } from '../utils/constants';
import { getRoleLabel, sortRolesByPriority } from '../utils/roles';
import { getCredentialHealth } from '../utils/credentialHealth';

const CHART_TOOLBAR_CONTROLS = [
  { type: 'Export as CSV' }, { type: 'Export as PNG' },
  { type: 'Export as JPG' }, { type: 'Make fullscreen' },
];
const STATUS_COLORS = {
  gray: '#525252', purple: '#8a3ffc', blue: '#0f62fe', cyan: '#1192e8',
  teal: '#009d9a', green: '#24a148', red: '#da1e28',
};
const TERMINAL_STATUSES = new Set([
  BUILD_STATUS.FINALIZED, BUILD_STATUS.CONTRACT_DOWNLOADED, BUILD_STATUS.CANCELLED,
]);

const AdminAnalytics = () => {
  const { theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState(0);
  const [credentialFilter, setCredentialFilter] = useState('attention');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [builds, setBuilds] = useState([]);

  const loadAnalytics = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [nextUsers, nextBuilds] = await Promise.all([
        userService.listUsers(), buildService.getBuilds(),
      ]);
      setUsers(nextUsers);
      setBuilds(nextBuilds);
      setHasLoaded(true);
    } catch (err) {
      setError(err.message || 'Unable to refresh analytics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAnalytics({ showLoader: true }); }, [loadAnalytics]);

  // Derive counts together so the review table always agrees with the overview.
  const health = useMemo(() => getCredentialHealth(users), [users]);
  const activeUsers = users.filter(user => user.is_active).length;
  const activeBuilds = builds.filter(build => !TERMINAL_STATUSES.has(build.status)).length;
  const readyContracts = builds.filter(build => build.status === BUILD_STATUS.FINALIZED).length;
  const downloadedContracts = builds.filter(build => build.status === BUILD_STATUS.CONTRACT_DOWNLOADED).length;

  const buildCounts = useMemo(() => builds.reduce((counts, build) => {
    const status = build.status || 'UNKNOWN';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {}), [builds]);
  const donutData = useMemo(() => Object.entries(buildCounts).map(([status, value]) => ({
    group: BUILD_STATUS_CONFIG[status]?.label || status.replace(/_/g, ' '), value,
  })), [buildCounts]);
  const donutOptions = useMemo(() => ({
    title: 'Build stages', theme, resizable: true, height: '360px',
    donut: { center: { label: 'Builds' } },
    legend: { truncation: { type: 'none' } },
    toolbar: { controls: CHART_TOOLBAR_CONTROLS },
    color: { scale: Object.fromEntries(Object.keys(buildCounts).map(status => [
      BUILD_STATUS_CONFIG[status]?.label || status.replace(/_/g, ' '),
      STATUS_COLORS[BUILD_STATUS_CONFIG[status]?.kind] || STATUS_COLORS.gray,
    ])) },
  }), [buildCounts, theme]);

  const barData = useMemo(() => {
    const counts = {};
    users.forEach(user => {
      const roles = user.roles?.length ? [...new Set(user.roles)] : ['Unassigned'];
      roles.forEach(role => {
        counts[role] ||= { enabled: 0, disabled: 0 };
        counts[role][user.is_active ? 'enabled' : 'disabled'] += 1;
      });
    });
    return sortRolesByPriority(Object.keys(counts)).flatMap(role => [
      { group: 'Enabled', key: getRoleLabel(role), value: counts[role].enabled },
      { group: 'Disabled', key: getRoleLabel(role), value: counts[role].disabled },
    ]);
  }, [users]);
  const barOptions = useMemo(() => ({
    title: 'Users by role', theme, resizable: true, height: '360px',
    axes: {
      left: { mapsTo: 'key', scaleType: 'labels', truncation: { type: 'none' } },
      bottom: { mapsTo: 'value', includeZero: true, ticks: { formatter: value => Number.isInteger(value) ? value : '' } },
    },
    bars: { maxWidth: 18 },
    color: { scale: { Enabled: '#0f62fe', Disabled: '#8d8d8d' } },
    toolbar: { controls: CHART_TOOLBAR_CONTROLS },
  }), [theme]);

  const reviewCredentials = filter => {
    setCredentialFilter(filter);
    setSelectedTab(1);
  };
  const pageHeader = (
    <header className="analytics-header">
      <div className="analytics-header__copy">
        <h1 className="analytics-header__title">Admin diagnostics & analytics</h1>
        <p className="analytics-header__description">Monitor build activity and keep account credentials up to date.</p>
      </div>
      <Button kind="tertiary" size="md" renderIcon={Renew}
        disabled={loading || refreshing} onClick={() => loadAnalytics()}>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
    </header>
  );

  if (loading) {
    return <div className="app-page app-page--wide analytics-page">{pageHeader}<FullPageLoader description="Loading analytics…" /></div>;
  }
  if (error && !hasLoaded) {
    return (
      <div className="app-page app-page--wide analytics-page">
        {pageHeader}
        <ErrorStatePanel title="Unable to load analytics" description={error}
          action={<Button onClick={() => loadAnalytics({ showLoader: true })}>Retry</Button>} />
      </div>
    );
  }

  return (
    <div className="app-page app-page--wide analytics-page">
      {pageHeader}
      {error && <InlineNotification className="analytics-notification" kind="error" lowContrast hideCloseButton
        title="Refresh failed" subtitle={`${error} Showing the last loaded data.`} />}
      <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
        <TabList aria-label="Admin analytics tabs" contained>
          <Tab>Overview</Tab>
          <Tab>Credential health</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Layer className="analytics-content">
              <section aria-labelledby="analytics-health-heading">
                <Tile className="analytics-health">
                  <div className="analytics-section-header">
                    <div>
                      <div className="analytics-health__title">
                        {health.attentionUsers ? <WarningAlt size={20} /> : <CheckmarkFilled size={20} />}
                        <h2 id="analytics-health-heading" className="analytics-section-heading">Credential health</h2>
                        <Tag size="sm" type={health.attentionUsers ? 'warm-gray' : 'green'}>
                          {health.attentionUsers ? 'Needs attention' : activeUsers ? 'Up to date' : 'No enabled users'}
                        </Tag>
                      </div>
                      <p className="analytics-section-copy">
                        {health.attentionUsers
                          ? `${health.attentionUsers} enabled ${health.attentionUsers === 1 ? 'user needs' : 'users need'} a credential update or review.`
                          : 'No credential issues found for enabled accounts.'}
                      </p>
                    </div>
                    <Button kind="ghost" size="md" renderIcon={ArrowRight} onClick={() => reviewCredentials('attention')}>Review credentials</Button>
                  </div>
                  <div className="analytics-health__metrics">
                    {[
                      { label: 'Passwords to review', value: health.attentionPasswords, detail: 'Expired, update required or expiry unavailable', filter: 'password' },
                      { label: 'Public keys to review', value: health.attentionKeys, detail: 'Expired, unregistered or expiry unavailable', filter: 'key' },
                      { label: 'Users expiring soon', value: health.expiringUsers, detail: 'Password or public key expires within 30 days', filter: 'soon' },
                    ].map(metric => (
                      <div className="analytics-health__metric" key={metric.label}>
                        <p className="analytics-metric-label">{metric.label}</p>
                        <p className="analytics-metric-value">{metric.value}</p>
                        <p className="analytics-section-copy">{metric.detail}</p>
                        <Button kind="ghost" size="sm" renderIcon={ArrowRight} onClick={() => reviewCredentials(metric.filter)}>
                          {metric.filter === 'soon' ? 'View upcoming expiries' : `Review ${metric.filter === 'key' ? 'public keys' : 'passwords'}`}
                        </Button>
                      </div>
                    ))}
                  </div>
                </Tile>
              </section>

              <section aria-labelledby="analytics-activity-heading">
                <h2 id="analytics-activity-heading" className="analytics-section-heading analytics-section-title">Activity overview</h2>
                <div className="analytics-metrics">
                  {[
                    { label: 'Total users', value: users.length, detail: `${activeUsers} enabled · ${users.length - activeUsers} disabled` },
                    { label: 'Active builds', value: activeBuilds, detail: `${builds.length} builds in total` },
                    { label: 'Ready to download', value: readyContracts, detail: 'Finalized contracts awaiting download' },
                    { label: 'Downloaded contracts', value: downloadedContracts, detail: 'Contract download acknowledged' },
                  ].map(metric => (
                    <Tile className="analytics-metric" key={metric.label}>
                      <h3 className="analytics-metric-label">{metric.label}</h3>
                      <p className="analytics-metric-value">{metric.value}</p>
                      <p className="analytics-section-copy">{metric.detail}</p>
                    </Tile>
                  ))}
                </div>
              </section>

              <section className="analytics-charts" aria-label="Build and user distributions">
                <Tile className="analytics-chart">
                  {builds.length ? <DonutChart data={donutData} options={donutOptions} /> : (
                    <StatePanel title="No builds yet" description="Build stages will appear here when a build is created." />
                  )}
                </Tile>
                <Tile className="analytics-chart">
                  {users.length ? <>
                    <GroupedBarChart data={barData} options={barOptions} />
                    <p className="analytics-section-copy analytics-chart-note">Users with several roles appear in each role.</p>
                  </> : <StatePanel title="No users yet" description="The role distribution will appear here when users are added." />}
                </Tile>
              </section>
            </Layer>
          </TabPanel>
          <TabPanel>
            <Layer className="analytics-content">
              <CredentialRotation key={credentialFilter} health={health} initialFilter={credentialFilter}
                refreshing={refreshing} onRefresh={loadAnalytics} />
            </Layer>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default AdminAnalytics;
