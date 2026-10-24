import React, { useState, useRef, useEffect } from 'react';
import { money, getUnidadMedida, normalizeSearch } from '../../constants/palettes';
import { getCategoryStyle } from '../../constants/categories';
import { validateSaleCheckout, generateIdempotencyKey } from '../../utils/security';
import { IconMaximize, IconMinimize, IconSun, IconMoon, IconCamera, IconBarcode } from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playBeepSuccess, playBeepError } from '../../utils/audio';
import BarcodeScannerModal from '../common/BarcodeScannerModal';
import AlertBellButton from '../common/AlertBellButton';

export default function VenderTab({
  products = [],
  cart = {},
  onAddToCart,
  onDecFromCart,
  onClearCart,
  onCheckout,
  storeName = "Minimarket La Esquina",
  userName = "Cajero",
  storeLogo = null,
  paymentMethods = ['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia'],
  alertCount = 0,
  onOpenAlerts
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [metodoPago, setMetodoPago] = useState(paymentMethods[0] || 'Efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [isCashierMode, setIsCashierMode] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState(null);

  // Pagos Mixtos state
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoDigital, setPagoDigital] = useState('');
  const [metodoDigital, setMetodoDigital] = useState('Yape / Plin');

  // Modal para ingresar peso / cantidad decimal personalizada
  const [weightModalProduct, setWeightModalProduct] = useState(null);
  const [customWeightInput, setCustomWeightInput] = useState('');

  const searchInputRef = useRef(null);
  const cashierSearchInputRef = useRef(null);
  const { theme, toggleTheme } = useTheme();

  // Enfoque automático inmediato en el buscador/escáner al montar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isCashierMode) {
        cashierSearchInputRef.current?.focus();
      } else {
        searchInputRef.current?.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isCashierMode]);

  // Manejador centralizado de lectura de códigos de barra (Pistola USB y Cámara móvil)
  const handleBarcodeScanned = (scannedCode) => {
    const clean = String(scannedCode || '').trim();
    if (!clean) return;

    // Buscar coincidencia exacta por codigo_barras o por ID
    const prod = products.find(
      (p) =>
        p.activo !== false &&
        (String(p.codigo_barras || '').trim() === clean || String(p.id).trim() === clean)
    );

    if (prod) {
      if (prod.stock <= 0) {
        playBeepError();
        setScannerFeedback({ type: 'error', message: `⚠️ "${prod.nombre}" está agotado.` });
        setTimeout(() => setScannerFeedback(null), 3500);
        return;
      }

      const unit = getUnidadMedida(prod.unidad_medida);
      if (unit.decimal) {
        // Si se vende por peso o fracción, abrir selector de peso rápido
        setWeightModalProduct(prod);
        setCustomWeightInput(unit.id === 'kg' ? '1.000' : '1');
        return;
      }

      const currentQty = cart[prod.id] || 0;
      if (currentQty >= prod.stock) {
        playBeepError();
        setScannerFeedback({ type: 'error', message: `⚠️ Stock máximo alcanzado para "${prod.nombre}" (${prod.stock} ${unit.short}).` });
        setTimeout(() => setScannerFeedback(null), 3500);
        return;
      }

      onAddToCart(prod.id, 1);
      playBeepSuccess();
      setScannerFeedback({ type: 'success', message: `✓ "${prod.nombre}" agregado (+1)` });
      setTimeout(() => setScannerFeedback(null), 2500);
    } else {
      playBeepError();
      setScannerFeedback({ type: 'error', message: `⚠️ Código "${clean}" no encontrado en inventario activo.` });
      setTimeout(() => setScannerFeedback(null), 3500);
    }
  };

  // Captura automática de pistolas USB / Bluetooth
  useBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: !isCameraScannerOpen && !weightModalProduct
  });

  // Reloj en tiempo real para el modo cajero
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Categorías y Productos Activos
  const activeProducts = products.filter((p) => p.activo !== false);
  const categories = ['Todos', ...new Set(activeProducts.map((p) => p.categoria || 'General'))];

  // Filtro de productos (ignora tildes, mayúsculas y diacríticos)
  const filteredProducts = activeProducts.filter((p) => {
    const term = normalizeSearch(searchTerm);
    const matchesSearch =
      !term ||
      normalizeSearch(p.nombre).includes(term) ||
      (p.codigo_barras && String(p.codigo_barras).toLowerCase().includes(term));
    const matchesCat = categoryFilter === 'Todos' || (p.categoria || 'General') === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Cálculo del total del carrito
  const cartEntries = Object.entries(cart);
  const totalCart = Math.round(
    cartEntries.reduce((sum, [id, qty]) => {
      const prod = products.find((p) => String(p.id) === String(id));
      return sum + (prod ? prod.precio_venta * qty : 0);
    }, 0) * 100
  ) / 100;

  // Cálculos de Pagos
  const isEfectivo = metodoPago === 'Efectivo';
  const isMixto = metodoPago === 'Mixto';
  const recibidoNum = parseFloat(montoRecibido) || 0;

  // Validación de pago mixto
  const numEf = parseFloat(pagoEfectivo) || 0;
  const numDig = parseFloat(pagoDigital) || 0;
  const sumaMixto = Math.round((numEf + numDig) * 100) / 100;
  const diffMixto = Math.round((totalCart - sumaMixto) * 100) / 100;
  const isMixtoCuadrado = Math.abs(diffMixto) <= 0.01 && sumaMixto > 0;

  const hasEnoughCash = isMixto
    ? isMixtoCuadrado
    : !isEfectivo || montoRecibido === '' || recibidoNum >= totalCart;

  // Estado de la acción de venta
  const [sellingState, setSellingState] = useState('idle');
  const [validationError, setValidationError] = useState('');

  const handlePay = async () => {
    if (cartEntries.length === 0 || sellingState !== 'idle') return;

    // Idempotencia para evitar cobro duplicado por doble tap
    const idempotencyKey = generateIdempotencyKey();

    let pagosMixtosPayload = null;
    if (isMixto) {
      pagosMixtosPayload = [
        { metodo: 'Efectivo', monto: numEf },
        { metodo: metodoDigital, monto: numDig }
      ];
    }

    const validation = validateSaleCheckout({
      cart,
      products,
      metodoPago,
      pagosMixtos: pagosMixtosPayload,
      montoRecibido: isEfectivo && montoRecibido !== '' ? recibidoNum : null,
      idempotencyKey
    });

    if (!validation.isValid) {
      setValidationError(validation.errors[0] || 'Error en los datos de la venta.');
      setTimeout(() => setValidationError(''), 4000);
      return;
    }

    setSellingState('loading');
    try {
      await onCheckout({
        metodo_pago: metodoPago,
        monto_recibido: isEfectivo && montoRecibido !== '' ? recibidoNum : null,
        pagos_mixtos: pagosMixtosPayload,
        idempotency_key: idempotencyKey
      });

      setSellingState('success');
      setTimeout(() => {
        setSellingState('idle');
        setMontoRecibido('');
        setPagoEfectivo('');
        setPagoDigital('');
        setValidationError('');
        // Re-enfocar el escáner para la siguiente venta de inmediato
        if (isCashierMode) {
          cashierSearchInputRef.current?.focus();
        } else {
          searchInputRef.current?.focus();
        }
      }, 700);
    } catch (err) {
      console.error(err);
      setSellingState('idle');
    }
  };

  // Manejo de clic en producto
  const handleProductClick = (prod) => {
    const unit = getUnidadMedida(prod.unidad_medida);
    if (unit.decimal) {
      setWeightModalProduct(prod);
      const existing = cart[prod.id] || 0;
      setCustomWeightInput(existing > 0 ? String(existing) : (unit.id === 'kg' ? '1.000' : '1'));
    } else {
      onAddToCart(prod.id, 1);
    }
  };

  // Confirmar peso en modal
  const handleConfirmWeight = () => {
    if (!weightModalProduct) return;
    const qty = parseFloat(customWeightInput);
    if (isNaN(qty) || qty <= 0) return;

    const finalQty = Math.min(qty, weightModalProduct.stock);
    onAddToCart(weightModalProduct.id, finalQty, true); // true indica replace/set directo
    setWeightModalProduct(null);
    playBeepSuccess();
  };

  // Atajos de Teclado (F2: Buscar/Escáner, F4: Cobrar, Esc: Limpiar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (isCashierMode) {
          cashierSearchInputRef.current?.focus();
        } else {
          searchInputRef.current?.focus();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cartEntries.length > 0 && hasEnoughCash && sellingState === 'idle') {
          handlePay();
        }
      } else if (e.key === 'F11') {
        e.preventDefault();
        setIsCashierMode((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (weightModalProduct) {
          setWeightModalProduct(null);
        } else if (isCashierMode) {
          if (searchTerm) {
            setSearchTerm('');
          } else {
            setIsCashierMode(false);
          }
        } else if (searchTerm) {
          setSearchTerm('');
        } else if (cartEntries.length > 0) {
          onClearCart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartEntries.length, hasEnoughCash, searchTerm, totalCart, metodoPago, montoRecibido, isCashierMode, sellingState, weightModalProduct]);

  // Contenido del Carrito
  const renderCartCard = () => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--mist)' }}>
        <h2 style={{ margin: 0, padding: 0, border: 0, fontSize: '16px' }}>Venta actual</h2>
        {cartEntries.length > 0 && (
          <span className="chip" style={{ fontSize: '12px', fontWeight: '700' }}>
            {cartEntries.length} {cartEntries.length === 1 ? 'producto' : 'productos'}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: isCashierMode ? 'calc(100vh - 440px)' : '340px' }}>
        {cartEntries.length > 0 ? (
          cartEntries.map(([id, qty]) => {
            const prod = products.find((p) => String(p.id) === String(id));
            if (!prod) return null;
            const subtotal = Math.round(prod.precio_venta * qty * 100) / 100;
            const catStyle = getCategoryStyle(prod.categoria || 'General');
            const unit = getUnidadMedida(prod.unidad_medida);
            const step = unit.decimal ? (unit.id === 'kg' ? 0.25 : 1) : 1;
            const formattedQty = unit.decimal ? Number(qty).toFixed(3) : qty;

            return (
              <div key={id} className="li" style={{ padding: '12px 18px' }}>
                <div style={{ flex: 1, paddingRight: '8px' }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--ink)' }}>
                    {prod.nombre}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: catStyle.bg,
                        color: catStyle.text,
                        fontWeight: '500'
                      }}
                    >
                      {prod.categoria || 'General'}
                    </span>
                    <small style={{ color: 'var(--pewter)', fontSize: '11px' }}>
                      {money(prod.precio_venta)} / {unit.short}
                    </small>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ink)', marginTop: '2px' }}>
                    Subtotal: {money(subtotal)}
                  </div>
                </div>

                <div className="qty" style={{ alignItems: 'center' }}>
                  <button
                    type="button"
                    aria-label="Quitar cantidad"
                    onClick={() => onDecFromCart(id, step)}
                    style={{ width: '32px', height: '32px', borderRadius: '6px', fontSize: '16px' }}
                  >
                    −
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (unit.decimal) {
                        setWeightModalProduct(prod);
                        setCustomWeightInput(String(qty));
                      }
                    }}
                    title={unit.decimal ? 'Toca para editar peso exacto' : undefined}
                    style={{
                      minWidth: '48px',
                      textAlign: 'center',
                      fontWeight: '700',
                      fontSize: '13px',
                      background: 'transparent',
                      border: unit.decimal ? '1px dashed var(--pewter)' : 'none',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      cursor: unit.decimal ? 'pointer' : 'default'
                    }}
                  >
                    {formattedQty} <small style={{ fontSize: '10px', fontWeight: 'normal' }}>{unit.short}</small>
                  </button>

                  <button
                    type="button"
                    aria-label="Agregar cantidad"
                    disabled={qty >= prod.stock}
                    onClick={() => onAddToCart(id, step)}
                    style={{ width: '32px', height: '32px', borderRadius: '6px', fontSize: '16px' }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            🛒 Escanea un producto o selecciónalo del catálogo.
          </div>
        )}
      </div>

      <div className="pad" style={{ borderTop: '1px solid var(--mist)', padding: '16px 20px', background: 'var(--paper)' }}>
        <span className="hint" style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>
          Forma de pago
        </span>
        <div className="seg" style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {[...(paymentMethods || ['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia']), 'Mixto'].map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metodoPago === m}
              onClick={() => setMetodoPago(m)}
              style={{ fontSize: '12px', padding: '6px 10px', flex: '1 1 auto', minWidth: '70px', textAlign: 'center', minHeight: '38px' }}
            >
              {m === 'Mixto' ? '⚡ Mixto' : m}
            </button>
          ))}
        </div>

        {/* Pago en Efectivo */}
        {isEfectivo && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="hint" htmlFor="monto-recibido" style={{ fontWeight: '500' }}>
                Monto recibido del cliente:
              </label>
              {totalCart > 0 && (
                <small style={{ color: 'var(--pewter)', fontSize: '11px' }}>
                  Total: {money(totalCart)}
                </small>
              )}
            </div>

            <input
              id="monto-recibido"
              type="number"
              min="0"
              step="0.01"
              value={montoRecibido}
              placeholder="0.00"
              style={{ marginTop: 4, minHeight: '44px', fontSize: '15px', fontWeight: '700' }}
              onChange={(e) => setMontoRecibido(e.target.value)}
            />

            {/* Calculadora de Vuelto Rápido */}
            <div className="quick-cash-grid" style={{ marginTop: '6px' }}>
              <button
                type="button"
                className="quick-cash-btn"
                onClick={() => setMontoRecibido(totalCart.toFixed(2))}
                title="Cobrar el monto exacto"
                disabled={totalCart === 0}
              >
                Exacto
              </button>
              {[10, 20, 50, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  className="quick-cash-btn"
                  onClick={() => setMontoRecibido(val.toString())}
                  title={`Paga con billete de S/. ${val}`}
                >
                  S/. {val}
                </button>
              ))}
            </div>

            {montoRecibido !== '' && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  marginTop: '6px',
                  background: recibidoNum >= totalCart ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                  color: recibidoNum >= totalCart ? '#059669' : '#dc2626'
                }}
              >
                {recibidoNum >= totalCart
                  ? `✓ Vuelto a entregar: ${money(recibidoNum - totalCart)}`
                  : `⚠️ Faltan ${money(totalCart - recibidoNum)}`}
              </div>
            )}
          </div>
        )}

        {/* Pago Mixto (Efectivo + Digital) */}
        {isMixto && (
          <div style={{ marginBottom: '12px', background: 'var(--fog)', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
              Dividir cobro en dos formas de pago:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                  Efectivo (S/.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pagoEfectivo}
                  onChange={(e) => setPagoEfectivo(e.target.value)}
                  placeholder="0.00"
                  style={{ minHeight: '38px', fontSize: '13px', fontWeight: '600' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                  {metodoDigital} (S/.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pagoDigital}
                  onChange={(e) => setPagoDigital(e.target.value)}
                  placeholder="0.00"
                  style={{ minHeight: '38px', fontSize: '13px', fontWeight: '600' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <button
                type="button"
                className="btn g s"
                style={{ fontSize: '11px', flex: 1, padding: '4px' }}
                onClick={() => {
                  if (numEf > 0 && numEf <= totalCart) {
                    setPagoDigital((totalCart - numEf).toFixed(2));
                  } else {
                    const half = Math.round((totalCart / 2) * 100) / 100;
                    setPagoEfectivo(half.toFixed(2));
                    setPagoDigital((totalCart - half).toFixed(2));
                  }
                }}
              >
                Completar restante
              </button>
              <select
                value={metodoDigital}
                onChange={(e) => setMetodoDigital(e.target.value)}
                style={{ fontSize: '11px', minHeight: '30px' }}
              >
                <option value="Yape / Plin">Yape / Plin</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            </div>

            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                padding: '6px 8px',
                borderRadius: '6px',
                background: isMixtoCuadrado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                color: isMixtoCuadrado ? '#15803d' : '#dc2626'
              }}
            >
              {isMixtoCuadrado
                ? `✓ Monto exacto cubierto (${money(sumaMixto)})`
                : diffMixto > 0
                ? `⚠️ Faltan S/. ${diffMixto.toFixed(2)} por asignar`
                : `⚠️ Sobran S/. ${Math.abs(diffMixto).toFixed(2)}`}
            </div>
          </div>
        )}

        {/* Pago Simple No Efectivo */}
        {!isEfectivo && !isMixto && totalCart > 0 && (
          <div
            style={{
              marginBottom: '12px',
              padding: '8px 12px',
              background: 'var(--fog)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--graphite)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{metodoPago.toLowerCase().includes('yape') || metodoPago.toLowerCase().includes('plin') ? '📱' : metodoPago.toLowerCase().includes('tarjeta') ? '💳' : '🏦'}</span>
            <span>Pago con <b>{metodoPago}</b> ({money(totalCart)}). Exacto.</span>
          </div>
        )}

        {/* Mensaje de error si existe */}
        {validationError && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#dc2626',
              marginBottom: '10px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            {validationError}
          </div>
        )}

        {/* TOTAL MUY VISIBLE (UX Requirement) */}
        <div
          style={{
            padding: '12px 14px',
            background: 'color-mix(in srgb, var(--ember) 8%, var(--fog))',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            border: '1px solid color-mix(in srgb, var(--ember) 25%, var(--mist))'
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: '600' }}>TOTAL</span>
          <span style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--ember)' }}>
            {money(totalCart)}
          </span>
        </div>

        <button
          type="button"
          className="btn p"
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minHeight: '48px',
            fontSize: '16px',
            fontWeight: '700',
            transition: 'all 0.25s ease',
            ...(sellingState === 'success'
              ? { background: '#10b981', borderColor: '#10b981', color: '#ffffff' }
              : {})
          }}
          disabled={cartEntries.length === 0 || !hasEnoughCash || sellingState !== 'idle'}
          onClick={handlePay}
        >
          {sellingState === 'loading' ? (
            <>
              <span className="spinner-border" />
              <span>Cobrando venta...</span>
            </>
          ) : sellingState === 'success' ? (
            <span>¡Venta realizada! ✓</span>
          ) : (
            <>
              <span>Cobrar venta (F4)</span>
              {totalCart > 0 && <span>· {money(totalCart)}</span>}
            </>
          )}
        </button>

        {cartEntries.length > 0 && (
          <button
            type="button"
            className="btn g"
            style={{ width: '100%', marginTop: 8, fontSize: '12px', minHeight: '36px' }}
            onClick={onClearCart}
          >
            Vaciar venta (Esc)
          </button>
        )}
      </div>
    </div>
  );

  // Render del Catálogo de Productos
  const renderCatalog = (inputRef) => (
    <div>
      {/* Alerta de confirmación de escáner */}
      {scannerFeedback && (
        <div
          style={{
            marginBottom: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            background: scannerFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: scannerFeedback.type === 'success' ? '#15803d' : '#dc2626',
            border: `1px solid ${scannerFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {scannerFeedback.message}
        </div>
      )}


      {/* Buscador con autofoco y atajo F2 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 14 }}>
        <input
          ref={inputRef}
          type="search"
          placeholder="Escanear código de barras o buscar por nombre (F2)"
          aria-label="Buscar producto"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minHeight: '44px', fontSize: '14px' }}
        />
        <button
          type="button"
          className="btn o s"
          onClick={() => setIsCameraScannerOpen(true)}
          title="Abrir cámara del dispositivo para escanear"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            padding: '0 14px',
            minHeight: '44px'
          }}
        >
          <IconCamera size={18} />
          <span>Cámara</span>
        </button>
      </div>

      {/* Pastillas de filtro de categoría */}
      <div className="pills" style={{ marginBottom: 14 }}>
        {categories.map((c) => {
          const catStyle = c === 'Todos' ? null : getCategoryStyle(c);
          const isSelected = categoryFilter === c;

          return (
            <button
              key={c}
              type="button"
              className="pill"
              aria-pressed={isSelected}
              onClick={() => setCategoryFilter(c)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                minHeight: '36px',
                ...(isSelected && catStyle ? { borderColor: catStyle.text } : {})
              }}
            >
              {catStyle && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: catStyle.dot,
                    display: 'inline-block'
                  }}
                />
              )}
              <span>{c}</span>
            </button>
          );
        })}
      </div>

      {/* Cuadrícula de productos */}
      <div className="tiles">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => {
            const inCart = cart[p.id] || 0;
            const isOutOfStock = p.stock <= 0;
            const isMaxInCart = inCart >= p.stock;
            const isLowStock = p.stock > 0 && p.stock <= (p.stock_minimo || 5);
            const catStyle = getCategoryStyle(p.categoria || 'General');
            const unit = getUnidadMedida(p.unidad_medida);

            return (
              <button
                key={p.id}
                type="button"
                className="tile"
                disabled={isOutOfStock || isMaxInCart}
                onClick={() => handleProductClick(p)}
                style={{ minHeight: '100px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
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
                  {inCart > 0 && (
                    <i style={{ background: 'var(--ember)', color: 'var(--onacc)', padding: '2px 8px', borderRadius: '10px', fontStyle: 'normal', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 2px 6px color-mix(in srgb, var(--ember) 40%, transparent)' }}>
                      {unit.decimal ? Number(inCart).toFixed(2) : inCart}
                    </i>
                  )}
                </div>

                <b style={{ fontSize: '13px', lineHeight: '1.3' }}>{p.nombre}</b>

                <div>
                  <div className="pr">
                    {money(p.precio_venta)} <small style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--pewter)' }}>/{unit.short}</small>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    {isOutOfStock ? (
                      <span className="stock-indicator out">
                        <span className="stock-dot out" /> Agotado
                      </span>
                    ) : isLowStock ? (
                      <span className="stock-indicator low">
                        <span className="stock-dot low" /> Quedan {unit.decimal ? Number(p.stock).toFixed(2) : p.stock}
                      </span>
                    ) : (
                      <span className="stock-indicator ok">
                        <span className="stock-dot ok" /> {unit.decimal ? Number(p.stock).toFixed(2) : p.stock} {unit.short}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="empty" style={{ gridColumn: '1 / -1', padding: '36px 16px', textAlign: 'center' }}>
            No se encontraron productos con ese filtro.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Vista Normal */}
      <div className="bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1>Nueva venta</h1>
            <span className="chip" style={{ fontSize: '11px', background: 'var(--fog)', color: 'var(--graphite)' }}>
              POS
            </span>
          </div>
          <p className="lead">Atajos: F2 (Buscador/Escáner), F4 (Cobrar), Esc (Limpiar).</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn p s"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
            onClick={() => setIsCashierMode(true)}
            title="Abrir pantalla completa para cobrar rápido"
          >
            <IconMaximize size={16} />
            <span>Modo Cajero (F11)</span>
          </button>
          {onOpenAlerts && (
            <AlertBellButton alertCount={alertCount} onOpenAlerts={onOpenAlerts} />
          )}
        </div>
      </div>

      <div className="pos-split" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>{renderCatalog(searchInputRef)}</div>
        <div style={{ position: 'sticky', top: '16px' }}>{renderCartCard()}</div>
      </div>

      {/* Modo Cajero Pantalla Completa */}
      {isCashierMode && (
        <div
          className="cashier-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--paper)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header del Modo Cajero */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--mist)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--fog)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {storeLogo && (
                <img src={storeLogo} alt="Logo" style={{ maxHeight: '32px', maxWidth: '80px', objectFit: 'contain' }} />
              )}
              <b style={{ fontSize: '16px' }}>{storeName}</b>
              <span className="chip" style={{ fontSize: '11px' }}>{userName}</span>
              <span style={{ fontSize: '13px', color: 'var(--pewter)', fontFamily: 'monospace' }}>{currentTime}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn o s"
                onClick={toggleTheme}
                style={{ padding: '6px 10px', minHeight: '36px' }}
                title="Cambiar tema claro / oscuro"
              >
                {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
              </button>
              <button
                type="button"
                className="btn o s"
                onClick={() => setIsCashierMode(false)}
                style={{ minHeight: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <IconMinimize size={15} />
                <span>Salir (Esc)</span>
              </button>
            </div>
          </div>

          {/* Cuerpo del Modo Cajero */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px', gap: '20px', padding: '20px', overflowY: 'auto' }}>
            <div style={{ minWidth: 0 }}>{renderCatalog(cashierSearchInputRef)}</div>
            <div>{renderCartCard()}</div>
          </div>
        </div>
      )}

      {/* Modal para ingresar peso o fracción manual */}
      {weightModalProduct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: 'var(--paper)',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
            }}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: '17px' }}>Venta por peso / fracción</h3>
            <p className="lead" style={{ margin: '0 0 16px', fontSize: '13px' }}>
              {weightModalProduct.nombre} · {money(weightModalProduct.precio_venta)}/{getUnidadMedida(weightModalProduct.unidad_medida).short}
            </p>

            <label style={{ display: 'block', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Cantidad a vender ({getUnidadMedida(weightModalProduct.unidad_medida).label}):
              </span>
              <input
                type="number"
                min="0.001"
                step="0.005"
                autoFocus
                value={customWeightInput}
                onChange={(e) => setCustomWeightInput(e.target.value)}
                style={{ marginTop: '4px', minHeight: '44px', fontSize: '18px', fontWeight: 'bold' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['0.250', '0.500', '0.750', '1.000', '1.500', '2.000'].map((w) => (
                <button
                  key={w}
                  type="button"
                  className="btn o s"
                  onClick={() => setCustomWeightInput(w)}
                  style={{ fontSize: '12px', flex: '1 1 28%' }}
                >
                  {w} {getUnidadMedida(weightModalProduct.unidad_medida).short}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--fog)', borderRadius: '8px', marginBottom: '16px' }}>
              <span>Subtotal estimado:</span>
              <b>{money((parseFloat(customWeightInput) || 0) * weightModalProduct.precio_venta)}</b>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn p"
                style={{ flex: 1, minHeight: '44px' }}
                onClick={handleConfirmWeight}
              >
                Agregar al carrito
              </button>
              <button
                type="button"
                className="btn o"
                onClick={() => setWeightModalProduct(null)}
                style={{ minHeight: '44px' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Escaneo con Cámara */}
      <BarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Escanear Código para Venta"
        continuousDefault={true}
      />
    </div>
  );
}
