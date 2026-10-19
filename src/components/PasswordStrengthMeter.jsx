import React, { useMemo } from 'react';
import { Tag } from '@carbon/react';
import { CheckmarkFilled, SubtractAlt } from '@carbon/icons-react';

/**
 * PasswordStrengthMeter Component
 * Displays password strength with visual feedback and criteria checklist.
 * Follows IBM Carbon Design System patterns.
 *
 * Layout (always below the input):
 *   1. 5 discrete segment bar (one per criterion)
 *   2. Strength Tag + "N/5 met" count on one line
 *   3. Thin divider
 *   4. Criteria checklist
 */

const PASSWORD_CRITERIA = [
  { id: 'length',    label: 'At least 12 characters',          test: (p) => p.length >= 12 },
  { id: 'uppercase', label: 'Contains uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'Contains lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number',    label: 'Contains number (0-9)',           test: (p) => /[0-9]/.test(p) },
  { id: 'special',   label: 'Contains special character (@$!%*?&)', test: (p) => /[@$!%*?&]/.test(p) },
];

/** Maps metCount → Carbon Tag type + label */
const STRENGTH_MAP = [
  { type: 'red',    label: 'Very weak' },  // 0
  { type: 'red',    label: 'Weak'      },  // 1
  { type: 'purple', label: 'Fair'      },  // 2
  { type: 'cyan',   label: 'Fair'      },  // 3
  { type: 'teal',   label: 'Good'      },  // 4
  { type: 'green',  label: 'Strong'    },  // 5
];

/** Segment fill color per met-count bucket (Carbon design tokens) */
const SEGMENT_COLORS = [
  'var(--cds-support-error, #da1e28)',       // 0–1 met  → red
  'var(--cds-support-error, #da1e28)',
  'var(--cds-support-warning, #f1c21b)',     // 2 met    → yellow
  'var(--cds-support-info, #0043ce)',        // 3 met    → blue
  'var(--cds-support-success, #24a148)',     // 4 met    → green
  'var(--cds-support-success, #24a148)',     // 5 met    → green
];

const calculateStrength = (password) => {
  if (!password) return { checks: {}, metCount: 0 };
  const checks = {};
  let metCount = 0;
  PASSWORD_CRITERIA.forEach(({ id, test }) => {
    const met = test(password);
    checks[id] = met;
    if (met) metCount++;
  });
  return { checks, metCount };
};

export const PasswordStrengthMeter = ({
  password = '',
  showCriteria = true,
  className = '',
}) => {
  const { checks, metCount } = useMemo(() => calculateStrength(password), [password]);

  if (!password) return null;

  const { type: tagType, label: strengthLabel } = STRENGTH_MAP[metCount];
  const segmentColor = SEGMENT_COLORS[metCount];

  return (
    <div className={`psm ${className}`}>
      {/* ── Segment bar ── */}
      <div
        className="psm__segments"
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={metCount}
        style={{
          display: 'flex',
          gap: '4px',
          height: '6px',
          minHeight: '6px',
          marginBottom: '0.5rem',
          width: '100%',
        }}
      >
        {PASSWORD_CRITERIA.map(({ id }, i) => (
          <div
            key={id}
            className="psm__segment"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: '6px',
              borderRadius: '3px',
              backgroundColor: i < metCount
                ? segmentColor
                : 'var(--cds-border-subtle-01, #c6c6c6)',
            }}
          />
        ))}
      </div>

      {/* ── Strength label row ── */}
      <div className="psm__meta">
        <Tag type={tagType} size="sm" className="psm__tag">{strengthLabel}</Tag>
        <span className="psm__count">{metCount}/{PASSWORD_CRITERIA.length} criteria met</span>
      </div>

      {/* ── Criteria checklist ── */}
      {showCriteria && (
        <ul className="psm__list">
          {PASSWORD_CRITERIA.map(({ id, label }) => {
            const met = checks[id];
            return (
              <li key={id} className={`psm__item${met ? ' psm__item--met' : ''}`}>
                {met
                  ? <CheckmarkFilled size={16} className="psm__icon psm__icon--ok" />
                  : <SubtractAlt     size={16} className="psm__icon psm__icon--unmet" />
                }
                <span>{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const isPasswordStrong = (password) => {
  const { metCount } = calculateStrength(password);
  return metCount === PASSWORD_CRITERIA.length;
};

/** Alias kept for backwards-compat with UserManagement / PasswordManager */
export const isPasswordValid = isPasswordStrong;

export default PasswordStrengthMeter;
