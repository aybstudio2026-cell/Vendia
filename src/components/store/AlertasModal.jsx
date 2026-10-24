import React from 'react';
import Modal from '../common/Modal';
import { IconAlertTriangle, IconTag, IconReceipt } from '../common/Icons';

export default function AlertasModal({
  isOpen,
  onClose,
  alertas = [],
  readSet = new Set(),
  onMarkRead,
  onMarkAllRead,
  onDeleteAlert
}) {
  const unreadAlerts = alertas.filter((a) => !readSet.has(a.id || a.key) && !a.leida);
  const unreadCount = unreadAlerts.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth={480} contentStyle={{ padding: '22px 24px' }}>
      {/* Cabecera del Modal */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--mist)',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Centro de Alertas
          </h2>
          {unreadCount > 0 ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.28)'
              }}
            >
              {unreadCount} {unreadCount === 1 ? 'nueva' : 'nuevas'}
            </span>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                padding: '2px 8px',
                borderRadius: '12px'
              }}
            >
              Al día
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'var(--fog)',
            border: '1px solid var(--mist)',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--graphite)',
            cursor: 'pointer',
            fontSize: '12px',
            padding: 0
          }}
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* Lista de Alertas */}
      {alertas.length > 0 ? (
        <div
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '2px'
          }}
        >
          {alertas.map((a) => {
            const alertId = a.id || a.key;
            const isUnread = !readSet.has(alertId) && !a.leida;
            const isAgotado = (a.mensaje || '').toLowerCase().includes('agotado') || a.tipo === 'agotado';
            const isPago = (a.mensaje || '').toLowerCase().includes('pago') || a.tipo === 'pago';

            return (
              <div
                key={alertId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: isUnread ? 'var(--paper)' : 'var(--fog)',
                  border: isUnread
                    ? isAgotado
                      ? '1px solid rgba(239, 68, 68, 0.35)'
                      : '1px solid color-mix(in srgb, var(--ember) 35%, var(--mist))'
                    : '1px solid var(--mist)',
                  boxShadow: isUnread ? '0 2px 8px rgba(0, 0, 0, 0.04)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Icono de severidad */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isAgotado
                      ? 'rgba(239, 68, 68, 0.12)'
                      : isPago
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: isAgotado ? '#ef4444' : isPago ? '#2563eb' : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {isAgotado ? (
                    <IconAlertTriangle size={16} />
                  ) : isPago ? (
                    <IconReceipt size={16} />
                  ) : (
                    <IconTag size={16} />
                  )}
                </div>

                {/* Contenido del Mensaje */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12.5px',
                      fontWeight: isUnread ? '600' : '400',
                      color: isUnread ? 'var(--ink)' : 'var(--graphite)',
                      lineHeight: 1.35
                    }}
                  >
                    {a.mensaje || a.text}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    {isUnread ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          color: isAgotado ? '#ef4444' : 'var(--ember)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        ● No leída
                      </span>
                    ) : (
                      <span style={{ fontSize: '10.5px', color: 'var(--pewter)' }}>
                        ✓ Leída
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones de la Alerta: Marcar leída + Eliminar con X */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {isUnread && onMarkRead && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(alertId)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--mist)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: '500',
                        color: 'var(--graphite)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--ink)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--fog)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--graphite)';
                        e.currentTarget.style.borderColor = 'var(--mist)';
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Marcar como leída"
                    >
                      Leída
                    </button>
                  )}

                  {/* Botón X para eliminar alerta sin confirmación */}
                  {onDeleteAlert && (
                    <button
                      type="button"
                      onClick={() => onDeleteAlert(alertId)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'var(--pewter)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '700',
                        transition: 'all 0.15s ease',
                        padding: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.color = 'var(--pewter)';
                      }}
                      title="Eliminar alerta (sin confirmación)"
                      aria-label="Eliminar alerta"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            color: 'var(--graphite)'
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</div>
          <b style={{ color: 'var(--ink)', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
            No tienes alertas pendientes
          </b>
          <span style={{ fontSize: '12px' }}>
            Todo el inventario y cobros de tu tienda están en orden.
          </span>
        </div>
      )}

      {/* Acciones al pie del modal */}
      <div
        style={{
          marginTop: '20px',
          paddingTop: '14px',
          borderTop: '1px solid var(--mist)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        {unreadCount > 0 && onMarkAllRead ? (
          <button
            type="button"
            className="btn p"
            onClick={onMarkAllRead}
            style={{ fontSize: '12px', minHeight: '34px', padding: '6px 14px' }}
          >
            Marcar todas como leídas
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          className="btn o"
          onClick={onClose}
          style={{ fontSize: '12px', minHeight: '34px', padding: '6px 14px' }}
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
