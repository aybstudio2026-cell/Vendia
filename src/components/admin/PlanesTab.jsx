import React, { useState, useEffect } from 'react';
import {
  getSaaSPlanes,
  fetchSaaSPlanes,
  saveSaaSPlan,
  deleteSaaSPlan,
  logSaaSAuditEvent
} from '../../services/saasService';
import { money, MODULOS_DEF } from '../../constants/palettes';
import { IconPlanes, IconCheck } from '../common/Icons';
import ConfirmCornerModal from '../common/ConfirmCornerModal';

export default function PlanesTab({ stores = [] }) {
  const [planes, setPlanes] = useState(() => {
    const initial = getSaaSPlanes();
    return Array.isArray(initial) ? initial : [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, nombre, storeCount }

  useEffect(() => {
    let isMounted = true;
    fetchSaaSPlanes().then((data) => {
      if (isMounted && Array.isArray(data)) {
        setPlanes(data);
      }
    }).catch((e) => console.warn('Aviso sincronizando planes:', e));
    return () => {
      isMounted = false;
    };
  }, []);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('25.00');
  const [descripcion, setDescripcion] = useState('');
  const [badge, setBadge] = useState('');
  const [selectedModulos, setSelectedModulos] = useState(['inventario', 'ventas']);
  const [popular, setPopular] = useState(false);

  // Calcular cuántas tiendas están suscritas a cada plan
  const getStoreCountForPlan = (plan) => {
    return stores.filter((s) => {
      if (s.plan && (s.plan.toLowerCase() === plan.codigo || s.plan.toLowerCase() === plan.nombre.toLowerCase())) {
        return true;
      }
      return Math.abs(parseFloat(s.monto || 0) - plan.precio) < 0.01;
    }).length;
  };

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setNombre('');
    setPrecio('35.00');
    setDescripcion('');
    setBadge('');
    setSelectedModulos(['inventario', 'ventas']);
    setPopular(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingPlan(p);
    setNombre(p.nombre);
    setPrecio(p.precio.toString());
    setDescripcion(p.descripcion);
    setBadge(p.badge || '');
    setSelectedModulos(p.modulos || ['inventario', 'ventas']);
    setPopular(Boolean(p.popular));
    setIsModalOpen(true);
  };

  const handleToggleModulo = (modKey) => {
    setSelectedModulos((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || precio === '' || isNaN(parseFloat(precio))) {
      alert('Por favor ingresa nombre y un precio válido.');
      return;
    }

    const payload = {
      ...(editingPlan ? { id: editingPlan.id, codigo: editingPlan.codigo } : { codigo: nombre.toLowerCase().replace(/\s+/g, '_') }),
      nombre: nombre.trim(),
      precio: parseFloat(precio),
      descripcion: descripcion.trim(),
      badge: badge.trim(),
      modulos: selectedModulos,
      popular,
      periodicidad: 1,
      activo: true
    };

    try {
      const updated = await saveSaaSPlan(payload);
      if (Array.isArray(updated)) {
        setPlanes(updated);
      } else {
        setPlanes(getSaaSPlanes());
      }
    } catch (err) {
      console.error('Error al guardar plan:', err);
      setPlanes(getSaaSPlanes());
    }

    logSaaSAuditEvent({
      tipo: 'tienda',
      accion: editingPlan ? 'Plan actualizado' : 'Nuevo plan creado',
      detalle: `Plan "${payload.nombre}" a ${money(payload.precio)}/mes configurado con ${payload.modulos.length} módulos.`,
      tienda: 'Catálogo de Planes'
    });

    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, nombre } = deleteConfirm;
    try {
      const updated = await deleteSaaSPlan(id);
      if (Array.isArray(updated)) {
        setPlanes(updated);
      } else {
        setPlanes(getSaaSPlanes());
      }
    } catch (err) {
      console.error('Error al eliminar plan:', err);
      setPlanes(getSaaSPlanes());
    }

    logSaaSAuditEvent({
      tipo: 'tienda',
      accion: 'Plan eliminado',
      detalle: `Se eliminó el plan "${nombre}".`,
      tienda: 'Catálogo de Planes'
    });
  };

  return (
    <div>
      {/* Cabecera */}
      <div className="bar">
        <div>
          <h1>Planes y Tarifas</h1>
          <p className="lead">Administra los paquetes comerciales de suscripción y sus módulos incluidos.</p>
        </div>
        <button type="button" className="btn p s" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={handleOpenCreate}>
          + Crear Nuevo Plan
        </button>
      </div>

      {/* Grid de Planes (Tarjetas de Pricing SaaS) */}
      <div
        className="sec"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px',
          alignItems: 'stretch'
        }}
      >
        {(Array.isArray(planes) ? planes : []).map((p) => {
          const storeCount = getStoreCountForPlan(p);
          return (
            <div
              key={p.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                background: '#ffffff',
                border: p.popular ? '2px solid #00C853' : '1px solid #e2e8f0',
                borderRadius: '14px',
                boxShadow: p.popular ? '0 10px 30px -4px rgba(0, 200, 83, 0.25)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
                overflow: 'hidden'
              }}
            >
              {p.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '14px',
                    background: 'linear-gradient(135deg, #00C853 0%, #00E5FF 100%)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '99px',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 8px rgba(0, 200, 83, 0.35)'
                  }}
                >
                  Más Popular
                </div>
              )}

              <div className="pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{p.nombre}</h3>
                  {p.badge && !p.popular && (
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        color: '#475569',
                        fontWeight: 600
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>

                <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: '#64748b', minHeight: '32px', lineHeight: 1.5 }}>
                  {p.descripcion}
                </p>

                {/* Precio */}
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: p.precio === 0 ? '#16a34a' : '#0f172a' }}>
                    {money(p.precio)}
                  </span>
                  <span style={{ color: p.precio === 0 ? '#16a34a' : '#64748b', fontSize: '11px', fontWeight: p.precio === 0 ? 600 : 400 }}>
                    {p.precio === 0 ? ' / 7 días gratis' : ' / mes'}
                  </span>
                </div>

                {/* Módulos incluidos */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginBottom: '16px', flex: 1 }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                    Módulos incluidos:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {p.modulos.map((m) => (
                      <li key={m} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#0f172a' }}>
                        <span style={{ color: '#00C853', display: 'inline-flex' }}>
                          <IconCheck size={13} />
                        </span>
                        <span>{MODULOS_DEF[m] || m}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Info de tiendas suscritas */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '10.5px',
                    color: '#475569',
                    marginBottom: '14px',
                    textAlign: 'center'
                  }}
                >
                  <b style={{ color: '#0f172a' }}>{storeCount}</b> tiendas suscritas actualmente
                </div>

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn o s"
                    style={{ flex: 1, fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => handleOpenEdit(p)}
                  >
                    Editar
                  </button>
                  {(Array.isArray(planes) ? planes.length : 0) > 1 && (
                    <button
                      type="button"
                      className="btn o s"
                      style={{ color: '#e53935', fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => setDeleteConfirm({ id: p.id, nombre: p.nombre, storeCount })}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Crear / Editar Plan */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                {editingPlan ? 'Editar Plan Comercial' : 'Crear Nuevo Plan'}
              </h2>
              <button type="button" className="btn g s" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Nombre del Plan
                </label>
                <input
                  type="text"
                  placeholder="Ej: Plan Bodega Pro"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Precio Mensual (S/.)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  placeholder="45.00"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Descripción corta
                </label>
                <input
                  type="text"
                  placeholder="Ej: Incluye reportes y escáner para comercios medianos."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Etiqueta opcional (Badge)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Recomendado / Popular"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  Módulos que incluye este plan por defecto:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {Object.entries(MODULOS_DEF).map(([key, label]) => (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        background: selectedModulos.includes(key) ? 'rgba(0, 200, 83, 0.1)' : '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: selectedModulos.includes(key) ? '1px solid #00C853' : '1px solid #e2e8f0'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModulos.includes(key)}
                        onChange={() => handleToggleModulo(key)}
                        style={{ width: 'auto', minHeight: 'auto' }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  {/* Compras módulo opcional */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      background: selectedModulos.includes('compras') ? 'rgba(0, 200, 83, 0.1)' : '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: selectedModulos.includes('compras') ? '1px solid #00C853' : '1px solid #e2e8f0'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModulos.includes('compras')}
                      onChange={() => handleToggleModulo('compras')}
                      style={{ width: 'auto', minHeight: 'auto' }}
                    />
                    <span>Compras a Proveedores</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={popular}
                    onChange={(e) => setPopular(e.target.checked)}
                    style={{ width: 'auto', minHeight: 'auto' }}
                  />
                  <span>Destacar como "Más Popular"</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn o" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn p">
                  Guardar Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal flotante en esquina inferior derecha para confirmar eliminación */}
      <ConfirmCornerModal
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar plan tarifario?"
        itemName={deleteConfirm?.nombre || ''}
        itemType="plan"
        description={
          deleteConfirm?.storeCount > 0
            ? `Atención: Actualmente hay ${deleteConfirm.storeCount} tienda(s) suscritas a este plan. Si lo eliminas, mantendrán sus módulos actuales pero el plan ya no se ofrecerá a nuevas tiendas.`
            : 'Este plan tarifario será eliminado del catálogo de la plataforma de forma definitiva.'
        }
        confirmText="Eliminar plan"
      />
    </div>
  );
}
