import React, { useEffect, useState } from 'react';
import VendiaAnimatedLogo from './VendiaAnimatedLogo';

/**
 * Pantalla de bienvenida / Splash screen de autenticación exitosa
 * Ocupa el 100% de la pantalla (full-screen) con fondo midnight sólido:
 * - Fondo oscuro medianoche 100% opaco para cubrir completamente el dashboard hasta cargar
 * - Patrón de watermark con el isotipo en wireframe de Vendia repetido en toda la pantalla
 * - Resplandores ambientales neon cian y esmeralda
 * - Logotipo central oficial de Vendia iluminado con efecto neón
 * - Barra de carga sutil con estados y transición suave de desvanecimiento
 */
export default function LoginSplashScreen({ onComplete, duration = 2200 }) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [statusText, setStatusText] = useState('Iniciando sesión...');

  useEffect(() => {
    // Animación fluida de la barra de carga
    const startTime = Date.now();
    const loadDuration = duration - 400; // Deja 400ms para la transición de salida

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / loadDuration) * 100));
      setProgress(pct);

      if (pct > 65 && pct < 100) {
        setStatusText('Cargando espacio de trabajo...');
      } else if (pct >= 100) {
        setStatusText('¡Acceso concedido!');
        clearInterval(interval);
      }
    }, 25);

    // Iniciar desvanecimiento de salida antes de desmontar
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 420);

    // Finalizar y pasar a la aplicación
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 180);
  };

  return (
    <div
      onClick={handleSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#060B17',
        backgroundImage: `
          radial-gradient(circle at 82% 48%, rgba(0, 229, 255, 0.18) 0%, transparent 55%),
          radial-gradient(circle at 18% 55%, rgba(0, 200, 83, 0.12) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(13, 23, 44, 0.6) 0%, transparent 80%),
          linear-gradient(135deg, #050914 0%, #070e1e 50%, #060b18 100%)
        `,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1), transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden'
      }}
      title="Haga clic para continuar de inmediato"
    >
      {/* Patrón Watermark en TODA la pantalla */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.95
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="vendiaFullscreenWatermark"
            width="170"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            {/* Tile 1: Isotipo V en wireframe */}
            <g
              transform="translate(12, 12) scale(0.38)"
              stroke="rgba(0, 229, 255, 0.08)"
              strokeWidth="2.5"
              fill="none"
              strokeLinejoin="round"
            >
              <polygon points="212,10 188,10 105,146 75,100 66,108 96,163 116,163" />
              <polygon points="160,15 133,27 139,34 105,83 82,51 50,90 58,102 82,75 105,114 149,43 158,44" />
              <polygon points="10,28 68,28 77,43 68,54 58,43 38,43 54,69 43,81" />
            </g>

            {/* Tile 2: Isotipo V alternado (staggered) */}
            <g
              transform="translate(97, 72) scale(0.38)"
              stroke="rgba(0, 229, 255, 0.08)"
              strokeWidth="2.5"
              fill="none"
              strokeLinejoin="round"
            >
              <polygon points="212,10 188,10 105,146 75,100 66,108 96,163 116,163" />
              <polygon points="160,15 133,27 139,34 105,83 82,51 50,90 58,102 82,75 105,114 149,43 158,44" />
              <polygon points="10,28 68,28 77,43 68,54 58,43 38,43 54,69 43,81" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#vendiaFullscreenWatermark)" />
      </svg>

      {/* Resplandor central envolvente */}
      <div
        style={{
          position: 'absolute',
          width: '520px',
          height: '520px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 229, 255, 0.18) 0%, rgba(0, 200, 83, 0.08) 45%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          animation: 'pulseGlow 3.5s ease-in-out infinite alternate'
        }}
      />

      {/* Contenedor Central del Logo y Loader */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'logoPop 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* LOGO ANIMADO DE VENDIA (Flecha en movimiento cinético que dibuja el isotipo y revela la marca) */}
        <div style={{ marginBottom: '32px' }}>
          <VendiaAnimatedLogo size={105} showWordmark={true} replayOnClick={false} />
        </div>

        {/* Barra de progreso de carga sutil */}
        <div
          style={{
            width: '240px',
            height: '4px',
            borderRadius: '99px',
            background: 'rgba(255, 255, 255, 0.12)',
            overflow: 'hidden',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #00C853 0%, #00E5FF 100%)',
              borderRadius: '99px',
              boxShadow: '0 0 16px rgba(0, 229, 255, 0.95)',
              transition: 'width 0.1s linear'
            }}
          />
        </div>

        {/* Texto de Estado */}
        <div
          style={{
            fontSize: '13.5px',
            fontWeight: 500,
            color: '#94a3b8',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: progress >= 100 ? '#00C853' : '#00E5FF',
              boxShadow: `0 0 10px ${progress >= 100 ? '#00C853' : '#00E5FF'}`,
              transition: 'background 0.3s'
            }}
          />
          <span>{statusText}</span>
        </div>
      </div>

      {/* Indicador discreto para saltar */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          fontSize: '11.5px',
          color: 'rgba(255, 255, 255, 0.3)',
          letterSpacing: '0.05em',
          pointerEvents: 'none'
        }}
      >
        Haga clic en cualquier lugar para continuar
      </div>

      <style>{`
        @keyframes logoPop {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes pulseGlow {
          0% {
            transform: scale(0.95);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
