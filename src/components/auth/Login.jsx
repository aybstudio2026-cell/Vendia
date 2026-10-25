import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import VendiaLogo from '../common/VendiaLogo';
import { IconWhatsApp, IconEye, IconEyeOff, FlagIcon } from '../common/Icons';
import Modal from '../common/Modal';

// Configuración de intentos máximos y bloqueo temporal
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 45;

// Configuración de países para selector dinámico y validación telefónica
const COUNTRIES = [
  { code: 'PE', name: 'Perú', dialCode: '+51', maxDigits: 9, placeholder: '987 654 321', regex: /^9\d{8}$/, errorMsg: 'El número de Perú debe tener 9 dígitos y empezar con 9 (ej: 987 654 321).' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', maxDigits: 10, placeholder: '300 123 4567', regex: /^\d{10}$/, errorMsg: 'El número de Colombia debe tener 10 dígitos.' },
  { code: 'CL', name: 'Chile', dialCode: '+56', maxDigits: 9, placeholder: '9 1234 5678', regex: /^\d{9}$/, errorMsg: 'El número de Chile debe tener 9 dígitos.' },
  { code: 'MX', name: 'México', dialCode: '+52', maxDigits: 10, placeholder: '55 1234 5678', regex: /^\d{10}$/, errorMsg: 'El número de México debe tener 10 dígitos.' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', maxDigits: 10, placeholder: '11 1234 5678', regex: /^\d{10}$/, errorMsg: 'El número de Argentina debe tener 10 dígitos.' },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', maxDigits: 9, placeholder: '99 123 4567', regex: /^\d{9}$/, errorMsg: 'El número de Ecuador debe tener 9 dígitos.' },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', maxDigits: 8, placeholder: '70 123 456', regex: /^\d{8}$/, errorMsg: 'El número de Bolivia debe tener 8 dígitos.' },
  { code: 'ES', name: 'España', dialCode: '+34', maxDigits: 9, placeholder: '612 345 678', regex: /^\d{9}$/, errorMsg: 'El número de España debe tener 9 dígitos.' },
  { code: 'US', name: 'EE.UU.', dialCode: '+1', maxDigits: 10, placeholder: '202 555 0123', regex: /^\d{10}$/, errorMsg: 'El número de EE.UU. debe tener 10 dígitos.' }
];

// Formateo visual reactivo según el país (para Perú aplica máscara 987 654 321)
function formatPhoneByCountry(rawVal, country) {
  const digits = (rawVal || '').replace(/\D/g, '').slice(0, country.maxDigits || 9);
  if (country.code === 'PE') {
    // Máscara 987 654 321
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (country.code === 'CL') {
    if (digits.length <= 1) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
    return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`;
  }
  if (country.code === 'CO' || country.code === 'US') {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (country.code === 'MX' || country.code === 'AR') {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (country.code === 'EC') {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  if (country.code === 'BO') {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export default function Login() {
  const { signInWithPassword, resetPassword, triggerLoginSplash } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('PE');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryDropdownRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Contador de intentos fallidos y temporizador regresivo de bloqueo
  const [failedAttempts, setFailedAttempts] = useState(() => {
    try {
      const saved = localStorage.getItem('vendia_login_attempts');
      return saved ? parseInt(saved, 10) : 0;
    } catch (_) {
      return 0;
    }
  });

  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(() => {
    try {
      const lockoutUntil = localStorage.getItem('vendia_login_lockout_until');
      if (lockoutUntil) {
        const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch (_) { }
    return 0;
  });

  // Ticker del temporizador regresivo
  useEffect(() => {
    if (lockoutTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          try {
            localStorage.removeItem('vendia_login_lockout_until');
            localStorage.removeItem('vendia_login_attempts');
          } catch (_) { }
          setFailedAttempts(0);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTimeLeft]);

  // Cierre automático del selector de país al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setIsCountryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCountry = COUNTRIES.find((c) => c.code === selectedCountryCode) || COUNTRIES[0];

  // Validación de requisitos de contraseña
  const hasMinLen = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);

  const passedReqs = (hasMinLen ? 1 : 0) + (hasNumber ? 1 : 0) + (hasUpper ? 1 : 0);
  let strengthLabel = 'Débil';
  let strengthColor = '#ef4444';
  let strengthPct = 33;

  if (passedReqs === 2) {
    strengthLabel = 'Media';
    strengthColor = '#f59e0b';
    strengthPct = 66;
  } else if (passedReqs === 3) {
    strengthLabel = 'Segura';
    strengthColor = '#10b981';
    strengthPct = 100;
  }

  useEffect(() => {
    document.title = mode === 'login' ? 'Vendia | Login' : 'Vendia | Registro';
    setIsCountryOpen(false);
  }, [mode]);

  // Modal de recuperación de contraseña
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Si está bloqueado temporalmente, impedir el intento
    if (mode === 'login' && lockoutTimeLeft > 0) {
      setErrorMsg(`Demasiados intentos fallidos. Espera ${lockoutTimeLeft} segundos...`);
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        try {
          await signInWithPassword(email.trim(), password);
          // Éxito: restablecer intentos fallidos y desbloquear
          try {
            localStorage.removeItem('vendia_login_attempts');
            localStorage.removeItem('vendia_login_lockout_until');
          } catch (_) { }
          setFailedAttempts(0);
          setLockoutTimeLeft(0);
        } catch (loginErr) {
          const nextAttempts = failedAttempts + 1;
          setFailedAttempts(nextAttempts);
          try {
            localStorage.setItem('vendia_login_attempts', nextAttempts.toString());
          } catch (_) { }

          if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
            const lockoutUntil = Date.now() + LOCKOUT_SECONDS * 1000;
            try {
              localStorage.setItem('vendia_login_lockout_until', lockoutUntil.toString());
            } catch (_) { }
            setLockoutTimeLeft(LOCKOUT_SECONDS);
            throw new Error(`Demasiados intentos fallidos. Espera ${LOCKOUT_SECONDS} segundos...`);
          } else {
            const remaining = MAX_FAILED_ATTEMPTS - nextAttempts;
            throw new Error(`Correo o contraseña incorrectos. Intentos restantes antes del bloqueo: ${remaining}`);
          }
        }
      } else {
        // Modo Registro (Sign Up)
        const cleanNombre = nombre.trim() || email.split('@')[0];
        const cleanPhoneDigits = telefono.replace(/\D/g, '');

        // Validación regex estricta según país (para Perú: ^9\d{8}$)
        if (selectedCountry.code === 'PE') {
          if (!/^9\d{8}$/.test(cleanPhoneDigits)) {
            throw new Error('El número en Perú debe tener 9 dígitos y empezar con 9 (ej: 987 654 321).');
          }
        } else if (selectedCountry.regex && !selectedCountry.regex.test(cleanPhoneDigits)) {
          throw new Error(selectedCountry.errorMsg);
        }

        // Validación estricta de fortaleza de contraseña: mínimo 8 caracteres, al menos un número y una mayúscula
        if (!hasMinLen || !hasNumber || !hasUpper) {
          throw new Error('La contraseña debe cumplir con todos los requisitos de seguridad: mínimo 8 caracteres, al menos un número y una letra mayúscula.');
        }

        const fullPhoneFormatted = `${selectedCountry.dialCode} ${telefono.trim()}`;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nombre: cleanNombre,
              telefono: fullPhoneFormatted
            }
          }
        });

        if (error) throw error;

        // Persistir teléfono en caché local asociado al correo
        try {
          if (fullPhoneFormatted) {
            localStorage.setItem(`user_phone_${email.trim().toLowerCase()}`, fullPhoneFormatted);
            localStorage.setItem('vendia_user_phone', fullPhoneFormatted);
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

        {/* MENSAJES DE ERROR / BLOQUEO / ÉXITO */}
        {mode === 'login' && lockoutTimeLeft > 0 ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              color: '#fca5a5',
              fontSize: '12px',
              lineHeight: 1.45,
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '18px', flexShrink: 0 }}>⏳</span>
            <div>
              <strong style={{ color: '#ffffff', display: 'block' }}>Demasiados intentos fallidos</strong>
              Por seguridad, espera <strong style={{ color: '#38bdf8' }}>{lockoutTimeLeft} segundos</strong> antes de volver a intentar.
            </div>
          </div>
        ) : (
          errorMsg && (
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
          )
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Selector Dinámico de País con Banderas SVG Reales */}
                  <div ref={countryDropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsCountryOpen(!isCountryOpen)}
                      disabled={loading}
                      style={{
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        borderRadius: '8px',
                        padding: '0 10px',
                        cursor: 'pointer',
                        color: '#cbd5e1',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        outline: 'none',
                        userSelect: 'none'
                      }}
                    >
                      <FlagIcon code={selectedCountry.code} width={20} height={14} />
                      <span>{selectedCountry.dialCode}</span>
                      <span
                        style={{
                          fontSize: '8px',
                          color: '#94a3b8',
                          transform: isCountryOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        ▼
                      </span>
                    </button>

                    {isCountryOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 5px)',
                          left: 0,
                          zIndex: 50,
                          width: '230px',
                          maxHeight: '230px',
                          overflowY: 'auto',
                          background: '#0d1527',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '10px',
                          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 229, 255, 0.1)',
                          padding: '5px'
                        }}
                      >
                        {COUNTRIES.map((c) => (
                          <div
                            key={c.code}
                            onClick={() => {
                              setSelectedCountryCode(c.code);
                              setTelefono(formatPhoneByCountry(telefono, c));
                              setIsCountryOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '9px',
                              padding: '7px 9px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: c.code === selectedCountryCode ? 'rgba(0, 229, 255, 0.16)' : 'transparent',
                              color: c.code === selectedCountryCode ? '#38bdf8' : '#e2e8f0',
                              fontSize: '12px',
                              transition: 'background 0.12s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (c.code !== selectedCountryCode) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                            }}
                            onMouseLeave={(e) => {
                              if (c.code !== selectedCountryCode) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <FlagIcon code={c.code} width={20} height={14} />
                            <span style={{ flex: 1, fontWeight: c.code === selectedCountryCode ? 600 : 400 }}>
                              {c.name}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                              {c.dialCode}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input con máscara visual reactiva */}
                  <input
                    type="tel"
                    required
                    placeholder={`Ej: ${selectedCountry.placeholder}`}
                    value={telefono}
                    onChange={(e) => setTelefono(formatPhoneByCountry(e.target.value, selectedCountry))}
                    disabled={loading}
                    className="login-dark-input"
                    style={{
                      flex: 1,
                      fontSize: '12.5px',
                      minHeight: '38px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      color: '#ffffff',
                      letterSpacing: '0.4px'
                    }}
                  />
                </div>
                <small style={{ color: '#94a3b8', fontSize: '10px', marginTop: '3px', display: 'block' }}>
                  {selectedCountry.code === 'PE'
                    ? 'Formato Perú: 9 dígitos comenzando con 9 (ej: 987 654 321).'
                    : `País seleccionado: ${selectedCountry.name} (${selectedCountry.dialCode}).`}
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
              disabled={loading || (mode === 'login' && lockoutTimeLeft > 0)}
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
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || (mode === 'login' && lockoutTimeLeft > 0)}
                className="login-dark-input"
                style={{
                  width: '100%',
                  fontSize: '12.5px',
                  minHeight: '38px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#ffffff',
                  paddingRight: '38px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showPassword ? '#38bdf8' : '#94a3b8',
                  transition: 'color 0.15s ease'
                }}
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </label>

          {/* BARRA REACTIVA DE FORTALEZA DE CONTRASEÑA (MODO REGISTRO) */}
          {mode === 'signup' && password.length > 0 && (
            <div
              style={{
                marginTop: '-4px',
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fortaleza:</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: strengthColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {strengthLabel}
                </span>
              </div>

              <div
                style={{
                  height: '4px',
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${strengthPct}%`,
                    background: strengthColor,
                    borderRadius: '2px',
                    transition: 'width 0.3s ease, background-color 0.3s ease'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: hasMinLen ? '#4ade80' : '#64748b' }}>
                  <span>{hasMinLen ? '✓' : '○'}</span>
                  <span>Mínimo 8 caracteres</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: hasUpper ? '#4ade80' : '#64748b' }}>
                  <span>{hasUpper ? '✓' : '○'}</span>
                  <span>Al menos una letra mayúscula (A-Z)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: hasNumber ? '#4ade80' : '#64748b' }}>
                  <span>{hasNumber ? '✓' : '○'}</span>
                  <span>Al menos un número (0-9)</span>
                </div>
              </div>
            </div>
          )}

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
              background: mode === 'login' && lockoutTimeLeft > 0
                ? 'rgba(71, 85, 105, 0.4)'
                : 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
              color: mode === 'login' && lockoutTimeLeft > 0 ? '#94a3b8' : '#ffffff',
              border: mode === 'login' && lockoutTimeLeft > 0 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              borderRadius: '10px',
              boxShadow: mode === 'login' && lockoutTimeLeft > 0 ? 'none' : '0 4px 14px rgba(0, 200, 83, 0.35)',
              cursor: loading || (mode === 'login' && lockoutTimeLeft > 0) ? 'not-allowed' : 'pointer'
            }}
            disabled={loading || (mode === 'login' && lockoutTimeLeft > 0)}
          >
            {loading
              ? 'Verificando...'
              : mode === 'login'
                ? lockoutTimeLeft > 0
                  ? `Bloqueado temporalmente (${lockoutTimeLeft}s)`
                  : 'Iniciar sesión'
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
