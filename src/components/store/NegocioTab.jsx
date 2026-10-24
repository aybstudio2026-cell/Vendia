import React, { useState } from 'react';
import { money, fd } from '../../constants/palettes';
import Modal from '../common/Modal';
import { IconUpload, IconImage } from '../common/Icons';
import { uploadStoreLogoToSupabase } from '../../services/storeService';
import { exportStoreCompleteData, exportProductsToCSV } from '../../services/exportService';
import { resolveStorePlan } from '../../services/saasService';

export default function NegocioTab({
  employees = [],
  onToggleEmployee,
  onAddEmployee,
  storeId = null,
  storeName = 'Mi Tienda',
  storeLogo = null,
  onUpdateLogo,
  products = [],
  sales = [],
  isDemoMode = false,
  contract = {
    plan: 'Básico',
    monto: 20,
    moneda: 'PEN',
    periodicidad_meses: 1,
    fecha_inicio: '2026-01-15',
    proximo_pago: '2026-10-22',
    modulos: ['inventario', 'ventas']
  },
  pagos = [
    { fecha: '2026-09-15', monto: 20 },
    { fecha: '2026-08-15', monto: 20 },
    { fecha: '2026-07-15', monto: 20 }
  ],
  paymentMethods = ['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia'],
  onUpdatePaymentMethods
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [empNombre, setEmpNombre] = useState('');
  const [empCorreo, setEmpCorreo] = useState('');

  // Estado de métodos de pago
  const [newMethodInput, setNewMethodInput] = useState('');
  const [paymentMethodsStatus, setPaymentMethodsStatus] = useState(false);

  // Estado del Logotipo en imagen
  const [logoInput, setLogoInput] = useState(storeLogo || '');
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoStatus, setLogoStatus] = useState('');

  const handleToggleMethod = (method) => {
    let next;
    const current = paymentMethods || [];
    if (current.includes(method)) {
      if (current.length <= 1) {
        alert('Debe mantener al menos una forma de pago activa.');
        return;
      }
      next = current.filter((m) => m !== method);
    } else {
      next = [...current, method];
    }
    if (onUpdatePaymentMethods) {
      onUpdatePaymentMethods(storeId || 'demo', next);
      setPaymentMethodsStatus(true);
      setTimeout(() => setPaymentMethodsStatus(false), 2500);
    }
  };

  const handleAddCustomMethod = (e) => {
    e.preventDefault();
    const clean = newMethodInput.trim();
    if (!clean) return;
    const current = paymentMethods || [];
    if (current.map((m) => m.toLowerCase()).includes(clean.toLowerCase())) {
      alert('Ese método de pago ya existe.');
      return;
    }
    const next = [...current, clean];
    setNewMethodInput('');
    if (onUpdatePaymentMethods) {
      onUpdatePaymentMethods(storeId || 'demo', next);
      setPaymentMethodsStatus(true);
      setTimeout(() => setPaymentMethodsStatus(false), 2500);
    }
  };

  // Resolución del plan SaaS oficial de la tienda
  const resolvedPlan = resolveStorePlan(contract?.plan, contract?.monto, contract?.modulos);
  const planName = (resolvedPlan?.nombre || contract?.plan || 'Emprendedor').toLowerCase();
  const employeeLimit = planName.includes('full') || planName.includes('ilimitado') ? Infinity : planName.includes('pro') ? 3 : 1;
  const activeEmployeesCount = employees.filter((e) => e.activo !== false).length;
  const hasReachedLimit = activeEmployeesCount >= employeeLimit;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!empNombre.trim() || !empCorreo.trim()) return;

    if (hasReachedLimit) {
      alert(`Has alcanzado el límite de ${employeeLimit} empleado(s) de tu Plan ${contract.plan || 'Emprendedor'}. Actualiza a Plan Pro o Full para agregar más personal.`);
      return;
    }

    onAddEmployee({
      nombre: empNombre.trim(),
      correo: empCorreo.trim(),
      ultimo_acceso: new Date().toISOString()
    });

    setEmpNombre('');
    setEmpCorreo('');
    setIsAddModalOpen(false);
  };

  // Subir archivo de imagen (PNG, JPG, SVG, WebP)
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP o SVG).');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('La imagen no debe pesar más de 4 MB.');
      return;
    }

    setIsSavingLogo(true);
    setLogoStatus('Cargando y optimizando imagen para Supabase...');
    try {
      const uploadedUrl = await uploadStoreLogoToSupabase(storeId || 'tienda', file);
      if (uploadedUrl) {
        setLogoInput(uploadedUrl);
        await onUpdateLogo(uploadedUrl);
        setLogoStatus('✓ ¡Logotipo guardado exitosamente en Supabase!');
        setTimeout(() => setLogoStatus(''), 4000);
      }
    } catch (err) {
      console.error('Error al subir imagen:', err);
      setLogoStatus('Error al subir la imagen a Supabase.');
    } finally {
      setIsSavingLogo(false);
    }
  };

  // Guardar URL directa escrita
  const handleSaveLogoUrl = async () => {
    setIsSavingLogo(true);
    try {
      const cleanUrl = logoInput.trim() || null;
      await onUpdateLogo(cleanUrl);
      setLogoStatus('✓ ¡Logotipo guardado exitosamente en Supabase!');
      setTimeout(() => setLogoStatus(''), 4000);
    } catch (err) {
      console.error('Error al guardar en Supabase:', err);
      setLogoStatus('Error al guardar en Supabase.');
    } finally {
      setIsSavingLogo(false);
    }
  };

  // Quitar logotipo y volver al monograma
  const handleRemoveLogo = async () => {
    setIsSavingLogo(true);
    try {
      setLogoInput('');
      await onUpdateLogo(null);
      setLogoStatus('✓ Logotipo eliminado. Se usará el monograma estándar.');
      setTimeout(() => setLogoStatus(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingLogo(false);
    }
  };

  const roleMatrix = [
    ['Registrar ventas', true, true],
    ['Consultar inventario y ventas', true, true],
    ['Crear productos y entrar mercancía', true, false],
    ['Cambiar precios y stock mínimo', true, false],
    ['Gestionar empleados', true, false],
    ['Ver plan y pagos', true, false]
  ];

  return (
    <div>
      <div className="bar">
        <div>
          <h1>Negocio</h1>
          <p className="lead">Tu identidad de tienda, tu plan, tus empleados y lo que puede hacer cada rol.</p>
        </div>
      </div>

      {/* Logotipo e Imagen Oficial de la Tienda (Guardado en Supabase) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2>Logotipo de la Tienda (Guardado en Supabase)</h2>
        <div className="pad">
          <p className="hint" style={{ marginTop: 0, marginBottom: '20px' }}>
            Configura la imagen oficial de tu negocio (PNG, JPG, WebP o SVG). Este logotipo se guarda directamente en <b>Supabase</b> y se muestra en la cabecera, la barra lateral, el modo cajero y en la <b>boleta de venta física y digital</b> (sin emojis).
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 220px) 1fr',
              gap: '24px',
              alignItems: 'center'
            }}
          >
            {/* Vista previa de la imagen del logotipo */}
            <div
              style={{
                border: '2px dashed var(--mist)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                background: 'var(--fog)',
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {logoInput ? (
                <>
                  <img
                    src={logoInput}
                    alt={storeName}
                    style={{
                      maxHeight: '70px',
                      maxWidth: '160px',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      display: 'block'
                    }}
                  />
                  <small style={{ color: 'var(--graphite)', fontSize: '11px', fontWeight: '500' }}>
                    Vista previa activa
                  </small>
                </>
              ) : (
                <>
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, var(--ember) 0%, var(--carbon) 100%)',
                      color: 'var(--onacc)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px color-mix(in srgb, var(--ember) 30%, transparent)'
                    }}
                  >
                    {storeName.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--pewter)' }}>
                    Sin logotipo (usando monograma)
                  </span>
                </>
              )}
            </div>

            {/* Opciones de carga */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)', display: 'block', marginBottom: '8px' }}>
                Subir archivo de imagen desde tu computadora:
              </label>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                <label
                  className="btn o s"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: isSavingLogo ? 'not-allowed' : 'pointer'
                  }}
                >
                  <IconUpload size={16} />
                  <span>{isSavingLogo ? 'Guardando en Supabase...' : 'Seleccionar imagen (PNG, JPG, SVG)'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    disabled={isSavingLogo}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </label>

                {logoInput && (
                  <button
                    type="button"
                    className="btn g s"
                    style={{ color: '#dc2626' }}
                    onClick={handleRemoveLogo}
                    disabled={isSavingLogo}
                  >
                    Quitar logotipo
                  </button>
                )}
              </div>

              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--graphite)', display: 'block', marginBottom: '4px' }}>
                O escribe/pega el enlace de la imagen (URL):
              </label>
              <div style={{ display: 'flex', gap: '8px', maxWidth: '520px' }}>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/logo.png"
                  value={logoInput}
                  onChange={(e) => setLogoInput(e.target.value)}
                  style={{ flex: 1, minHeight: '38px', fontSize: '13px' }}
                />
                <button
                  type="button"
                  className="btn p s"
                  onClick={handleSaveLogoUrl}
                  disabled={isSavingLogo}
                >
                  Guardar en Supabase
                </button>
              </div>

              {/* Mensaje de estado */}
              {logoStatus && (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: logoStatus.startsWith('✓') ? '#059669' : '#dc2626'
                  }}
                >
                  {logoStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Métodos de Pago Habilitados para la Tienda */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--mist)', padding: '16px 20px' }}>
          <h2 style={{ margin: 0, padding: 0, border: 0 }}>Métodos de Pago Aceptados</h2>
          {paymentMethodsStatus && (
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
              ✓ ¡Métodos actualizados!
            </span>
          )}
        </div>
        <div className="pad">
          <p className="hint" style={{ marginTop: 0, marginBottom: '16px' }}>
            Selecciona las formas de pago que tu negocio acepta. Se mostrarán inmediatamente a tus cajeros en la pantalla de cobro del POS.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia'].map((m) => {
              const isAct = (paymentMethods || []).includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  className={`pill ${isAct ? 'p' : 'g'}`}
                  aria-pressed={isAct}
                  onClick={() => handleToggleMethod(m)}
                  style={{
                    fontSize: '13px',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    borderColor: isAct ? 'var(--ember)' : 'var(--mist)',
                    background: isAct ? 'var(--ember)' : 'transparent',
                    color: isAct ? 'var(--onacc)' : 'var(--pewter)',
                    boxShadow: isAct ? '0 2px 8px color-mix(in srgb, var(--ember) 30%, transparent)' : 'none',
                    fontWeight: isAct ? '600' : '500'
                  }}
                  title={isAct ? 'Clic para desactivar' : 'Clic para activar'}
                >
                  {isAct ? '✓ ' : '+ '} {m}
                </button>
              );
            })}

            {/* Métodos personalizados */}
            {(paymentMethods || [])
              .filter((m) => !['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia'].includes(m))
              .map((cm) => (
                <span
                  key={cm}
                  className="chip"
                  style={{
                    fontSize: '13px',
                    padding: '6px 10px',
                    background: 'var(--fog)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <b>✓ {cm}</b>
                  <button
                    type="button"
                    onClick={() => handleToggleMethod(cm)}
                    style={{
                      background: 'none',
                      border: 0,
                      cursor: 'pointer',
                      color: 'var(--pewter)',
                      fontWeight: 'bold',
                      padding: 0
                    }}
                    title={`Quitar ${cm}`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>

          <form onSubmit={handleAddCustomMethod} style={{ display: 'flex', gap: '8px', maxWidth: '480px' }}>
            <input
              type="text"
              placeholder="Otro método de pago (ej: Fiado, Dólares, Vale)"
              value={newMethodInput}
              onChange={(e) => setNewMethodInput(e.target.value)}
              style={{ flex: 1, minHeight: '36px', fontSize: '13px' }}
            />
            <button type="submit" className="btn o s" style={{ whiteSpace: 'nowrap' }}>
              + Agregar método
            </button>
          </form>
        </div>
      </div>

      <div className="sec two">
        {/* Mi Plan SaaS */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--mist)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0 }}>Mi plan SaaS</h2>
            <span
              className="chip"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'rgba(0, 229, 255, 0.12)',
                color: '#0284c7',
                borderColor: 'rgba(0, 229, 255, 0.35)'
              }}
            >
              {resolvedPlan.badge || 'Activo'}
            </span>
          </div>

          <div className="pad">
            <div className="kv">
              <div>
                <span>Plan</span>
                <b style={{ color: 'var(--ink)' }}>{resolvedPlan.nombre}</b>
              </div>
              <div>
                <span>Pago</span>
                {money(contract.monto || resolvedPlan.precio, contract.moneda)} / mes
              </div>
              <div>
                <span>Contrato desde</span>
                {fd(contract.fecha_inicio)}
              </div>
              <div>
                <span>Próximo pago</span>
                {fd(contract.proximo_pago)}
              </div>
              <div>
                <span>Módulos activos</span>
                {(contract.modulos || []).map((m) => {
                  const map = {
                    inventario: 'Inventario',
                    ventas: 'Ventas',
                    reportes: 'Reportes',
                    escaner: 'Escáner & Códigos',
                    compras: 'Compras'
                  };
                  return map[m.toLowerCase()] || m;
                }).join(', ')}
              </div>
              <div>
                <span>Disponible pronto</span>
                {(() => {
                  const ALL_MODULES = [
                    { key: 'inventario', label: 'Inventario' },
                    { key: 'ventas', label: 'Ventas' },
                    { key: 'reportes', label: 'Reportes' },
                    { key: 'escaner', label: 'Escáner & Códigos' },
                    { key: 'compras', label: 'Compras & Proveedores' }
                  ];
                  const currentMods = (contract.modulos || []).map((m) => m.toLowerCase());
                  const missing = ALL_MODULES.filter((m) => !currentMods.includes(m.key));
                  if (missing.length === 0) {
                    return <span style={{ color: '#10b981', fontWeight: 600 }}>Todos los módulos incluidos 🎉</span>;
                  }
                  return missing.map((m) => m.label).join(', ');
                })()}
              </div>
            </div>
          </div>

          <h2 style={{ borderTop: '1px solid var(--mist)' }}>Pagos anteriores</h2>
          {pagos && pagos.length > 0 ? (
            pagos.map((p, idx) => (
              <div key={p.id || idx} className="li">
                <span>{fd(p.fecha_pago || p.fecha || p.creado_en)}</span>
                <b>{money(p.monto, contract.moneda)}</b>
              </div>
            ))
          ) : (
            <p className="hint" style={{ padding: '12px 16px', margin: 0 }}>Sin pagos anteriores registrados</p>
          )}
        </div>

        {/* Empleados */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--mist)' }}>
            <h2 style={{ margin: 0, padding: 0, border: 0 }}>Empleados</h2>
            <span
              className="chip"
              style={{
                fontSize: '11px',
                fontWeight: '700',
                background: hasReachedLimit ? '#fee2e2' : 'var(--fog)',
                color: hasReachedLimit ? '#b91c1c' : 'inherit'
              }}
            >
              {activeEmployeesCount} / {employeeLimit === Infinity ? 'Ilimitados' : `${employeeLimit} máx.`} ({contract.plan || 'Emprendedor'})
            </span>
          </div>

          {hasReachedLimit && (
            <div style={{ padding: '10px 16px', background: 'rgba(239, 68, 68, 0.08)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', color: '#b91c1c' }}>
              ⚠️ Has alcanzado el límite de {employeeLimit} empleado(s) de tu Plan {contract.plan || 'Emprendedor'}. Actualiza a Plan Pro o Full para habilitar más accesos.
            </div>
          )}

          {employees.map((emp, idx) => {
            const lastAccessText = emp.ultimo_acceso
              ? (emp.ultimo_acceso.includes('T') ? fd(emp.ultimo_acceso) : emp.ultimo_acceso)
              : 'Hoy a las 14:20';

            return (
              <div key={emp.id || idx} className="li" style={{ padding: '12px 18px', minHeight: '52px' }}>
                <div>
                  <b style={{ fontSize: '13px' }}>{emp.nombre}</b>
                  <small style={{ color: 'var(--graphite)', display: 'block' }}>{emp.correo}</small>
                  <small style={{ color: 'var(--pewter)', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                    🕒 Último acceso: {lastAccessText}
                  </small>
                </div>
                <div className="r" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`chip ${emp.activo ? '' : 'out'}`} style={{ fontSize: '11px' }}>
                    {emp.activo ? 'Activo' : 'Inactivo'}
                  </span>{' '}
                  <button
                    type="button"
                    className="btn o s"
                    onClick={() => onToggleEmployee(emp.id || idx)}
                    style={{ minHeight: '36px', fontSize: '11px' }}
                  >
                    {emp.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="pad" style={{ borderTop: '1px solid var(--mist)', padding: '16px' }}>
            <button
              type="button"
              className="btn p"
              disabled={hasReachedLimit}
              onClick={() => setIsAddModalOpen(true)}
              style={{ width: '100%', minHeight: '44px' }}
            >
              {hasReachedLimit ? 'Límite de empleados alcanzado' : '+ Agregar empleado'}
            </button>
          </div>
        </div>
      </div>

      {/* Qué puede hacer cada rol */}
      <div className="card">
        <h2>Qué puede hacer cada rol</h2>
        <div className="head" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <div>Acción</div>
          <div>Dueño</div>
          <div>Empleado</div>
        </div>
        {roleMatrix.map((r, i) => (
          <div
            key={i}
            className="row"
            style={{ gridTemplateColumns: '2fr 1fr 1fr' }}
          >
            <div>{r[0]}</div>
            <div>{r[1] ? '✓' : '—'}</div>
            <div>{r[2] ? '✓' : '—'}</div>
          </div>
        ))}
      </div>

      {/* Copia de Seguridad y Exportación de Datos */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Copia de Seguridad & Exportación de Datos</h2>
        <div className="pad">
          <p className="hint" style={{ marginTop: 0, marginBottom: '16px' }}>
            Descarga una copia completa de todos los datos de tu tienda en cualquier momento (catálogo de productos, inventario, ventas y movimientos). Tus datos siempre te pertenecen.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn p"
              disabled={isExporting}
              onClick={async () => {
                setIsExporting(true);
                try {
                  await exportStoreCompleteData({
                    storeId,
                    storeName,
                    isDemoMode,
                    localProducts: products,
                    localSales: sales,
                    storeConfig: { contract, paymentMethods }
                  });
                } catch (err) {
                  console.error('Error al exportar:', err);
                  alert('Ocurrió un error al generar la copia de seguridad.');
                } finally {
                  setIsExporting(false);
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              📥 {isExporting ? 'Generando copia de seguridad...' : 'Exportar Copia Completa (JSON)'}
            </button>
            <button
              type="button"
              className="btn o"
              onClick={() => exportProductsToCSV(products, storeName)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              📊 Exportar Catálogo a Excel (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Modal Agregar Empleado */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Agregar empleado"
      >
        <form className="f" onSubmit={handleAddSubmit}>
          <label>
            <span>Nombre del empleado</span>
            <input
              required
              value={empNombre}
              onChange={(e) => setEmpNombre(e.target.value)}
              placeholder="Ej: Lucía Ramos"
            />
          </label>
          <label>
            <span>Correo electrónico</span>
            <input
              type="email"
              required
              value={empCorreo}
              onChange={(e) => setEmpCorreo(e.target.value)}
              placeholder="lucia@tienda.com"
            />
          </label>
          <p className="hint">
            Si el empleado ya tiene cuenta en la plataforma, quedará vinculado de inmediato. Si no, se enviará una invitación a su correo.
          </p>
          <div className="acts" style={{ marginTop: 8 }}>
            <button type="submit" className="btn p">
              Guardar empleado
            </button>
            <button
              type="button"
              className="btn o"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
