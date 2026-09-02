import React from 'react';

export default function UrgencyBadge({ level }) {
  const normalized = (level || 'NORMAL').toUpperCase();

  const config = {
    CRITICAL: {
      label: 'CRITIQUE',
      icon: '🚨',
      className: 'badge-critical',
      bg: '#451a1a',
      color: '#f87171',
      border: '1px solid #dc2626'
    },
    URGENT: {
      label: 'URGENT',
      icon: '⚡',
      className: 'badge-urgent',
      bg: '#3b2512',
      color: '#fbbf24',
      border: '1px solid #d97706'
    },
    NORMAL: {
      label: 'NORMAL',
      icon: '🟢',
      className: 'badge-normal',
      bg: '#14291e',
      color: '#4ade80',
      border: '1px solid #16a34a'
    }
  };

  const current = config[normalized] || config.NORMAL;

  const isCritical = normalized === 'CRITICAL';

  return (
    <span
      className={isCritical ? 'pulse-glow' : ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: '700',
        letterSpacing: '0.03em',
        backgroundColor: current.bg,
        color: current.color,
        border: current.border,
        boxShadow: isCritical ? '0 0 10px rgba(220, 38, 38, 0.4)' : 'none',
        whiteSpace: 'nowrap'
      }}
    >
      <span>{current.icon}</span>
      <span>{current.label}</span>
    </span>
  );
}
