import '../styles/build-statistics.scss';
import React, { useId, useMemo } from 'react';
import {
  Layer, SkeletonText, Table, TableBody, TableCell, TableContainer,
  TableHead, TableHeader, TableRow, Tag, Tile,
} from '@carbon/react';
import { BUILD_STATUS, BUILD_STATUS_CONFIG } from '../utils/constants';

const STATUS_ORDER = Object.keys(BUILD_STATUS_CONFIG);

const getStatusLabel = status => BUILD_STATUS_CONFIG[status]?.label || (
  status === 'UNKNOWN' ? 'Unknown status' : status.toLowerCase().replaceAll('_', ' ')
);

const BuildStatistics = ({ builds = [], loading = false }) => {
  const headingId = useId();
  const statistics = useMemo(() => {
    const items = builds || [];
    const byStatus = new Map();
    const creators = new Set();
    let missingCreators = 0;

    items.forEach(build => {
      const status = (build.status || '').trim().toUpperCase() || 'UNKNOWN';
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
      const creator = build.created_by || build.createdBy;
      if (creator) creators.add(creator);
      else missingCreators += 1;
    });

    const completed = byStatus.get(BUILD_STATUS.CONTRACT_DOWNLOADED) || 0;
    const cancelled = byStatus.get(BUILD_STATUS.CANCELLED) || 0;
    const stages = [...byStatus].sort(([first], [second]) => {
      const firstIndex = STATUS_ORDER.indexOf(first);
      const secondIndex = STATUS_ORDER.indexOf(second);
      return (firstIndex < 0 ? STATUS_ORDER.length : firstIndex)
        - (secondIndex < 0 ? STATUS_ORDER.length : secondIndex)
        || first.localeCompare(second);
    });

    return {
      total: items.length,
      active: items.length - completed - cancelled,
      completed,
      cancelled,
      completionRate: items.length ? Math.round(completed / items.length * 100) : 0,
      creators: creators.size,
      missingCreators,
      stages,
    };
  }, [builds]);

  const metrics = [
    { label: 'Total builds', value: statistics.total, detail: 'All build stages' },
    { label: 'Active builds', value: statistics.active, detail: 'Contract download pending' },
    { label: 'Completed', value: statistics.completed, detail: 'Download acknowledged · ' + statistics.completionRate + '% of total' },
    { label: 'Cancelled', value: statistics.cancelled, detail: 'Builds that were stopped' },
  ];

  return (
    <section className="build-statistics" aria-labelledby={headingId} aria-busy={loading}>
      <div className="build-statistics__heading">
        <h2 id={headingId} className="build-statistics__title">Build overview</h2>
        <p className="build-statistics__description">All builds available to your account.</p>
      </div>

      <dl className="build-statistics__metrics">
        {metrics.map(metric => (
          <Tile key={metric.label} className="build-statistics__metric">
            <dt className="build-statistics__metric-label">{metric.label}</dt>
            <dd className="build-statistics__metric-value">
              {loading ? <SkeletonText heading width="40%" /> : metric.value}
            </dd>
            <dd className="build-statistics__metric-detail">
              {loading ? <SkeletonText width="80%" /> : metric.detail}
            </dd>
          </Tile>
        ))}
      </dl>

      <Tile className="build-statistics__breakdown">
        <div className="build-statistics__breakdown-header">
          <div>
            <h3 className="build-statistics__subtitle">Build stages</h3>
            <p className="build-statistics__description">Counts and share of all available builds.</p>
            {!loading && statistics.missingCreators > 0 && (
              <p className="build-statistics__description">
                Creator information is unavailable for {statistics.missingCreators} {statistics.missingCreators === 1 ? 'build' : 'builds'}.
              </p>
            )}
          </div>
          {!loading && <Tag type="gray" size="sm">
            {statistics.creators} unique {statistics.creators === 1 ? 'creator' : 'creators'}
          </Tag>}
        </div>

        {loading ? (
          <div className="build-statistics__placeholder" role="status">
            <span className="cds--visually-hidden">Loading build overview</span>
            <SkeletonText paragraph lineCount={3} />
          </div>
        ) : statistics.stages.length ? (
          <Layer>
            <TableContainer className="build-statistics__table">
              <Table size="sm" aria-label="Build status breakdown">
                <TableHead>
                  <TableRow>
                    <TableHeader>Stage</TableHeader>
                    <TableHeader className="build-statistics__number">Builds</TableHeader>
                    <TableHeader className="build-statistics__number">Share</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statistics.stages.map(([status, count]) => (
                    <TableRow key={status}>
                      <TableCell>
                        <Tag type={BUILD_STATUS_CONFIG[status]?.kind || 'gray'} size="sm">
                          {getStatusLabel(status)}
                        </Tag>
                      </TableCell>
                      <TableCell className="build-statistics__number">{count}</TableCell>
                      <TableCell className="build-statistics__number">
                        {Math.round(count / statistics.total * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Layer>
        ) : (
          <div className="build-statistics__empty">
            <p>No builds to summarize yet.</p>
            <p className="build-statistics__description">Build stages will appear when a build is available.</p>
          </div>
        )}
      </Tile>
    </section>
  );
};

export default BuildStatistics;
