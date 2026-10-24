import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import VendiaLogo from '../common/VendiaLogo';
import { IconWhatsApp } from '../common/Icons';
import Modal from '../common/Modal';

export default function Login() {
  const { signInWithPassword, resetPassword, triggerLoginSplash } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = mode === 'login' ? 'Vendia | Login' : 'Vendia | Registro';
  }, [mode]);

  // Modal de recuperación de contraseña
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithPassword(email.trim(), password);
      } else {
        // Modo Registro (Sign Up)
        const cleanNombre = nombre.trim() || email.split('@')[0];
        const cleanTelefono = telefono.trim();

        if (cleanTelefono && cleanTelefono.replace(/\D/g, '').length < 8) {
          throw new Error('Por favor ingresa un número de teléfono o WhatsApp válido (mínimo 8 dígitos).');
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nombre: cleanNombre,
              telefono: cleanTelefono
            }
          }
        });

        if (error) throw error;

        // Persistir teléfono en caché local asociado al correo
        try {
          if (cleanTelefono) {
            localStorage.setItem(`user_phone_${email.trim().toLowerCase()}`, cleanTelefono);
            localStorage.setItem('vendia_user_phone', cleanTelefono);
          }
        } catch (_) { }

        if (data?.session) {
          // Sesión iniciada automáticamente
          if (triggerLoginSplash) triggerLoginSplash();
          setSuccessMsg('Cuenta creada exitosamente.');
        } else {
          setSuccessMsg(
            '¡Cuenta creada exitosamente! Revisa tu bandeja de entrada si tu configuración requiere confirmar tu correo.'
          );
        }
      }
    } catch (err) {
      console.error(err);
      if (err.message.includes('Invalid login credentials')) {
        setErrorMsg('Correo o contraseña incorrectos.');
      } else if (err.message.includes('User already registered')) {
        setErrorMsg('Este correo ya está registrado. Intenta iniciar sesión.');
      } else {
        setErrorMsg(err.message || 'Error al procesar la solicitud.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    try {
      await resetPassword(resetEmail.trim());
      setResetStatus('Te hemos enviado un correo para restablecer tu contraseña.');
    } catch (err) {
      setResetStatus(err.message || 'Error al enviar el correo de recuperación.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '36px 16px',
        backgroundColor: '#060B17',
        backgroundImage: `
          radial-gradient(circle at 82% 45%, rgba(0, 229, 255, 0.16) 0%, transparent 55%),
          radial-gradient(circle at 18% 55%, rgba(0, 200, 83, 0.13) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(13, 23, 44, 0.7) 0%, transparent 80%),
          linear-gradient(135deg, #050914 0%, #070e1e 50%, #060b18 100%)
        `,
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      <style>{`
        @keyframes floatLoginCard {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-9px);
          }
          100% {
            transform: translateY(0px);
          }
        }
        @keyframes pulseAmbientGlow {
          0%, 100% {
            opacity: 0.55;
            transform: scale(0.96);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.05);
          }
        }
        @keyframes driftWatermark {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(170px, 120px);
          }
        }
        .vendia-login-card {
          animation: floatLoginCard 5.5s ease-in-out infinite;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .vendia-login-card:hover {
          animation-play-state: paused;
        }
        .login-dark-input:focus {
          border-color: #00C853 !important;
          box-shadow: 0 0 0 2px rgba(0, 200, 83, 0.25) !important;
          outline: none !important;
        }
      `}</style>

      {/* PATRÓN WATERMARK EN TODO EL FONDO DE LA PANTALLA */}
      <svg
        style={{
          position: 'absolute',
          inset: '-120px',
          width: 'calc(100% + 240px)',
          height: 'calc(100% + 240px)',
          pointerEvents: 'none',
          opacity: 0.95
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="vendiaLoginWatermark"
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
        <g style={{ animation: 'driftWatermark 60s linear infinite' }}>
          <rect width="100%" height="100%" fill="url(#vendiaLoginWatermark)" />
        </g>
      </svg>

      {/* RESPLANDOR AMBIENTAL DETRÁS DE LA TARJETA */}
      <div
        style={{
          position: 'absolute',
          width: '540px',
          height: '540px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 229, 255, 0.14) 0%, rgba(0, 200, 83, 0.08) 50%, transparent 70%)',
          filter: 'blur(75px)',
          pointerEvents: 'none',
          animation: 'pulseAmbientGlow 4.5s ease-in-out infinite'
        }}
      />

      {/* TARJETA ELEGANTE Y ANIMADA (OBSIDIAN GLASS - NO AZULADA) */}
      <div
        className="vendia-login-card"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '430px',
          padding: '34px 30px',
          background: 'rgba(11, 18, 32, 0.86)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '18px',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.65), 0 0 25px rgba(0, 229, 255, 0.08)'
        }}
      >
        {/* LOGO DE VENDIA Y TÍTULO */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <VendiaLogo variant="full" size={42} theme="dark" showSubtitle={true} />
          </div>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '12px',
              color: '#94a3b8',
              lineHeight: 1.4
            }}
          >
            {mode === 'login'
              ? 'Inicia sesión con tus credenciales de tienda'
              : 'Registra tu cuenta y mantengamos tu comercio conectado'}
          </p>
        </div>

        {/* SWITCHER SEGMENTADO (INICIAR SESIÓN / REGISTRARSE) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            background: 'rgba(2, 6, 23, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '20px'
          }}
        >
          <button
            type="button"
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: mode === 'login' ? 700 : 500,
              color: mode === 'login' ? '#ffffff' : '#64748b',
              background: mode === 'login' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              border: 'none',
              borderRadius: '7px',
              boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: mode === 'signup' ? 700 : 500,
              color: mode === 'signup' ? '#ffffff' : '#64748b',
              background: mode === 'signup' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              border: 'none',
              borderRadius: '7px',
              boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => {
              setMode('signup');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Registrarse
          </button>
        </div>

        {/* MENSAJES DE ERROR / ÉXITO */}
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.16)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: '12px',
              lineHeight: 1.4,
              marginBottom: '18px'
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.16)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              color: '#86efac',
              fontSize: '12px',
              lineHeight: 1.4,
              marginBottom: '18px'
            }}
          >
            {successMsg}
          </div>
        )}

        {/* FORMULARIO */}
        <form className="f" onSubmit={handleSubmit} style={{ gap: '14px' }}>
          {mode === 'signup' && (
            <>
              <label>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Nombre completo del dueño:
                </span>
                <input
                  required
                  placeholder="Ej: Lucía Ramos"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={loading}
                  className="login-dark-input"
                  style={{
                    fontSize: '12.5px',
                    minHeight: '38px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    color: '#ffffff'
                  }}
                />
              </label>

              <label>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <IconWhatsApp size={13} color="#25D366" />
                  Número de WhatsApp / Teléfono:
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '8px',
                      padding: '0 10px',
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#94a3b8',
                      userSelect: 'none'
                    }}
                  >
                    🇵🇪 +51
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="Ej: 987 654 321"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    disabled={loading}
                    className="login-dark-input"
                    style={{
                      flex: 1,
                      fontSize: '12.5px',
                      minHeight: '38px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      color: '#ffffff'
                    }}
                  />
                </div>
                <small style={{ color: '#94a3b8', fontSize: '10px', marginTop: '3px', display: 'block' }}>
                  Te avisaremos directamente por WhatsApp para activar y coordinar tu comercio.
                </small>
              </label>
            </>
          )}

          <label>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
              Correo electrónico:
            </span>
            <input
              type="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="login-dark-input"
              style={{
                fontSize: '12.5px',
                minHeight: '38px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                color: '#ffffff'
              }}
            />
          </label>

          <label>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
              Contraseña:
            </span>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="login-dark-input"
              style={{
                fontSize: '12.5px',
                minHeight: '38px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                color: '#ffffff'
              }}
            />
          </label>

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-4px' }}>
              <button
                type="button"
                className="btn g"
                style={{ fontSize: '11.5px', padding: 0, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  setResetEmail(email);
                  setResetStatus('');
                  setIsResetOpen(true);
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="btn p"
            style={{
              width: '100%',
              marginTop: '6px',
              minHeight: '40px',
              fontSize: '12.5px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(0, 200, 83, 0.35)',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading
              ? 'Verificando...'
              : mode === 'login'
                ? 'Iniciar sesión'
                : 'Crear cuenta de comercio'}
          </button>
        </form>
      </div>

      {/* PIE DE PÁGINA / SEGURIDAD */}
      <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '11px', color: '#64748b', zIndex: 10 }}>
        <span>Vendia Cloud · Conexión segura SSL · by A&B Studio</span>
      </div>

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        maxWidth={450}
        style={{
          background: 'rgba(11, 18, 32, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '18px',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.75), 0 0 25px rgba(0, 229, 255, 0.1)',
          color: '#ffffff',
          padding: 0
        }}
        contentStyle={{
          padding: '28px 24px'
        }}
      >
        <div
          className="no-scrollbar"
          style={{
            maxHeight: '82vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(0, 200, 83, 0.12)',
                border: '1px solid rgba(0, 200, 83, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00C853',
                flexShrink: 0
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Recuperar Contraseña
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Acceso y seguridad de tu cuenta Vendia
              </span>
            </div>
          </div>

          <p style={{ margin: '12px 0 16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
            Ingresa tu correo registrado y te enviaremos un enlace seguro para restablecer tu contraseña.
          </p>

          {resetStatus && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: resetStatus.includes('Error') ? 'rgba(239, 68, 68, 0.16)' : 'rgba(34, 197, 94, 0.16)',
                border: `1px solid ${resetStatus.includes('Error') ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.35)'}`,
                fontSize: '12px',
                color: resetStatus.includes('Error') ? '#fca5a5' : '#86efac',
                marginBottom: '14px',
                lineHeight: 1.4
              }}
            >
              {resetStatus}
            </div>
          )}

          <form className="f" onSubmit={handleResetSubmit} style={{ gap: '14px' }}>
            <label>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                Correo electrónico:
              </span>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="login-dark-input"
                style={{
                  fontSize: '12.5px',
                  minHeight: '38px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#ffffff'
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                style={{
                  minHeight: '38px',
                  padding: '0 16px',
                  fontSize: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  minHeight: '38px',
                  padding: '0 20px',
                  background: 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '12px',
                  boxShadow: '0 3px 12px rgba(0, 200, 83, 0.3)',
                  cursor: 'pointer'
                }}
              >
                Enviar enlace
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
