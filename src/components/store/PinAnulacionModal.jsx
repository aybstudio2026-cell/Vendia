import React, { useState } from 'react';
import Modal from '../common/Modal';

export default function PinAnulacionModal({
  isOpen,
  onClose,
  pinData = { pin: null, usos_restantes: 0 },
  onGenerateNewPin,
  loading = false
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pin = pinData?.pin;
  const usos = pinData?.usos_restantes ?? 0;
  const hasPin = Boolean(pin && usos > 0);

  const handleCopy = () => {
    if (!pin) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const getBadgeStyle = () => {
    if (usos === 3) return { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)' };
    if (usos === 2) return { bg: 'rgba(234, 179, 8, 0.15)', text: '#d97706', border: 'rgba(234, 179, 8, 0.3)' };
    if (usos === 1) return { bg: 'rgba(249, 115, 22, 0.15)', text: '#ea580c', border: 'rgba(249, 115, 22, 0.3)' };
    return { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)' };
  };

  const badge = getBadgeStyle();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🛡️ PIN de Autorización de Anulaciones"
      maxWidth={460}
      centerTitle={true}
    >
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <p className="lead" style={{ fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.45, color: 'var(--graphite, #94a3b8)' }}>
          Código de seguridad para que tus cajeros puedan anular comprobantes emitidos.
          Cada código permite un <strong>máximo de 3 usos</strong>.
        </p>

        {/* Display del PIN de 6 dígitos */}
        <div
          style={{
            background: hasPin ? 'var(--fog, rgba(0,0,0,0.03))' : 'rgba(239, 68, 68, 0.08)',
            border: `2px dashed ${hasPin ? 'var(--ember, #059669)' : '#ef4444'}`,
            borderRadius: '16px',
            padding: '24px 16px',
            margin: '0 auto 16px auto',
            maxWidth: '340px',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {hasPin ? (
            <>
              <div
                className="price-display tabular-nums"
                style={{
                  fontSize: '40px',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  color: 'var(--ink, #ffffff)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  marginBottom: '10px'
                }}
              >
                {pin.slice(0, 3)} {pin.slice(3, 6)}
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`
                  }}
                >
                  ● {usos} {usos === 1 ? 'uso restante' : 'usos restantes'} (de 3)
                </span>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn g s"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  title="Copiar PIN"
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ color: '#ef4444' }}>
              <div style={{ fontSize: '28px', marginBottom: '4px' }}>🔒</div>
              <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                Sin PIN activo o usos agotados
              </strong>
              <p style={{ fontSize: '12px', margin: 0, color: 'var(--graphite, #94a3b8)' }}>
                Genera un nuevo código para habilitar hasta 3 anulaciones.
              </p>
            </div>
          )}
        </div>

        {/* Explicación de política de seguridad */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--ink, #ffffff)',
            textAlign: 'left',
            marginBottom: '20px',
            lineHeight: 1.5
          }}
        >
          💡 <strong>Regla de negocio:</strong> Proporciona este código de 6 dígitos a tu cajero cuando justifique una devolución o anulación. Para la 4ª anulación, el sistema bloqueará la acción y te exigirá generar un nuevo PIN.
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn p"
            onClick={onGenerateNewPin}
            disabled={loading}
            style={{ minHeight: '44px', flex: 1 }}
          >
            {loading ? 'Generando...' : hasPin ? '🔄 Generar nuevo PIN (3 usos)' : '⚡ Generar PIN de 6 dígitos'}
          </button>
          <button
            type="button"
            className="btn o"
            onClick={onClose}
            style={{ minHeight: '44px', minWidth: '90px' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
