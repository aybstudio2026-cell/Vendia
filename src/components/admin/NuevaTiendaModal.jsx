import React, { useState } from 'react';
import Modal from '../common/Modal';
import { getSaaSPlanes } from '../../services/saasService';
import { getPeruDateIso } from '../../utils/dateUtils';

const SYSTEM_MODULES = [
  { key: 'inventario', label: 'Inventario' },
  { key: 'ventas', label: 'Ventas & Caja' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'escaner', label: 'Escáner de barras' },
  { key: 'compras', label: 'Compras' }
];

export default function NuevaTiendaModal({
  isOpen,
  onClose,
  onCreateStore,
  profiles = []
}) {
  const todayStr = getPeruDateIso();
  const planes = getSaaSPlanes();
  const defaultPlan = planes.find((p) => p.popular) || planes[0] || {};

  const [nombre, setNombre] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [dueno, setDueno] = useState('');
  const [email, setEmail] = useState('');
  const [monto, setMonto] = useState(defaultPlan.precio ? parseFloat(defaultPlan.precio).toFixed(2) : '89.00');
  const [periodo, setPeriodo] = useState('1');
  const [inicio, setInicio] = useState(todayStr);
  const [modulos, setModulos] = useState(defaultPlan.modulos || ['inventario', 'ventas', 'reportes', 'escaner']);
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlan.id || planes[0]?.id || '');

  const handleSelectPlan = (plan) => {
    setSelectedPlanId(plan.id);
    setMonto(parseFloat(plan.precio).toFixed(2));
    setModulos(plan.modulos || ['inventario', 'ventas']);
    if (plan.codigo === 'gratuito' || plan.precio === 0) {
      setPeriodo('7d');
    } else if (periodo === '7d') {
      setPeriodo('1');
    }
  };

  const handleSelectProfile = (e) => {
    const profId = e.target.value;
    setSelectedProfileId(profId);
    if (!profId) return;
    const p = profiles.find((x) => x.id === profId);
    if (p) {
      setDueno(p.nombre || '');
      setEmail(p.correo || '');
    }
  };

  const handleToggleModule = (modKey) => {
    setModulos((prev) =>
      prev.includes(modKey) ? prev.filter((m) => m !== modKey) : [...prev, modKey]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim() || !dueno.trim() || !email.trim()) return;

    onCreateStore({
      nombre: nombre.trim(),
      dueno: dueno.trim(),
      email: email.trim(),
      monto: parseFloat(monto) || 0,
      periodicidad_meses: periodo === '7d' ? 1 : (parseInt(periodo, 10) || 1),
      fecha_inicio: inicio,
      modulos: modulos,
      plan: planes.find((p) => p.id === selectedPlanId)?.codigo || (parseFloat(monto) === 0 ? 'gratuito' : 'personalizado')
    });

    onClose();
  };

  const currentSelectedPlan = planes.find((p) => p.id === selectedPlanId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Nueva Tienda"
      maxWidth={700}
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
        <p className="hint" style={{ marginTop: 0, marginBottom: 18, fontSize: '13px', lineHeight: 1.4 }}>
          Registra un nuevo comercio en <strong>Vendia Cloud</strong>. Se activará su sede principal, contrato SaaS y vinculación del dueño de forma automática.
        </p>

        <form className="f" onSubmit={handleSubmit} style={{ gap: '20px' }}>
          {/* SECCIÓN 1: DATOS DEL COMERCIO Y DUEÑO */}
          <div style={{
            background: 'var(--fog)',
            border: '1px solid var(--mist)',
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: 'var(--ink)',
                color: 'var(--paper)',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700
              }}>
                1
              </span>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                Información del Comercio y Dueño
              </h3>
            </div>

            <label style={{ display: 'block' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                Nombre comercial de la tienda *
              </span>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Minimarket Don Pepe, Bodega La Esquina..."
                style={{ width: '100%', minHeight: '38px', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
              />
            </label>

            {profiles.length > 0 && (
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                  Vincular usuario registrado existente como dueño (opcional)
                </span>
                <select
                  value={selectedProfileId}
                  onChange={handleSelectProfile}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}
                >
                  <option value="">-- Ingresar datos manualmente o seleccionar usuario --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.correo})
                    </option>
                  ))}
                </select>
                {selectedProfileId && (
                  <small style={{ color: '#16a34a', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                    ✓ Usuario seleccionado. Se asignará el rol de Dueño automáticamente al crear la tienda.
                  </small>
                )}
              </label>
            )}

            <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                  Nombre del dueño *
                </span>
                <input
                  required
                  value={dueno}
                  onChange={(e) => setDueno(e.target.value)}
                  placeholder="Ej: Carlos Peña"
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                  Correo electrónico del dueño *
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@correo.com"
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                />
              </label>
            </div>
          </div>

          {/* SECCIÓN 2: SELECCIONAR PLAN SAAS */}
          <div style={{
            background: 'var(--fog)',
            border: '1px solid var(--mist)',
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  2
                </span>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                  Seleccionar Plan Sugerido
                </h3>
              </div>
              <span className="hint" style={{ fontSize: '11px' }}>
                Configura automáticamente tarifa y módulos recomendados
              </span>
            </div>

            {/* Grid de Tarjetas de Planes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              {planes.map((p) => {
                const isSelected = selectedPlanId === p.id;
                const isPopular = p.popular;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPlan(p)}
                    style={{
                      border: isSelected ? '2px solid #00E5FF' : '1px solid var(--mist)',
                      background: isSelected ? 'rgba(0, 229, 255, 0.06)' : 'var(--paper)',
                      borderRadius: '10px',
                      padding: '12px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.18s ease',
                      boxShadow: isSelected ? '0 4px 14px rgba(0, 229, 255, 0.15)' : 'none',
                      position: 'relative'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="chip" style={{
                          fontSize: '9.5px',
                          padding: '2px 6px',
                          fontWeight: 700,
                          background: isSelected ? 'rgba(0, 229, 255, 0.18)' : p.precio === 0 ? 'rgba(34, 197, 94, 0.15)' : 'var(--fog)',
                          color: isSelected ? '#0284c7' : p.precio === 0 ? '#15803d' : 'inherit'
                        }}>
                          {p.badge || (isPopular ? 'Más Vendido' : 'Plan')}
                        </span>
                        {isSelected && (
                          <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '13px' }}>✓</span>
                        )}
                      </div>
                      <b style={{ fontSize: '12px', display: 'block', color: 'var(--ink)', marginBottom: 4, lineHeight: 1.25 }}>
                        {p.nombre}
                      </b>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '4px 0 6px' }}>
                        {p.precio === 0 ? (
                          <>
                            <span>S/. 0.00</span>
                            <small style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', marginLeft: 4 }}>7 días gratis</small>
                          </>
                        ) : (
                          <>
                            <span>S/. {parseFloat(p.precio).toFixed(2)}</span>
                            <small style={{ fontSize: '10.5px', fontWeight: 400, color: 'var(--graphite)', marginLeft: 3 }}>/ mes</small>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '10.5px', color: 'var(--pewter)', borderTop: '1px solid var(--mist)', paddingTop: 5, marginTop: 4 }}>
                      {(p.modulos || []).length} módulos incluidos
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 3: PERSONALIZACIÓN DE TARIFA Y MÓDULOS */}
          <div style={{
            background: 'var(--fog)',
            border: '1px solid var(--mist)',
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: 'var(--ink)',
                color: 'var(--paper)',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700
              }}>
                3
              </span>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                Tarifa y Módulos Habilitados
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                  Monto a cobrar (S/.) *
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                  Frecuencia de cobro *
                </span>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}
                >
                  {(currentSelectedPlan?.codigo === 'gratuito' || periodo === '7d' || parseFloat(monto) === 0) && (
                    <option value="7d">Prueba Gratuita (7 días)</option>
                  )}
                  <option value="1">Mensual (1 mes)</option>
                  <option value="3">Trimestral (3 meses)</option>
                  <option value="12">Anual (12 meses)</option>
                </select>
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                  Inicio de contrato *
                </span>
                <input
                  type="date"
                  required
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                />
              </label>

              {(currentSelectedPlan?.codigo === 'gratuito' || parseFloat(monto) === 0) && (
                <div style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '11.5px',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '14px' }}>🎁</span>
                  <span>
                    <strong>Periodo de Prueba Gratis de 7 Días:</strong> La tienda se activará con acceso completo sin costo. Cuando decidan comprar, podrás cambiar su plan a Emprendedor, Pro o Full en su ficha con 1 solo clic y registrar su primer cobro.
                  </span>
                </div>
              )}
            </div>

            {/* Módulos clicables modernos */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '8px' }}>
                Módulos activos en la tienda:
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SYSTEM_MODULES.map((m) => {
                  const isActive = modulos.includes(m.key);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => handleToggleModule(m.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: isActive ? '1px solid #16a34a' : '1px solid var(--mist)',
                        background: isActive ? 'rgba(34, 197, 94, 0.1)' : 'var(--paper)',
                        color: isActive ? '#15803d' : 'var(--graphite)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{m.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>{isActive ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RESUMEN RÁPIDO */}
          <div style={{
            background: 'var(--paper)',
            border: '1px dashed var(--mist)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--graphite)',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              <span>Resumen: </span>
              <strong style={{ color: 'var(--ink)' }}>{nombre.trim() || 'Nueva Tienda'}</strong>
              {' · '}
              <span style={{ color: '#0284c7', fontWeight: 600 }}>
                {currentSelectedPlan?.nombre || 'Plan Personalizado'}
              </span>
              {' · '}
              <span>
                {parseFloat(monto || 0) === 0 ? 'Gratis (7 días de prueba)' : `S/. ${parseFloat(monto || 0).toFixed(2)} / ${periodo === '1' ? 'mes' : periodo === '3' ? 'trimestre' : 'año'}`}
              </span>
            </div>
            <div>
              <span className="chip" style={{ fontSize: '11px', fontWeight: 600 }}>
                {modulos.length} módulos habilitados
              </span>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn o"
              onClick={onClose}
              style={{ minHeight: '40px', padding: '0 20px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn p"
              style={{
                minHeight: '40px',
                padding: '0 24px',
                background: 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 3px 10px rgba(0, 200, 83, 0.25)',
                fontWeight: 700
              }}
            >
              Crear y activar
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
