import React from 'react';
import { IconBell } from './Icons';

export default function AlertBellButton({ alertCount = 0, onOpenAlerts, style = {} }) {
  if (!onOpenAlerts) return null;

  return (
    <button
      type="button"
      className="header-btn bell-btn"
      onClick={onOpenAlerts}
      aria-label="Ver alertas"
      title="Centro de alertas"
      style={{
        width: '42px',
        height: '42px',
        minWidth: '42px',
        padding: 0,
        borderRadius: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--paper)',
        border: '1px solid var(--mist)',
        color: 'var(--ink)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        flexShrink: 0,
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ember)';
        e.currentTarget.style.boxShadow = '0 2px 10px color-mix(in srgb, var(--ember) 18%, transparent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--mist)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
      }}
    >
      <IconBell size={18} />
      {alertCount > 0 && (
        <span
          className="bell-badge"
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            minWidth: '18px',
            height: '18px',
            lineHeight: '18px',
            fontSize: '10px',
            fontWeight: '700',
            borderRadius: '9px',
            background: 'var(--ember)',
            color: 'var(--onacc)',
            padding: '0 4px',
            textAlign: 'center',
            boxShadow: '0 2px 6px color-mix(in srgb, var(--ember) 40%, transparent)'
          }}
        >
          {alertCount}
        </span>
      )}
    </button>
  );
}
