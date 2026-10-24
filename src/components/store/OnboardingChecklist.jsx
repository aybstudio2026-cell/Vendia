import React, { useState } from 'react';
import { IconCheck } from '../common/Icons';

/**
 * Widget de Primeros Pasos (Onboarding Checklist) para Tiendas Nuevas
 * Guía interactiva de configuración inicial de inventario, paleta, empleados y primera venta.
 */
export default function OnboardingChecklist({
  products = [],
  sales = [],
  employees = [],
  palette = 'brex',
  onNavigateTab,
  onOpenPaletteModal
}) {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem('onboarding_dismissed_v1') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Pasos calculados
  const steps = [
    {
      id: 'products',
      title: 'Registra tus primeros productos',
      description: 'Agrega manualmente o importa tu inventario desde un archivo Excel.',
      done: products.length > 0,
      actionLabel: 'Ir a Inventario',
      onAction: () => onNavigateTab && onNavigateTab('inventario')
    },
    {
      id: 'palette',
      title: 'Personaliza la paleta de colores',
      description: 'Elige la identidad visual de tu marca para tickets y modo oscuro.',
      done: palette !== 'brex',
      actionLabel: 'Elegir Paleta',
      onAction: () => onOpenPaletteModal && onOpenPaletteModal()
    },
    {
      id: 'employees',
      title: 'Invita a tus cajeros o empleados',
      description: 'Controla accesos por turnos y limita funciones según el rol.',
      done: employees.length > 1,
      actionLabel: 'Configurar Negocio',
      onAction: () => onNavigateTab && onNavigateTab('negocio')
    },
    {
      id: 'sale',
      title: 'Realiza tu primera venta en caja',
      description: 'Prueba la velocidad del escáner, atajos de teclado y boleta térmica.',
      done: sales.length > 0,
      actionLabel: 'Ir a Vender (POS)',
      onAction: () => onNavigateTab && onNavigateTab('vender')
    }
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Si ya completó todos los pasos o lo descartó, no estorbar
  if (isDismissed || (completedCount === steps.length && !isCollapsed)) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('onboarding_dismissed_v1', 'true');
    } catch (e) {}
  };

  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--mist)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCollapsed ? 0 : 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>🚀 Primeros pasos para tu tienda</h3>
            <span
              className="chip"
              style={{
                background: progressPercent === 100 ? '#10b981' : 'color-mix(in srgb, var(--ember) 14%, transparent)',
                color: progressPercent === 100 ? '#fff' : 'var(--ember)',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              {completedCount} de {steps.length} completados ({progressPercent}%)
            </span>
          </div>
          {!isCollapsed && (
            <p className="hint" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              Completa esta lista para empezar a vender sin contratiempos.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn o s"
            style={{ fontSize: '11px', padding: '2px 8px' }}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? 'Mostrar lista' : 'Plegar'}
          </button>
          <button
            type="button"
            className="btn o s"
            style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--pewter)' }}
            onClick={handleDismiss}
            title="Ocultar esta guía permanentemente"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      {!isCollapsed && (
        <>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'var(--fog)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginBottom: '16px'
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100 ? '#10b981' : 'var(--ember)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>

          {/* Pasos */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px'
            }}
          >
            {steps.map((st) => (
              <div
                key={st.id}
                style={{
                  border: `1px solid ${st.done ? '#10b981' : 'var(--mist)'}`,
                  background: st.done ? 'rgba(16, 185, 129, 0.04)' : 'var(--paper)',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: st.done ? '#10b981' : 'var(--fog)',
                        color: st.done ? '#fff' : 'var(--graphite)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {st.done ? '✓' : '•'}
                    </div>
                    <b style={{ fontSize: '13px', textDecoration: st.done ? 'line-through' : 'none', color: st.done ? 'var(--pewter)' : 'var(--ink)' }}>
                      {st.title}
                    </b>
                  </div>
                  <p className="hint" style={{ margin: 0, fontSize: '11px', lineHeight: 1.3 }}>
                    {st.description}
                  </p>
                </div>

                {!st.done ? (
                  <button
                    type="button"
                    className="btn o s"
                    onClick={st.onAction}
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: '11px',
                      padding: '3px 8px',
                      marginTop: '4px'
                    }}
                  >
                    {st.actionLabel} →
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    ✓ ¡Completado!
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
