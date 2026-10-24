import React, { useState, useEffect } from 'react';

/**
 * VendiaAnimatedLogo
 * Componente interactivo y reutilizable de alta fidelidad.
 * Animación:
 * 1. La flecha de luz neon emerge y traza el camino dinámico del isotipo V.
 * 2. Al alcanzar el ápice, se produce un destello de luz esmeralda/cian.
 * 3. Las facetas del logotipo se materializan y cristalizan en su posición oficial.
 * 4. El texto "Vendia" y el endoso "by A&B Studio" se revelan con un brillo suave.
 *
 * Props:
 * - size: tamaño en píxeles del isotipo (default: 110)
 * - showWordmark: boolean (default: true)
 * - autoPlay: boolean (default: true)
 * - replayOnClick: boolean (default: true)
 * - onAnimationEnd: callback opcional
 */
export default function VendiaAnimatedLogo({
  size = 110,
  showWordmark = true,
  autoPlay = true,
  replayOnClick = true,
  className = '',
  style = {},
  onAnimationEnd = null
}) {
  const [animationKey, setAnimationKey] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleRestart = () => {
    setIsCompleted(false);
    setAnimationKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (autoPlay) {
      const timer = setTimeout(() => {
        setIsCompleted(true);
        if (onAnimationEnd) onAnimationEnd();
      }, 2100);
      return () => clearTimeout(timer);
    }
  }, [animationKey, autoPlay, onAnimationEnd]);

  // Proporciones dinámicas
  const svgWidth = Math.round(size * 1.257);
  const svgHeight = size;
  const vendiaFontSize = Math.max(22, Math.round(size * 0.58));
  const subtitleFontSize = Math.max(11, Math.round(vendiaFontSize * 0.28));

  return (
    <div
      key={animationKey}
      onClick={replayOnClick ? handleRestart : undefined}
      className={`vendia-animated-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${Math.round(size * 0.18)}px`,
        cursor: replayOnClick ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative',
        ...style
      }}
      title={replayOnClick ? 'Haz clic para reproducir la animación' : 'Vendia'}
    >
      {/* ISOTIPO VECTORIAL ANIMADO */}
      <div style={{ position: 'relative', width: svgWidth, height: svgHeight, flexShrink: 0 }}>
        {/* Destello de energía central cuando la flecha alcanza el ápice */}
        <div
          className="arrow-energy-flash"
          style={{
            position: 'absolute',
            top: '8%',
            left: '68%',
            width: `${Math.round(size * 0.5)}px`,
            height: `${Math.round(size * 0.5)}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 229, 255, 0.95) 0%, rgba(0, 200, 83, 0.6) 40%, transparent 70%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />

        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox="0 0 220 175"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'relative',
            zIndex: 2,
            overflow: 'visible'
          }}
        >
          <defs>
            {/* Gradientes Oficiales de Vendia */}
            <linearGradient id="animCyanGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="60%" stopColor="#00F5FF" />
              <stop offset="100%" stopColor="#38E1FF" />
            </linearGradient>

            <linearGradient id="animArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00C853" />
              <stop offset="35%" stopColor="#00E676" />
              <stop offset="70%" stopColor="#00E5FF" />
              <stop offset="100%" stopColor="#38E1FF" />
            </linearGradient>

            <linearGradient id="animWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00E676" />
              <stop offset="100%" stopColor="#00C853" />
            </linearGradient>

            {/* Filtro Neón Glow Intenso */}
            <filter id="neonGlowEffect" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#00E5FF" floodOpacity="0.8" />
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#00C853" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* 1. TRAZO GUÍA / LUZ DE LA FLECHA EN MOVIMIENTO */}
          <path
            className="arrow-flight-trail"
            d="M 50 90 L 82 51 L 105 114 L 160 15"
            fill="none"
            stroke="url(#animArrowGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#neonGlowEffect)"
          />

          {/* 2. CABEZA DE FLECHA LUMINOSA QUE RECORRE LA RUTA */}
          <g className="arrow-lead-spark">
            <polygon
              points="160,15 133,27 139,34 149,43 158,44"
              fill="#00F5FF"
              filter="url(#neonGlowEffect)"
            />
          </g>

          {/* 3. FORMA SÓLIDA 1: ZIGZAG CENTRAL CON LA FLECHA FINAL */}
          <polygon
            className="facet-arrow-solid"
            points="160,15 133,27 139,34 105,83 82,51 50,90 58,102 82,75 105,114 149,43 158,44"
            fill="url(#animArrowGrad)"
            filter="drop-shadow(0 0 14px rgba(0, 229, 255, 0.7))"
          />

          {/* 4. FORMA SÓLIDA 0: CHEVRON INFERIOR 'V' Y BRAZO DERECHO CIAN */}
          <polygon
            className="facet-chevron-solid"
            points="212,10 188,10 105,146 75,100 66,108 96,163 116,163"
            fill="url(#animCyanGrad)"
            filter="drop-shadow(0 0 12px rgba(0, 229, 255, 0.6))"
          />

          {/* 5. FORMA SÓLIDA 2: ALA GEOMÉTRICA SUPERIOR IZQUIERDA */}
          <polygon
            className="facet-wing-solid"
            points="10,28 68,28 77,43 68,54 58,43 38,43 54,69 43,81"
            fill="url(#animWingGrad)"
            filter="drop-shadow(0 0 8px rgba(0, 200, 83, 0.6))"
          />
        </svg>
      </div>

      {/* BLOQUE DE TEXTO CON APARICIÓN SUAVE */}
      {showWordmark && (
        <div
          className="wordmark-reveal-block"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
        >
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: `${vendiaFontSize}px`,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
              lineHeight: 0.96,
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.65)'
            }}
          >
            Vendia
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: `${subtitleFontSize}px`,
              letterSpacing: '-0.01em',
              color: '#94A3B8',
              marginTop: `${Math.max(2, Math.round(size * 0.04))}px`,
              lineHeight: 1
            }}
          >
            by A&B Studio
          </span>
        </div>
      )}

      {/* ESTILOS Y KEYFRAMES DE LA ANIMACIÓN */}
      <style>{`
        /* Trazo de luz que dibuja la trayectoria de la flecha */
        .arrow-flight-trail {
          stroke-dasharray: 260;
          stroke-dashoffset: 260;
          animation: drawArrowFlight 0.75s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          opacity: 1;
        }

        /* Spark que viaja en la punta de la flecha */
        .arrow-lead-spark {
          opacity: 0;
          transform-origin: 160px 15px;
          animation: sparkFlight 0.75s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        /* Destello cuando la flecha impacta en el ápice */
        .arrow-energy-flash {
          opacity: 0;
          transform: scale(0.2);
          animation: energyBurst 0.6s ease-out 0.65s forwards;
        }

        /* Materialización de la flecha sólida */
        .facet-arrow-solid {
          opacity: 0;
          transform-origin: 105px 83px;
          transform: scale(0.92);
          animation: materializeFacet 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.68s forwards;
        }

        /* Materialización del chevron cian */
        .facet-chevron-solid {
          opacity: 0;
          transform-origin: 105px 146px;
          transform: translateY(12px) scale(0.94);
          animation: materializeChevron 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards;
        }

        /* Materialización del ala esmeralda */
        .facet-wing-solid {
          opacity: 0;
          transform-origin: 43px 54px;
          transform: translateX(-10px) scale(0.9);
          animation: materializeWing 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.95s forwards;
        }

        /* Revelación del texto Vendia y el endoso */
        .wordmark-reveal-block {
          opacity: 0;
          transform: translateX(-12px);
          animation: wordmarkReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) 1.05s forwards;
        }

        /* KEYFRAMES */
        @keyframes drawArrowFlight {
          0% {
            stroke-dashoffset: 260;
            opacity: 1;
          }
          85% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0;
          }
        }

        @keyframes sparkFlight {
          0% {
            opacity: 0;
            transform: translate(-100px, 80px) scale(0.4);
          }
          20% {
            opacity: 1;
            transform: translate(-60px, 50px) scale(0.7);
          }
          80% {
            opacity: 1;
            transform: translate(0, 0) scale(1.15);
          }
          100% {
            opacity: 0;
            transform: translate(0, 0) scale(1);
          }
        }

        @keyframes energyBurst {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          40% {
            opacity: 1;
            transform: scale(1.4);
          }
          100% {
            opacity: 0;
            transform: scale(2.2);
          }
        }

        @keyframes materializeFacet {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          70% {
            opacity: 1;
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes materializeChevron {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.94);
          }
          70% {
            opacity: 1;
            transform: translateY(-2px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes materializeWing {
          0% {
            opacity: 0;
            transform: translateX(-10px) scale(0.9);
          }
          70% {
            opacity: 1;
            transform: translateX(2px) scale(1.03);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes wordmarkReveal {
          0% {
            opacity: 0;
            transform: translateX(-12px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
