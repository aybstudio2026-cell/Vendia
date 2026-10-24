import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import {
  money,
  fd,
  PERIODICIDAD,
  PALETTES,
  DEFAULT_PAYMENT_METHODS,
  getCustomSwatches
} from '../../constants/palettes';
import {
  IconWhatsApp,
  IconPagos,
  IconTiendas,
  IconDownload,
  IconLock,
  IconLockOpen,
  IconCheck
} from '../common/Icons';
import { resolveStorePlan, getSaaSPlanes } from '../../services/saasService';
import { getStoreLogoStorage } from '../../constants/categories';

const SYSTEM_MODULES = [
  { key: 'inventario', label: 'Inventario' },
  { key: 'ventas', label: 'Ventas & Caja' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'escaner', label: 'Escáner de barras' },
  { key: 'compras', label: 'Compras' }
];

export default function DetalleTiendaModal({
  isOpen,
  onClose,
  store,
  profiles = [],
  onRegisterPayment,
  onToggleSuspension,
  onToggleModule,
  onAssignOwner,
  onUpdatePaymentMethods,
  onUpdatePlan,
  onImpersonateStore,
  onExportStoreData
}) {
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState(store?.plan || '');
  const [currentMonto, setCurrentMonto] = useState(store?.monto || null);

  // Estados para blindar el botón de Registrar Pago
  const [isConfirmPayOpen, setIsConfirmPayOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [payMethod, setPayMethod] = useState('Yape / Plin');

  useEffect(() => {
    if (store) {
      setSelectedPlanCode(store.plan || '');
      setCurrentMonto(store.monto);
    }
  }, [store?.plan, store?.monto, store?.id]);

  const handleExecutePayment = async () => {
    if (isProcessingPayment) return;
    try {
      setIsProcessingPayment(true);
      const montoToPay = currentMonto != null ? currentMonto : store.monto;
      if (onRegisterPayment) {
        await onRegisterPayment(
          store.id,
          store.contrato_id,
          montoToPay,
          payMethod,
          `Renovación registrada desde detalle de tienda (${store.nombre})`
        );
      }
      setPaymentSuccess(true);
      setTimeout(() => {
        setPaymentSuccess(false);
        setIsProcessingPayment(false);
        setIsConfirmPayOpen(false);
      }, 1200);
    } catch (err) {
      console.error('Error al registrar pago:', err);
      alert('Error al registrar pago: ' + (err.message || 'Intente nuevamente'));
      setIsProcessingPayment(false);
    }
  };

  // Métodos de pago configurables para esta tienda
  const getInitialMethods = () => {
    if (Array.isArray(store?.metodos_pago) && store.metodos_pago.length > 0) {
      return store.metodos_pago;
    }
    try {
      const cached = localStorage.getItem(`tienda_${store?.id}_metodos_pago`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_PAYMENT_METHODS;
  };

  const [activeMethods, setActiveMethods] = useState(getInitialMethods);
  const [newMethodInput, setNewMethodInput] = useState('');
  const [methodsSaved, setMethodsSaved] = useState(false);

  useEffect(() => {
    setActiveMethods(getInitialMethods());
  }, [store?.id, store?.metodos_pago]);

  if (!store) return null;

  const planes = getSaaSPlanes();
  const resolvedPlan = resolveStorePlan(selectedPlanCode || store.plan, currentMonto != null ? currentMonto : store.monto, store.modulos);
  const storeLogo = store.logo_url || store.logo || getStoreLogoStorage(store.id);

  const handlePlanClick = (plan) => {
    setSelectedPlanCode(plan.codigo);
    setCurrentMonto(plan.precio);
    if (onUpdatePlan) {
      onUpdatePlan(store.id, plan);
    }
  };

  const handleTogglePaymentMethod = (method) => {
    let next;
    if (activeMethods.includes(method)) {
      if (activeMethods.length <= 1) {
        alert('Debe mantener al menos un método de pago habilitado.');
        return;
      }
      next = activeMethods.filter((m) => m !== method);
    } else {
      next = [...activeMethods, method];
    }
    setActiveMethods(next);
    if (onUpdatePaymentMethods) {
      onUpdatePaymentMethods(store.id, next);
    }
    setMethodsSaved(true);
    setTimeout(() => setMethodsSaved(false), 2500);
  };

  const handleAddCustomMethod = (e) => {
    e.preventDefault();
    const clean = newMethodInput.trim();
    if (!clean) return;
    if (activeMethods.map((m) => m.toLowerCase()).includes(clean.toLowerCase())) {
      alert('Ese método de pago ya existe en la lista.');
      return;
    }
    const next = [...activeMethods, clean];
    setActiveMethods(next);
    setNewMethodInput('');
    if (onUpdatePaymentMethods) {
      onUpdatePaymentMethods(store.id, next);
    }
    setMethodsSaved(true);
    setTimeout(() => setMethodsSaved(false), 2500);
  };

  const palObj = PALETTES.find((p) => p.id === store.paleta) || PALETTES[0];
  const palSwatches = store.paleta === 'custom'
    ? getCustomSwatches(store.paleta_custom || {})
    : palObj.swatches;

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!selectedProfileId) return;
    onAssignOwner(store.id, selectedProfileId);
    setIsAssigning(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${store.nombre}`}
      maxWidth={660}
    >
      <div
        className="no-scrollbar"
        style={{
          maxHeight: '82vh',
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          paddingRight: '2px'
        }}
      >
        {/* CABECERA: LOGO COMERCIAL DE LA EMPRESA, NOMBRE Y DUEÑO */}
        <div style={{
          background: 'var(--fog)',
          border: '1px solid var(--mist)',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Logo oficial de la empresa o Inicial de la tienda */}
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={store.nombre}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: '1px solid var(--mist)',
                  background: 'var(--paper)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  flexShrink: 0
                }}
              />
            ) : (
              <span
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
                title={`Logo / Inicial comercial de ${store.nombre}`}
              >
                {store.nombre.charAt(0).toUpperCase()}
              </span>
            )}

            <div>
              {/* Nombre comercial y estado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '16px', color: 'var(--ink)' }}>{store.nombre}</b>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '99px',
                  background: store.estado === 'activa' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: store.estado === 'activa' ? '#15803d' : '#dc2626',
                  border: `1px solid ${store.estado === 'activa' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {store.estado === 'activa' ? '● Activa' : '● Suspendida'}
                </span>
              </div>

              {/* Dueño de la tienda */}
              <div style={{ fontSize: '12px', color: 'var(--graphite)', marginTop: '3px' }}>
                <span>Dueño: </span>
                <strong style={{ color: 'var(--ink)' }}>{store.dueno || 'Sin dueño asignado'}</strong>
                {' · '}
                <span className="hint">{store.dueno_correo || store.email || 'Sin correo registrado'}</span>
              </div>
            </div>
          </div>

          {onAssignOwner && (
            <button
              type="button"
              className="btn o s"
              onClick={() => setIsAssigning(!isAssigning)}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }}
            >
              {isAssigning ? 'Cancelar' : 'Cambiar dueño'}
            </button>
          )}
        </div>

        {/* FORMULARIO DESPLEGABLE PARA CAMBIAR DUEÑO */}
        {isAssigning && (
          <form onSubmit={handleAssignSubmit} style={{ padding: '12px 14px', background: 'var(--paper)', border: '1px solid var(--mist)', borderRadius: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--graphite)', marginBottom: 6, display: 'block' }}>
              Vincular usuario registrado existente como nuevo Dueño:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                required
                style={{ flex: 1, minHeight: '36px', fontSize: '12.5px', padding: '6px 10px', borderRadius: '8px' }}
              >
                <option value="">-- Elige un usuario registrado --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.correo})
                  </option>
                ))}
              </select>
              <button type="submit" className="btn p s" style={{ whiteSpace: 'nowrap', padding: '0 14px' }}>
                Confirmar dueño
              </button>
            </div>
          </form>
        )}

        {/* SECCIÓN 1: SUSCRIPCIÓN Y PLAN SAAS */}
        <div style={{
          background: 'var(--fog)',
          border: '1px solid var(--mist)',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Suscripción SaaS
            </span>
            <span className="chip" style={{
              fontSize: '11px',
              fontWeight: 700,
              background: 'rgba(0, 229, 255, 0.15)',
              color: '#0284c7',
              borderColor: 'transparent'
            }}>
              {resolvedPlan.nombre} ({resolvedPlan.badge || 'Plan'})
            </span>
          </div>

          {/* Grilla de Datos de Facturación */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '8px',
            background: 'var(--paper)',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid var(--mist)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--pewter)', display: 'block' }}>Tarifa actual</span>
              {(currentMonto === 0 || (!currentMonto && store.monto === 0) || resolvedPlan.codigo === 'gratuito') ? (
                <b style={{ fontSize: '13.5px', color: '#16a34a' }}>
                  Gratis (S/. 0.00) <small style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--graphite)' }}>/ 7d prueba</small>
                </b>
              ) : (
                <b style={{ fontSize: '14px', color: 'var(--ink)' }}>
                  {money(currentMonto != null ? currentMonto : store.monto)} <small style={{ fontSize: '11px', fontWeight: 400, color: 'var(--graphite)' }}>/ {PERIODICIDAD[store.periodicidad_meses || store.per] || 'mes'}</small>
                </b>
              )}
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--pewter)', display: 'block' }}>Inicio contrato</span>
              <b style={{ fontSize: '13px', color: 'var(--ink)' }}>
                {fd(store.fecha_inicio || store.inicio)}
              </b>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--pewter)', display: 'block' }}>Próximo cobro</span>
              <b style={{ fontSize: '13px', color: '#0284c7' }}>
                {fd(store.proximo_pago || store.proximo)}
              </b>
            </div>
          </div>

          {/* Banner de Ayuda para Tienda en Prueba Gratuita */}
          {resolvedPlan.codigo === 'gratuito' && (
            <div style={{
              background: 'rgba(0, 229, 255, 0.07)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11.5px',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '16px' }}>⚡</span>
              <div>
                <b style={{ color: '#0284c7' }}>Tienda en periodo de prueba gratuita (7 días).</b>
                <div style={{ color: 'var(--graphite)', marginTop: '2px', fontSize: '11px' }}>
                  Cuando el dueño decida comprar, cámbiale el plan con un clic abajo (Emprendedor, Pro o Full) y registra su pago de suscripción con el botón verde.
                </div>
              </div>
            </div>
          )}

          {/* Selector de Plan SaaS */}
          {onUpdatePlan && (
            <div>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                Cambiar Plan SaaS vinculado:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                {planes.map((p) => {
                  const isSelected = resolvedPlan.id === p.id || resolvedPlan.codigo === p.codigo || selectedPlanCode === p.codigo;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePlanClick(p)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #00E5FF' : '1px solid var(--mist)',
                        background: isSelected ? 'rgba(0, 229, 255, 0.08)' : 'var(--paper)',
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? '#0284c7' : 'inherit' }}>
                        {isSelected ? '✓ ' : ''}{p.nombre}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--graphite)', marginTop: '2px' }}>
                        {p.precio === 0 ? 'Gratis (7 días)' : `${money(p.precio)}/m`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN 2: MÓDULOS HABILITADOS (SIN EMOJIS, CON TOGGLES MODERNOS) */}
        <div style={{
          background: 'var(--fog)',
          border: '1px solid var(--mist)',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Módulos Habilitados
            </span>
            <span className="hint" style={{ fontSize: '11px' }}>
              {(store.modulos || []).length} activos
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SYSTEM_MODULES.map((m) => {
              const isAct = (store.modulos || []).includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onToggleModule(store.id, m.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isAct ? '1px solid #16a34a' : '1px solid var(--mist)',
                    background: isAct ? 'rgba(34, 197, 94, 0.1)' : 'var(--paper)',
                    color: isAct ? '#15803d' : 'var(--graphite)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  title={isAct ? 'Clic para desactivar' : 'Clic para activar'}
                >
                  <span>{m.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{isAct ? '✓' : '+'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 3: MÉTODOS DE PAGO POS */}
        <div style={{
          background: 'var(--fog)',
          border: '1px solid var(--mist)',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Métodos de pago en POS (Caja)
            </span>
            {methodsSaved && (
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>
                ✓ ¡Actualizado para esta tienda!
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia'].map((stdMethod) => {
              const isAct = activeMethods.includes(stdMethod);
              return (
                <button
                  key={stdMethod}
                  type="button"
                  onClick={() => handleTogglePaymentMethod(stdMethod)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: isAct ? '1px solid var(--ink)' : '1px solid var(--mist)',
                    background: isAct ? 'var(--paper)' : 'transparent',
                    color: isAct ? 'var(--ink)' : 'var(--pewter)',
                    fontSize: '12px',
                    fontWeight: isAct ? 600 : 400,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{isAct ? '✓' : '+'}</span>
                  <span>{stdMethod}</span>
                </button>
              );
            })}

            {/* Métodos personalizados */}
            {activeMethods
              .filter((m) => !['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia'].includes(m))
              .map((custMethod) => (
                <span
                  key={custMethod}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--ink)',
                    background: 'var(--paper)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>✓ {custMethod}</span>
                  <button
                    type="button"
                    onClick={() => handleTogglePaymentMethod(custMethod)}
                    style={{
                      background: 'none',
                      border: 0,
                      cursor: 'pointer',
                      color: 'var(--pewter)',
                      fontWeight: 'bold',
                      padding: 0
                    }}
                    title={`Eliminar ${custMethod}`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>

          {/* Formulario para agregar nuevo método */}
          <form onSubmit={handleAddCustomMethod} style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <input
              type="text"
              placeholder="Nuevo método (ej: Fiado, Dólares)"
              value={newMethodInput}
              onChange={(e) => setNewMethodInput(e.target.value)}
              style={{ flex: 1, minHeight: '34px', fontSize: '12px', padding: '4px 10px', borderRadius: '6px' }}
            />
            <button type="submit" className="btn o s" style={{ fontSize: '12px', padding: '4px 12px', whiteSpace: 'nowrap' }}>
              + Agregar método
            </button>
          </form>
        </div>

        {/* SECCIÓN 4: ÚLTIMOS PAGOS Y PALETA DE COLORES (2 COLUMNAS) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px'
        }}>
          {/* Últimos pagos */}
          <div style={{
            background: 'var(--fog)',
            border: '1px solid var(--mist)',
            borderRadius: '12px',
            padding: '12px 14px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '8px' }}>
              Últimos pagos registrados
            </span>
            {(() => {
              const ultimosPagos = (store.pagos || [])
                .map((p) => ({
                  ...p,
                  fechaValida: p.fecha_pago || p.fecha || p.creado_en
                }))
                .sort((a, b) => new Date(b.fechaValida || 0) - new Date(a.fechaValida || 0))
                .slice(0, 3);

              if (ultimosPagos.length === 0) {
                return <span className="hint" style={{ fontSize: '11.5px', display: 'block' }}>Sin pagos registrados aún</span>;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {ultimosPagos.map((p, idx) => (
                    <div key={p.id || idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      background: 'var(--paper)',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      border: '1px solid var(--mist)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--graphite)', fontWeight: 500 }}>
                          {fd(p.fechaValida)}
                        </span>
                        {p.metodo && (
                          <span className="chip" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                            {p.metodo}
                          </span>
                        )}
                      </div>
                      <b style={{ color: '#16a34a', fontWeight: 700 }}>+{money(p.monto)}</b>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Paleta visual de la tienda */}
          <div style={{
            background: 'var(--fog)',
            border: '1px solid var(--mist)',
            borderRadius: '12px',
            padding: '12px 14px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '8px' }}>
              Paleta y Diseño de Tienda
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--paper)',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--mist)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="sw" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                  {palSwatches.map((c, i) => (
                    <i key={i} style={{ background: c, width: '14px', height: '14px' }} />
                  ))}
                </span>
                <b style={{ fontSize: '12px', color: 'var(--ink)' }}>
                  {store.paleta === 'custom' ? 'Personalizada' : palObj.name}
                </b>
              </div>
              <span className="chip" style={{ fontSize: '10px' }}>Tema</span>
            </div>
          </div>
        </div>

        {/* ACCIONES DEL MODAL (FOOTER REDISEÑADO & ELEGANTE) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginTop: '6px',
          paddingTop: '14px',
          borderTop: '1px solid var(--mist)'
        }}>
          {/* Fila 1: Botones Operativos en Grid Adaptable */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px'
          }}>
            <button
              type="button"
              disabled={isProcessingPayment}
              onClick={() => {
                if (!isProcessingPayment) {
                  setIsConfirmPayOpen(true);
                }
              }}
              style={{
                height: '40px',
                background: paymentSuccess
                  ? '#059669'
                  : isProcessingPayment
                  ? '#0d9488'
                  : 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                boxShadow: paymentSuccess
                  ? '0 2px 8px rgba(5, 150, 105, 0.4)'
                  : '0 2px 8px rgba(0, 200, 83, 0.28)',
                fontWeight: 700,
                fontSize: '12.5px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                cursor: isProcessingPayment ? 'not-allowed' : 'pointer',
                opacity: isProcessingPayment ? 0.85 : 1,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isProcessingPayment) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 200, 83, 0.35)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 200, 83, 0.28)';
              }}
            >
              {isProcessingPayment ? (
                <>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                      display: 'inline-block'
                    }}
                  />
                  <span>Procesando pago...</span>
                </>
              ) : paymentSuccess ? (
                <>
                  <IconCheck size={16} color="#ffffff" />
                  <span>¡Pago registrado!</span>
                </>
              ) : (
                <>
                  <IconPagos size={16} color="#ffffff" />
                  <span>Registrar pago</span>
                </>
              )}
            </button>

            <button
              type="button"
              style={{
                height: '40px',
                background: '#25D366',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.32)',
                fontWeight: 700,
                fontSize: '12.5px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.42)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 211, 102, 0.32)';
              }}
              onClick={() => {
                const prox = fd(store.proximo_pago || store.proximo);
                const montoFmt = money(store.monto);
                let msg = `Hola ${store.dueno || 'estimado cliente'}, te saludamos de la administración del sistema.\n\n`;
                msg += `Te recordamos cordialmente que la suscripción de tu tienda *${store.nombre}* por el monto de *${montoFmt}* vence el *${prox}*.\n\n`;
                msg += `Agradecemos enviar tu comprobante de pago por este medio para mantener tu servicio 100% activo. ¡Muchas gracias!`;

                const phone = (store.dueno_telefono || store.telefono || '').replace(/[^\d+]/g, '');
                const url = phone
                  ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(msg)}`
                  : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              <IconWhatsApp size={17} color="#ffffff" />
              <span>Aviso WhatsApp</span>
            </button>

            <button
              type="button"
              style={{
                height: '40px',
                background: 'var(--paper, #ffffff)',
                color: 'var(--ink, #0f172a)',
                border: '1.5px solid var(--mist, #cbd5e1)',
                borderRadius: '10px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                fontWeight: 600,
                fontSize: '12.5px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary, #0284c7)';
                e.currentTarget.style.color = 'var(--primary, #0284c7)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--mist, #cbd5e1)';
                e.currentTarget.style.color = 'var(--ink, #0f172a)';
                e.currentTarget.style.transform = 'none';
              }}
              onClick={() => {
                onClose();
                if (onImpersonateStore) onImpersonateStore(store);
              }}
              title="Entrar a operar en modo solo lectura"
            >
              <IconTiendas size={16} color="currentColor" />
              <span>Ver como tienda</span>
            </button>

            {onExportStoreData && (
              <button
                type="button"
                style={{
                  height: '40px',
                  background: 'var(--paper, #ffffff)',
                  color: 'var(--ink, #0f172a)',
                  border: '1.5px solid var(--mist, #cbd5e1)',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary, #0284c7)';
                  e.currentTarget.style.color = 'var(--primary, #0284c7)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--mist, #cbd5e1)';
                  e.currentTarget.style.color = 'var(--ink, #0f172a)';
                  e.currentTarget.style.transform = 'none';
                }}
                onClick={() => onExportStoreData(store)}
                title="Descargar backup de inventario y ventas"
              >
                <IconDownload size={16} color="currentColor" />
                <span>Exportar datos</span>
              </button>
            )}
          </div>

          {/* Fila 2: Gestión de Estado y Cerrar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            marginTop: '2px',
            paddingTop: '8px',
            borderTop: '1px dashed var(--mist, #e2e8f0)'
          }}>
            <button
              type="button"
              style={{
                height: '34px',
                fontSize: '12px',
                fontWeight: 600,
                padding: '0 14px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: store.estado === 'activa' ? '#dc2626' : '#16a34a',
                border: `1.5px solid ${store.estado === 'activa' ? 'rgba(220, 38, 38, 0.35)' : 'rgba(22, 163, 74, 0.35)'}`,
                background: store.estado === 'activa' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(22, 163, 74, 0.06)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = store.estado === 'activa' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(22, 163, 74, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = store.estado === 'activa' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(22, 163, 74, 0.06)';
              }}
              onClick={() => onToggleSuspension(store.id)}
            >
              {store.estado === 'activa' ? (
                <IconLock size={14} color="#dc2626" />
              ) : (
                <IconLockOpen size={14} color="#16a34a" />
              )}
              <span>{store.estado === 'activa' ? 'Suspender acceso a la tienda' : 'Reactivar acceso a la tienda'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                height: '34px',
                minWidth: '85px',
                fontSize: '12px',
                fontWeight: 600,
                padding: '0 16px',
                borderRadius: '8px',
                background: 'var(--paper, #f8fafc)',
                border: '1.5px solid var(--mist, #cbd5e1)',
                color: 'var(--ink, #334155)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--fog, #f1f5f9)';
                e.currentTarget.style.borderColor = 'var(--ink, #94a3b8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--paper, #f8fafc)';
                e.currentTarget.style.borderColor = 'var(--mist, #cbd5e1)';
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación de Pago Blindado */}
      {isConfirmPayOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 10020 }}
          onClick={() => {
            if (!isProcessingPayment) setIsConfirmPayOpen(false);
          }}
        >
          <div
            className="modal-card"
            style={{
              maxWidth: '430px',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 25px 40px -10px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              background: '#ffffff'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(0, 200, 83, 0.12)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <IconPagos size={22} color="#059669" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  ¿Confirmar Registro de Pago?
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Renovación de suscripción para {store.nombre}
                </span>
              </div>
              {!isProcessingPayment && (
                <button
                  type="button"
                  onClick={() => setIsConfirmPayOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Cerrar"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Resumen del cobro */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Monto a cobrar:</span>
                <b style={{ fontSize: '16px', color: '#16a34a', fontWeight: 800 }}>
                  +{money(currentMonto != null ? currentMonto : store.monto)}
                </b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Extensión de periodo:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  +1 {PERIODICIDAD[store.periodicidad_meses || store.per] || 'mes'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Nuevo estado:</span>
                <span className="chip ok" style={{ fontSize: '10px', padding: '1px 6px' }}>
                  Al día / Activa
                </span>
              </div>
            </div>

            {/* Método de pago */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Método de pago recibido:
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                disabled={isProcessingPayment}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: isProcessingPayment ? '#f1f5f9' : '#ffffff',
                  color: '#0f172a'
                }}
              >
                <option value="Yape / Plin">Yape / Plin</option>
                <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta (POS)</option>
              </select>
            </div>

            {/* Botones de acción del modal de confirmación */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={() => setIsConfirmPayOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isProcessingPayment ? 'not-allowed' : 'pointer'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isProcessingPayment || paymentSuccess}
                onClick={handleExecutePayment}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: paymentSuccess
                    ? '#059669'
                    : isProcessingPayment
                    ? '#0d9488'
                    : 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: isProcessingPayment || paymentSuccess ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 200, 83, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                {isProcessingPayment ? (
                  <>
                    <span
                      style={{
                        width: '13px',
                        height: '13px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#ffffff',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite',
                        display: 'inline-block'
                      }}
                    />
                    <span>Procesando pago...</span>
                  </>
                ) : paymentSuccess ? (
                  <>
                    <IconCheck size={14} color="#ffffff" />
                    <span>¡Pago registrado!</span>
                  </>
                ) : (
                  <>
                    <IconPagos size={14} color="#ffffff" />
                    <span>Confirmar y Registrar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
