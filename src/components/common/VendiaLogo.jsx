import React from 'react';

/**
 * Logotipo oficial de Vendia · by A&B Studio
 * Recreación vectorial matemática idéntica al diseño de marca aprobado:
 * - Monograma 'V' geométrico de precisión:
 *   1) Base y brazo derecho en Cyan Eléctrico (#00E5FF) con corte horizontal superior
 *   2) Flecha ascendente y zigzag central en gradiente Esmeralda (#00C853) a Cyan (#00E5FF)
 *   3) Ala facetada superior izquierda en Verde Esmeralda (#00E676)
 * - Resplandor neon exterior envolvente
 * - Wordmark 'Vendia' en tipografía geométrica pura blanca (#FFFFFF)
 * - Endoso corporativo 'by A&B Studio' en slate (#94A3B8)
 */
export default function VendiaLogo({
  variant = 'full',
  size = 36,
  showSubtitle = true,
  theme = 'dark',
  className = '',
  style = {}
}) {
  const iconWidth = Math.round(size * (220 / 175));
  const isLight = theme === 'light';

  const IconSVG = (
    <svg
      width={iconWidth}
      height={size}
      viewBox="0 0 220 175"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: isLight 
          ? 'drop-shadow(0 2px 6px rgba(0, 200, 83, 0.25))' 
          : 'drop-shadow(0 0 8px rgba(0, 229, 255, 0.45)) drop-shadow(0 0 3px rgba(0, 200, 83, 0.5))',
        flexShrink: 0
      }}
    >
      <defs>
        {/* Gradiente Cyan Eléctrico para el chevron/base derecha */}
        <linearGradient id="vendiaCyanGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="60%" stopColor="#00F5FF" />
          <stop offset="100%" stopColor="#38E1FF" />
        </linearGradient>

        {/* Gradiente Esmeralda a Cyan para la flecha ascendente */}
        <linearGradient id="vendiaArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00C853" />
          <stop offset="35%" stopColor="#00E676" />
          <stop offset="70%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#38E1FF" />
        </linearGradient>

        {/* Gradiente Verde Esmeralda para el ala geométrica izquierda */}
        <linearGradient id="vendiaWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E676" />
          <stop offset="100%" stopColor="#00C853" />
        </linearGradient>
      </defs>

      {/* Shape 0: Chevron inferior 'V' y brazo derecho cyan */}
      <polygon
        points="212,10 188,10 105,146 75,100 66,108 96,163 116,163"
        fill="url(#vendiaCyanGrad)"
      />

      {/* Shape 1: Zigzag central con flecha ascendente de crecimiento financiero */}
      <polygon
        points="160,15 133,27 139,34 105,83 82,51 50,90 58,102 82,75 105,114 149,43 158,44"
        fill="url(#vendiaArrowGrad)"
      />

      {/* Shape 2: Ala geométrica superior izquierda */}
      <polygon
        points="10,28 68,28 77,43 68,54 58,43 38,43 54,69 43,81"
        fill="url(#vendiaWingGrad)"
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div
        className={`vendia-icon-wrapper ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
        title="Vendia · by A&B Studio"
      >
        {IconSVG}
      </div>
    );
  }

  // Variant 'full' u 'horizontal'
  return (
    <div
      className={`vendia-brand-lockup ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        userSelect: 'none',
        ...style
      }}
    >
      {IconSVG}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
              fontWeight: '700',
              fontSize: `${Math.max(21, Math.round(size * 0.72))}px`,
              letterSpacing: '-0.02em',
              color: isLight ? '#0f172a' : '#FFFFFF',
              lineHeight: 1,
              textShadow: isLight ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.45)'
            }}
          >
            Vendia
          </span>
        </div>
        {showSubtitle && (
          <span
            style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontSize: '11px',
              fontWeight: '500',
              letterSpacing: '0.04em',
              color: isLight ? '#64748b' : '#94A3B8',
              marginTop: '4px',
              lineHeight: 1
            }}
          >
            by A&B Studio
          </span>
        )}
      </div>
    </div>
  );
}
