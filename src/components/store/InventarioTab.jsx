import React, { useState } from 'react';
import { money, UNIDADES_MEDIDA, getUnidadMedida, TIPOS_AJUSTE_INVENTARIO, normalizeSearch } from '../../constants/palettes';
import Modal from '../common/Modal';
import { exportProductsToCSV } from '../../utils/exportCSV';
import { IconDownload, IconUpload, IconCamera, IconBarcode, IconAlertTriangle } from '../common/Icons';
import { getCategoryStyle } from '../../constants/categories';
import { validateProductInput } from '../../utils/security';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playBeepSuccess } from '../../utils/audio';
import BarcodeScannerModal from '../common/BarcodeScannerModal';
import ImportarInventarioModal from './ImportarInventarioModal';
import AlertBellButton from '../common/AlertBellButton';

export default function InventarioTab({
  products = [],
  movements = [],
  role = 'dueno',
  onSaveProduct,
  onImportProducts,
  alertCount = 0,
  onOpenAlerts
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('activos'); // 'activos' | 'archivados' | 'todos'
  const [editingProduct, setEditingProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states for creating/editing product
  const [formNombre, setFormNombre] = useState('');
  const [formCodigoBarras, setFormCodigoBarras] = useState('');
  const [formCategoria, setFormCategoria] = useState('General');
  const [formUnidadMedida, setFormUnidadMedida] = useState('und');
  const [formPrecio, setFormPrecio] = useState('');
  const [formCosto, setFormCosto] = useState('');
  const [formMinimo, setFormMinimo] = useState(5);
  const [formStockActual, setFormStockActual] = useState('');
  const [formDelta, setFormDelta] = useState(0);
  const [tipoAjuste, setTipoAjuste] = useState('ingreso'); // 'ingreso', 'merma', 'conteo_fisico', 'correccion'
  const [conteoFisicoValor, setConteoFisicoValor] = useState('');
  const [formActivo, setFormActivo] = useState(true);

  const isDueno = role === 'dueno';
  const categories = ['Todos', ...new Set(products.map((p) => p.categoria || 'General'))];

  // Captura automática de lector de código de barras USB en Inventario
  useBarcodeScanner({
    onScan: (scannedCode) => {
      const clean = String(scannedCode || '').trim();
      if (!clean) return;

      playBeepSuccess();
      if (isModalOpen) {
        setFormCodigoBarras(clean);
      } else {
        setSearchTerm(clean);
      }
    },
    enabled: !isBarcodeModalOpen
  });

  // Métricas considerando activos
  const activeProducts = products.filter((p) => p.activo !== false);
  const totalValor = activeProducts.reduce((sum, p) => sum + (p.precio_venta || 0) * (p.stock || 0), 0);
  const lowStockCount = activeProducts.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= (p.stock_minimo || 5)).length;
  const outOfStockCount = activeProducts.filter((p) => (p.stock || 0) <= 0).length;
  const archivedCount = products.filter((p) => p.activo === false).length;

  // Filtrado de productos por búsqueda (acento insensible), categoría y estado activo/archivado
  const filteredProducts = products.filter((p) => {
    // Filtro activo/archivado
    const isArchived = p.activo === false;
    if (statusFilter === 'activos' && isArchived) return false;
    if (statusFilter === 'archivados' && !isArchived) return false;

    // Filtro por término
    const term = normalizeSearch(searchTerm);
    const matchesSearch = !term ||
      normalizeSearch(p.nombre).includes(term) ||
      (p.codigo_barras && String(p.codigo_barras).toLowerCase().includes(term));

    // Filtro por categoría
    const matchesCat = categoryFilter === 'Todos' || (p.categoria || 'General') === categoryFilter;

    return matchesSearch && matchesCat;
  });

  // Detección de código de barras duplicado en el formulario
  const duplicateBarcodeProduct = formCodigoBarras.trim()
    ? products.find(
        (p) =>
          p.codigo_barras &&
          String(p.codigo_barras).trim().toLowerCase() === formCodigoBarras.trim().toLowerCase() &&
          (!editingProduct || String(p.id) !== String(editingProduct.id))
      )
    : null;

  const currentUnitConfig = getUnidadMedida(formUnidadMedida);

  const openNewProduct = () => {
    setEditingProduct(null);
    setFormNombre('');
    setFormCodigoBarras('');
    setFormCategoria(categories[1] || 'General');
    setFormUnidadMedida('und');
    setFormPrecio('');
    setFormCosto('');
    setFormMinimo(5);
    setFormStockActual('');
    setFormDelta(0);
    setTipoAjuste('ingreso');
    setConteoFisicoValor('');
    setFormActivo(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditProduct = (prod) => {
    if (!isDueno) return;
    setEditingProduct(prod);
    setFormNombre(prod.nombre);
    setFormCodigoBarras(prod.codigo_barras || '');
    setFormCategoria(prod.categoria || 'General');
    setFormUnidadMedida(prod.unidad_medida || 'und');
    setFormPrecio(prod.precio_venta);
    setFormCosto(prod.costo_unitario || '');
    setFormMinimo(prod.stock_minimo !== undefined ? prod.stock_minimo : 5);
    const curr = prod.stock !== undefined ? String(prod.stock) : '0';
    setFormStockActual(curr);
    setFormDelta(0);
    setTipoAjuste('conteo_fisico');
    setConteoFisicoValor(curr);
    setFormActivo(prod.activo !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (duplicateBarcodeProduct) {
      setFormError(`El código de barras ya pertenece a "${duplicateBarcodeProduct.nombre}". Los códigos deben ser únicos.`);
      return;
    }

    let calculatedDelta = 0;
    let initialStockValue = 0;

    if (editingProduct) {
      if (formStockActual !== '') {
        const targetStock = parseFloat(formStockActual);
        if (isNaN(targetStock) || targetStock < 0) {
          setFormError('Ingresa un stock actual válido mayor o igual a 0.');
          return;
        }
        calculatedDelta = targetStock - (editingProduct.stock || 0);
      } else if (tipoAjuste === 'conteo_fisico') {
        const fisicoNum = parseFloat(conteoFisicoValor);
        if (isNaN(fisicoNum) || fisicoNum < 0) {
          setFormError('Ingresa un conteo físico válido mayor o igual a 0.');
          return;
        }
        calculatedDelta = fisicoNum - (editingProduct.stock || 0);
      } else if (tipoAjuste === 'merma') {
        const mermaVal = Math.abs(parseFloat(formDelta) || 0);
        calculatedDelta = -mermaVal;
      } else {
        calculatedDelta = parseFloat(formDelta) || 0;
      }
    } else {
      const parsedInitial = parseFloat(formStockActual !== '' ? formStockActual : formDelta);
      initialStockValue = isNaN(parsedInitial) ? 0 : Math.max(0, parsedInitial);
      calculatedDelta = initialStockValue;
    }

    const rawData = editingProduct
      ? {
          id: editingProduct.id,
          nombre: formNombre || editingProduct.nombre,
          categoria: formCategoria,
          unidad_medida: formUnidadMedida,
          precio_venta: formPrecio,
          costo_unitario: formCosto,
          stock_minimo: formMinimo,
          delta: calculatedDelta,
          tipo_movimiento: tipoAjuste === 'merma' ? 'Merma' : tipoAjuste === 'conteo_fisico' ? 'Conteo físico' : 'Ajuste',
          codigo_barras: formCodigoBarras,
          activo: formActivo
        }
      : {
          nombre: formNombre,
          categoria: formCategoria,
          unidad_medida: formUnidadMedida,
          precio_venta: formPrecio,
          costo_unitario: formCosto,
          stock_minimo: formMinimo,
          stock_inicial: initialStockValue,
          codigo_barras: formCodigoBarras,
          activo: true
        };

    const validation = validateProductInput(rawData);
    if (!validation.isValid) {
      setFormError(validation.errors[0]);
      return;
    }

    if (editingProduct && (editingProduct.stock || 0) + validation.data.delta < 0) {
      setFormError('El stock resultante no puede quedar en negativo.');
      return;
    }

    onSaveProduct({
      ...validation.data,
      tipo_movimiento: rawData.tipo_movimiento || 'Ajuste'
    });
    setIsModalOpen(false);
  };

  // Toggle archivar directamente
  const handleToggleArchive = (prod, e) => {
    if (e) e.stopPropagation();
    if (!isDueno) return;
    const nuevoEstado = prod.activo === false;
    const confirmMsg = nuevoEstado
      ? `¿Deseas restaurar "${prod.nombre}" al catálogo activo?`
      : `¿Archivar "${prod.nombre}"? No aparecerá en ventas pero se conservará su historial.`;

    if (window.confirm(confirmMsg)) {
      onSaveProduct({
        ...prod,
        activo: nuevoEstado
      });
    }
  };

  // Cálculo de margen bruto en formulario
  const precioNum = parseFloat(formPrecio) || 0;
  const costoNum = parseFloat(formCosto) || 0;
  const gananciaBruta = precioNum - costoNum;
  const margenPorcentaje = precioNum > 0 ? Math.round((gananciaBruta / precioNum) * 100) : 0;

  return (
    <div>
      <div className="bar">
        <div>
          <h1>Inventario</h1>
          <p className="lead">
            {isDueno
              ? 'Control de existencias, unidades por peso/fracción, mermas y conteo físico.'
              : 'Modo lectura de inventario para cajero.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn o"
            onClick={() => exportProductsToCSV(products)}
            title="Exportar inventario a Excel o CSV"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
          >
            <IconDownload size={16} />
            <span>Exportar CSV</span>
          </button>
          {isDueno && onImportProducts && (
            <button
              type="button"
              className="btn o"
              onClick={() => setIsImportModalOpen(true)}
              title="Importar catálogo masivamente con validación previa"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
            >
              <IconUpload size={16} />
              <span>Importar Excel / CSV</span>
            </button>
          )}
          {isDueno && (
            <button type="button" className="btn p" onClick={openNewProduct} style={{ minHeight: '44px' }}>
              Nuevo producto
            </button>
          )}
          {onOpenAlerts && (
            <AlertBellButton alertCount={alertCount} onOpenAlerts={onOpenAlerts} />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sec stats">
        <div className="stat primary">
          <b>{activeProducts.length}</b>
          <span>Productos activos</span>
        </div>
        <div className="stat">
          <b>{money(totalValor)}</b>
          <span>Valorización en venta</span>
        </div>
        <div className="stat">
          <b>{lowStockCount}</b>
          <span>Stock bajo</span>
        </div>
        <div className="stat">
          <b>{outOfStockCount}</b>
          <span>Agotados</span>
        </div>
      </div>

      {/* Selector de Estado (Activos / Archivados / Todos) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="pill"
          aria-pressed={statusFilter === 'activos'}
          onClick={() => setStatusFilter('activos')}
          style={{ minHeight: '40px', padding: '6px 14px' }}
        >
          Activos ({activeProducts.length})
        </button>
        <button
          type="button"
          className="pill"
          aria-pressed={statusFilter === 'archivados'}
          onClick={() => setStatusFilter('archivados')}
          style={{ minHeight: '40px', padding: '6px 14px' }}
        >
          📦 Archivados ({archivedCount})
        </button>
        <button
          type="button"
          className="pill"
          aria-pressed={statusFilter === 'todos'}
          onClick={() => setStatusFilter('todos')}
          style={{ minHeight: '40px', padding: '6px 14px' }}
        >
          Todos ({products.length})
        </button>
      </div>

      {/* Búsqueda y Filtros de Categoría */}
      <input
        type="search"
        placeholder="Buscar por nombre o código de barras (ignora tildes)"
        aria-label="Buscar producto"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 14, minHeight: '44px' }}
      />

      <div className="pills" style={{ marginBottom: 16 }}>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className="pill"
            aria-pressed={categoryFilter === c}
            onClick={() => setCategoryFilter(c)}
            style={{ minHeight: '38px' }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Tabla y Tarjetas de Productos */}
      <div className="sec card">
        <div className="head">
          <div>Producto</div>
          <div>Categoría / Unidad</div>
          <div>{isDueno ? 'Precio / Costo' : 'Precio'}</div>
          <div>Stock</div>
          <div>Estado</div>
        </div>

        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => {
            const isArchived = p.activo === false;
            const isOut = (p.stock || 0) <= 0;
            const isLow = !isOut && (p.stock || 0) <= (p.stock_minimo || 5);
            const catStyle = getCategoryStyle(p.categoria || 'General');
            const unit = getUnidadMedida(p.unidad_medida);
            const displayStock = unit.decimal ? Number(p.stock || 0).toFixed(3) : Math.floor(p.stock || 0);

            const inner = (
              <>
                <div className="n">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <b style={{ fontWeight: 600, color: isArchived ? 'var(--graphite)' : 'inherit' }}>
                      {p.nombre}
                    </b>
                    {isArchived && (
                      <span className="badge" style={{ background: 'var(--mist)', color: 'var(--graphite)', fontSize: '10px' }}>
                        Archivado
                      </span>
                    )}
                  </div>
                  {p.codigo_barras && (
                    <small style={{ display: 'block', color: 'var(--graphite)', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                      🏷️ {p.codigo_barras}
                    </small>
                  )}
                </div>
                <div data-l="Categoría / Unidad">
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      className="cat-badge"
                      style={{
                        background: catStyle.bg,
                        color: catStyle.text,
                        border: `1px solid ${catStyle.border}`
                      }}
                    >
                      {catStyle.icon} {p.categoria || 'General'}
                    </span>
                    <span className="chip" style={{ fontSize: '11px', padding: '2px 6px' }}>
                      {unit.short}
                    </span>
                  </div>
                </div>
                <div data-l={isDueno ? "Precio / Costo" : "Precio"}>
                  <div className="price-display" style={{ fontWeight: 600 }}>{money(p.precio_venta)}</div>
                  {isDueno && p.costo_unitario > 0 && (
                    <small className="price-display" style={{ color: 'var(--pewter)', fontSize: '11px', display: 'block' }}>
                      Costo: {money(p.costo_unitario)}
                    </small>
                  )}
                </div>
                <div data-l="Stock">
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{displayStock}</span>{' '}
                  <span style={{ fontSize: '11px', color: 'var(--pewter)' }}>{unit.short}</span>
                  <small style={{ display: 'block', color: 'var(--pewter)', fontSize: '11px' }}>
                    mín. {p.stock_minimo || 5}
                  </small>
                </div>
                <div data-l="Estado" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  {isArchived ? (
                    <span className="stock-indicator" style={{ color: 'var(--pewter)' }}>
                      <span className="stock-dot" style={{ background: 'var(--pewter)' }} /> Archivado
                    </span>
                  ) : isOut ? (
                    <span className="stock-indicator out">
                      <span className="stock-dot out" /> Agotado
                    </span>
                  ) : isLow ? (
                    <span className="stock-indicator low">
                      <span className="stock-dot low" /> Stock bajo
                    </span>
                  ) : (
                    <span className="stock-indicator ok">
                      <span className="stock-dot ok" /> Normal
                    </span>
                  )}

                  {isDueno && (
                    <button
                      type="button"
                      className="btn g s"
                      title={isArchived ? 'Restaurar producto' : 'Archivar producto'}
                      onClick={(e) => handleToggleArchive(p, e)}
                      style={{ fontSize: '11px', padding: '4px 8px', minHeight: '34px' }}
                    >
                      {isArchived ? 'Reactivar' : 'Archivar'}
                    </button>
                  )}
                </div>
              </>
            );

            return (
              <div
                key={p.id}
                className="row"
                role={isDueno ? "button" : undefined}
                tabIndex={isDueno ? 0 : undefined}
                onClick={isDueno ? () => openEditProduct(p) : undefined}
                onKeyDown={isDueno ? (e) => { if (e.key === 'Enter') openEditProduct(p); } : undefined}
                style={{ textAlign: 'left', minHeight: '52px', cursor: isDueno ? 'pointer' : 'default' }}
              >
                {inner}
              </div>
            );
          })
        ) : (
          <div className="empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <p style={{ fontWeight: 600, margin: '0 0 6px 0' }}>No hay productos en esta vista</p>
            <span style={{ color: 'var(--pewter)', fontSize: '13px' }}>
              Prueba cambiando el filtro de estado o el término de búsqueda.
            </span>
          </div>
        )}
      </div>

      {/* Movimientos Recientes con tipo de ajuste enriquecido */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Movimientos y Mermas Recientes</h2>
        {movements.length > 0 ? (
          movements
            .slice(-8)
            .reverse()
            .map((m, idx) => {
              const prod = products.find((p) => String(p.id) === String(m.producto_id));
              const isNegative = m.cantidad < 0;
              const isMerma = m.tipo === 'Merma';

              return (
                <div key={m.id || idx} className="li" style={{ minHeight: '44px', padding: '10px 16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className="badge"
                        style={{
                          background: isMerma ? '#fee2e2' : isNegative ? 'var(--fog)' : '#dcfce7',
                          color: isMerma ? '#b91c1c' : isNegative ? 'var(--graphite)' : '#15803d',
                          fontWeight: '600',
                          fontSize: '11px'
                        }}
                      >
                        {m.tipo || 'Movimiento'}
                      </span>
                      <b style={{ fontSize: '13px' }}>{prod ? prod.nombre : (m.producto_nombre || 'Producto')}</b>
                    </div>
                    <small style={{ color: 'var(--pewter)', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                      {m.hora} · {m.usuario || 'Sistema'}
                    </small>
                  </div>
                  <b style={{ color: isMerma || isNegative ? '#b91c1c' : '#15803d', fontSize: '14px' }}>
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </b>
                </div>
              );
            })
        ) : (
          <div className="empty" style={{ padding: '20px', textAlign: 'center' }}>
            No hay movimientos de inventario registrados recientemente.
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Producto */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Editar: ${editingProduct.nombre}` : 'Nuevo Producto'}
        maxWidth={580}
      >
        <form className="f" onSubmit={handleSubmit}>
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '12px'
              }}
            >
              ⚠️ {formError}
            </div>
          )}

          <label>
            <span>Nombre del producto</span>
            <input
              required
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="Ej: Pollo entero, Manzana Israel, Arroz Costeño 1kg"
              style={{ minHeight: '44px' }}
            />
          </label>

          {/* Código de Barras con Detección de Duplicados en Tiempo Real */}
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span>Código de barras (único por tienda)</span>
              <button
                type="button"
                className="btn g s"
                style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '32px' }}
                onClick={() => setIsBarcodeModalOpen(true)}
                title="Escanear código con la cámara"
              >
                <IconCamera size={13} />
                <span>Escanear cámara</span>
              </button>
            </div>
            <input
              value={formCodigoBarras}
              onChange={(e) => setFormCodigoBarras(e.target.value)}
              placeholder="Ej: 7750106001012 (o dispara tu pistola USB)"
              style={{
                fontFamily: 'monospace',
                minHeight: '44px',
                borderColor: duplicateBarcodeProduct ? '#ef4444' : undefined
              }}
            />
            {duplicateBarcodeProduct && (
              <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                ⚠️ Código ya usado por "{duplicateBarcodeProduct.nombre}". Los códigos de barra deben ser únicos.
              </span>
            )}
          </label>

          {/* Categoría y Unidad de Medida */}
          <div className="g2">
            <label>
              <span>Categoría</span>
              <input
                list="cat-list"
                value={formCategoria}
                onChange={(e) => setFormCategoria(e.target.value)}
                placeholder="Ej: Abarrotes, Carnes, Frutas..."
                required
                style={{ minHeight: '44px' }}
              />
              <datalist id="cat-list">
                {categories.filter((c) => c !== 'Todos').map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Unidad de medida</span>
              <select
                value={formUnidadMedida}
                onChange={(e) => setFormUnidadMedida(e.target.value)}
                style={{ minHeight: '44px' }}
              >
                {UNIDADES_MEDIDA.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Precios y Margen */}
          <div className={isDueno ? "g2" : ""}>
            <label>
              <span>Precio de venta (S/.)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={formPrecio}
                onChange={(e) => setFormPrecio(e.target.value)}
                style={{ minHeight: '44px' }}
              />
            </label>
            {isDueno && (
              <label>
                <span>Costo de compra (S/. opcional)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCosto}
                  onChange={(e) => setFormCosto(e.target.value)}
                  placeholder="Para medir rentabilidad"
                  style={{ minHeight: '44px' }}
                />
              </label>
            )}
          </div>

          {isDueno && precioNum > 0 && costoNum > 0 && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--fog)',
                borderRadius: '8px',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}
            >
              <span>Ganancia estimada: <b className="price-display">{money(gananciaBruta)}</b></span>
              <span>Margen bruto: <b className="price-display" style={{ color: margenPorcentaje >= 25 ? '#15803d' : '#d97706' }}>{margenPorcentaje}%</b></span>
            </div>
          )}

          <div className="g2">
            <label>
              <span>Stock mínimo alerta ({currentUnitConfig.short})</span>
              <input
                type="number"
                min="0"
                step={currentUnitConfig.decimal ? '0.001' : '1'}
                required
                value={formMinimo}
                onChange={(e) => setFormMinimo(e.target.value)}
                style={{ minHeight: '44px' }}
              />
            </label>

            <label>
              <span>Stock actual en tienda ({currentUnitConfig.short}) *</span>
              <input
                type="number"
                min="0"
                step={currentUnitConfig.decimal ? '0.001' : '1'}
                placeholder="0"
                required
                value={formStockActual}
                onChange={(e) => {
                  setFormStockActual(e.target.value);
                  if (editingProduct) {
                    setTipoAjuste('conteo_fisico');
                    setConteoFisicoValor(e.target.value);
                  }
                }}
                style={{ minHeight: '44px', fontWeight: 'bold' }}
              />
            </label>
          </div>

          {/* Si es edición: Opciones avanzadas de entrada o merma */}
          {editingProduct && (
            <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--fog)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Ajustes rápidos de stock</span>
                <span style={{ fontSize: '11px', color: 'var(--pewter)' }}>
                  En sistema: <b>{editingProduct.stock || 0} {currentUnitConfig.short}</b>
                </span>
              </div>
              <div className="g2">
                <label>
                  <span style={{ fontSize: '11px' }}>Tipo de ajuste</span>
                  <select
                    value={tipoAjuste}
                    onChange={(e) => {
                      setTipoAjuste(e.target.value);
                      if (e.target.value === 'conteo_fisico') {
                        setFormStockActual(String(editingProduct.stock || 0));
                      }
                    }}
                    style={{ minHeight: '38px', fontSize: '12px' }}
                  >
                    <option value="conteo_fisico">Stock Total Directo</option>
                    <option value="ingreso">Entrada de Mercancía (+)</option>
                    <option value="merma">Merma o Desecho (-)</option>
                  </select>
                </label>

                {tipoAjuste === 'ingreso' && (
                  <label>
                    <span style={{ fontSize: '11px' }}>Cantidad a sumar (+)</span>
                    <input
                      type="number"
                      min="0.001"
                      step={currentUnitConfig.decimal ? '0.001' : '1'}
                      value={formDelta}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormDelta(val);
                        setFormStockActual(String(Math.round(((editingProduct.stock || 0) + val) * 1000) / 1000));
                      }}
                      placeholder="Ej. 10"
                      style={{ minHeight: '38px', fontSize: '12px' }}
                    />
                  </label>
                )}

                {tipoAjuste === 'merma' && (
                  <label>
                    <span style={{ fontSize: '11px' }}>Cantidad a restar (-)</span>
                    <input
                      type="number"
                      min="0.001"
                      step={currentUnitConfig.decimal ? '0.001' : '1'}
                      value={formDelta}
                      onChange={(e) => {
                        const val = Math.abs(parseFloat(e.target.value) || 0);
                        setFormDelta(val);
                        setFormStockActual(String(Math.max(0, Math.round(((editingProduct.stock || 0) - val) * 1000) / 1000)));
                      }}
                      placeholder="Ej. 2"
                      style={{ minHeight: '38px', fontSize: '12px' }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Opción de estado activo / archivado */}
          {editingProduct && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
              <input
                type="checkbox"
                id="prod-activo-chk"
                checked={formActivo}
                onChange={(e) => setFormActivo(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="prod-activo-chk" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>
                <b>Producto activo para la venta</b> (desmarcar para archivar sin perder historial)
              </label>
            </div>
          )}

          <div className="acts" style={{ marginTop: 16 }}>
            <button type="submit" className="btn p" style={{ minHeight: '44px' }}>
              {editingProduct ? 'Guardar cambios' : 'Crear producto'}
            </button>
            <button
              type="button"
              className="btn o"
              onClick={() => setIsModalOpen(false)}
              style={{ minHeight: '44px' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Importación Masiva Excel / CSV */}
      <ImportarInventarioModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportProducts={onImportProducts}
        existingProducts={products}
      />

      {/* Modal de Escaneo con Cámara */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        onScan={(code) => setFormCodigoBarras(code)}
        title="Escanear Código de Barras"
        continuousDefault={false}
      />
    </div>
  );
}
