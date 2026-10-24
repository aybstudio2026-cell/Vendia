import React, { useEffect, useState } from 'react';
import { IconTrash } from './Icons';

/**
 * ConfirmCornerModal
 * Modal flotante en la esquina inferior derecha para confirmar eliminaciones
 * sin bloquear toda la pantalla con alerts nativos.
 */
export default function ConfirmCornerModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Eliminar elemento?',
  itemName = '',
  itemType = 'elemento',
  description = '',
  confirmText = 'Eliminar',
  cancelText = 'Cancelar'
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
    } catch (err) {
      console.error('Error al confirmar acción:', err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <>
      <style>{`
        @keyframes confirmCornerSlideIn {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .confirm-corner-card {
          animation: confirmCornerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Tarjeta flotante en esquina inferior derecha */}
      <div
        className="confirm-corner-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-corner-title"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 10050,
          width: '390px',
          maxWidth: 'calc(100vw - 32px)',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.95)',
          boxShadow: '0 20px 35px -10px rgba(15, 23, 42, 0.18), 0 10px 15px -5px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(239, 68, 68, 0.08)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          fontFamily: 'inherit'
        }}
      >
        {/* Cabecera del modal */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <IconTrash size={20} color="#dc2626" />
            </div>
            <div>
              <h3
                id="confirm-corner-title"
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a',
                  lineHeight: 1.2
                }}
              >
                {title}
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#dc2626'
                }}
              >
                Acción destructiva
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar modal de confirmación"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '4px 6px',
              borderRadius: '6px',
              fontSize: '14px',
              lineHeight: 1,
              transition: 'color 0.15s ease'
            }}
            title="Cancelar y cerrar"
          >
            ✕
          </button>
        </div>

        {/* Mensaje de confirmación */}
        <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}>
            ¿Estás seguro de que deseas eliminar este {itemType}?
          </p>
          {itemName && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontWeight: 600,
                color: '#0f172a',
                fontSize: '13px',
                wordBreak: 'break-word'
              }}
            >
              "{itemName}"
            </div>
          )}
          {description ? (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>
              {description}
            </p>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Esta acción no se puede deshacer y se borrará de forma definitiva.
            </p>
          )}
        </div>

        {/* Botones de acción */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '6px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <IconTrash size={15} color="#ffffff" />
            <span>{isSubmitting ? 'Eliminando...' : confirmText}</span>
          </button>
        </div>
      </div>
    </>
  );
}
