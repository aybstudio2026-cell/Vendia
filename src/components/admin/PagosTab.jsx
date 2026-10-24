import React, { useState, useRef, useEffect } from 'react';
import { money, fd, diffDays } from '../../constants/palettes';
import { IconWhatsApp, IconDownload, IconCheck } from '../common/Icons';
import Modal from '../common/Modal';
import Pagination from '../common/Pagination';

const ITEMS_PER_PAGE = 10;

export default function PagosTab({ stores = [], payments = [], onRegisterPayment }) {
  const today = new Date();
  const [activeSubTab, setActiveSubTab] = useState('historial'); // 'historial' | 'cobranzas'
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [cobranzasPage, setCobranzasPage] = useState(1);

  useEffect(() => {
    setPaymentsPage(1);
  }, [searchTerm]);

  // Modal de registro de pago
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('Yape / Plin');
  const [pagoNota, setPagoNota] = useState('');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [comprobantePreview, setComprobantePreview] = useState('');
  const fileInputRef = useRef(null);

  // Modal de visualización de comprobante
  const [viewingProof, setViewingProof] = useState(null);

  // Lista unificada de pagos
  const allPayments = payments && payments.length > 0
    ? payments
    : stores
      .flatMap((s) => (s.pagos || []).map((p) => ({ ...p, tienda: s.nombre, tienda_id: s.id })))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // 1. KPI: Cobrado en el mes actual
  const cobradoMes = allPayments
    .filter((p) => {
      const d = new Date(p.fecha);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    })
    .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);

  // 2. KPI: MRR (Ingreso Mensual Recurrente) de tiendas activas
  const activeStores = stores.filter((s) => s.estado === 'activa');
  const suspendedStores = stores.filter((s) => s.estado === 'suspendida');
  const mrr = activeStores.reduce(
    (sum, s) => sum + ((parseFloat(s.monto) || 0) / (s.periodicidad_meses || s.per || 1)),
    0
  );

  // 3. KPI: Churn Rate
  const totalStores = stores.length;
  const churnRate = totalStores > 0 ? ((suspendedStores.length / totalStores) * 100).toFixed(1) : '0.0';
  const churnedMrr = suspendedStores.reduce(
    (sum, s) => sum + ((parseFloat(s.monto) || 0) / (s.periodicidad_meses || s.per || 1)),
    0
  );

  // 4. KPI: Por cobrar en los próximos 30 días o vencidos
  const porCobrar30Dias = stores
    .filter((s) => s.estado === 'activa')
    .filter((s) => {
      const d = diffDays(s.proximo_pago || s.proximo);
      return d <= 30;
    })
    .reduce((sum, s) => sum + (parseFloat(s.monto) || 0), 0);

  // Filtrado de historial de pagos
  const filteredPayments = allPayments.filter((p) => {
    const text = ((p.tienda || '') + ' ' + (p.metodo || '') + ' ' + (p.nota || '')).toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  // Tiendas con estado de cobro
  const storesWithStatus = stores.map((s) => {
    const days = diffDays(s.proximo_pago || s.proximo);
    let status = { key: 'al_dia', label: 'Al día', badgeClass: 'chip ok' };
    if (s.estado === 'suspendida') {
      status = { key: 'suspendida', label: 'Suspendida', badgeClass: 'chip sus' };
    } else if (days < 0) {
      status = { key: 'vencida', label: `Vencida (${Math.abs(days)}d)`, badgeClass: 'chip out' };
    } else if (days <= 5) {
      status = { key: 'por_vencer', label: `Vence en ${days}d`, badgeClass: 'chip low' };
    }
    return { ...s, status, daysUntil: days };
  }).sort((a, b) => a.daysUntil - b.daysUntil);

  // Paginación historial
  const totalPayments = filteredPayments.length;
  const validPaymentsPage = Math.min(paymentsPage, Math.max(1, Math.ceil(totalPayments / ITEMS_PER_PAGE)));
  const startPayIdx = (validPaymentsPage - 1) * ITEMS_PER_PAGE;
  const paginatedPayments = filteredPayments.slice(startPayIdx, startPayIdx + ITEMS_PER_PAGE);

  // Paginación cobranzas
  const totalCobranzas = storesWithStatus.length;
  const validCobranzasPage = Math.min(cobranzasPage, Math.max(1, Math.ceil(totalCobranzas / ITEMS_PER_PAGE)));
  const startCobIdx = (validCobranzasPage - 1) * ITEMS_PER_PAGE;
  const paginatedCobranzas = storesWithStatus.slice(startCobIdx, startCobIdx + ITEMS_PER_PAGE);

  // Abrir modal de pago para una tienda específica
  const handleOpenRegisterForStore = (store) => {
    setSelectedStoreId(store.id);
    setPagoMonto(store.monto ? store.monto.toString() : '59.00');
    setPagoMetodo('Yape / Plin');
    setPagoNota('Renovación suscripción');
    setComprobanteUrl('');
    setComprobantePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsPayModalOpen(true);
  };

  // Manejo de carga y compresión optimizada de comprobante local
  const handleProofFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      alert('El archivo es muy pesado. Máximo 12MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEv) => {
      const rawData = loadEv.target.result;
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setComprobanteUrl(compressed);
          setComprobantePreview(compressed);
        };
        img.src = rawData;
      } else {
        setComprobanteUrl(rawData);
        setComprobantePreview(rawData);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearProof = () => {
    setComprobanteUrl('');
    setComprobantePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Enviar formulario de pago
  const handleSubmitPayment = (e) => {
    e.preventDefault();
    if (!selectedStoreId || !pagoMonto) {
      alert('Por favor selecciona una tienda e indica el monto.');
      return;
    }
    const targetStore = stores.find((s) => s.id === selectedStoreId);
    if (!targetStore) return;

    if (onRegisterPayment) {
      onRegisterPayment(
        targetStore.id,
        targetStore.contrato_id,
        parseFloat(pagoMonto),
        pagoMetodo,
        pagoNota,
        comprobanteUrl
      );
    }
    setIsPayModalOpen(false);
  };

  // Enviar recordatorio por WhatsApp
  const handleSendWhatsAppReminder = (store) => {
    const prox = fd(store.proximo_pago || store.proximo);
    const montoFmt = money(store.monto || 0);
    let msg = `Hola *${store.dueno || 'estimado cliente'}*, te saludamos de Vendia (by A&B Studio).\n\n`;
    msg += `Te recordamos que la suscripción de tu tienda *${store.nombre}* (${montoFmt}) vence el *${prox}*.\n\n`;
    msg += `Agradecemos enviar tu comprobante de pago por este medio para mantener tu servicio 100% activo sin interrupciones. ¡Gracias!`;

    const phone = (store.dueno_telefono || store.telefono || '').replace(/[^\d+]/g, '');
    const url = phone
      ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Enviar recordatorio por Correo
  const handleSendEmailReminder = (store) => {
    const email = store.dueno_correo || store.correo || '';
    if (!email) {
      alert('Esta tienda no tiene un correo registrado.');
      return;
    }
    const prox = fd(store.proximo_pago || store.proximo);
    const montoFmt = money(store.monto || 0);
    const subject = encodeURIComponent(`Recordatorio de Pago de Suscripción - ${store.nombre}`);
    const body = encodeURIComponent(
      `Hola ${store.dueno || 'estimado cliente'},\n\n` +
      `Le recordamos que la suscripción de su negocio "${store.nombre}" a Vendia por ${montoFmt} vence el ${prox}.\n\n` +
      `Por favor responda a este correo adjuntando su comprobante de transferencia bancaria o Yape/Plin.\n\n` +
      `Atentamente,\nEquipo de Vendia`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div>
      {/* Cabecera Principal */}
      <div className="bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1>Gestión de Pagos & Cobranzas</h1>
            <span className="chip" style={{ background: 'rgba(0, 229, 255, 0.12)', color: '#0284c7', borderColor: 'rgba(0, 229, 255, 0.35)', fontWeight: 700 }}>
              Facturación SaaS
            </span>
          </div>
          <p className="lead">Monitoreo de ingresos recurrentes (MRR), comprobantes adjuntos y recordatorios.</p>
        </div>
        <button
          type="button"
          className="btn p"
          onClick={() => {
            setSelectedStoreId(stores[0]?.id || '');
            setPagoMonto(stores[0]?.monto ? stores[0].monto.toString() : '59.00');
            setPagoMetodo('Yape / Plin');
            setPagoNota('');
            setComprobanteUrl('');
            setComprobantePreview('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsPayModalOpen(true);
          }}
        >
          + Registrar pago con comprobante
        </button>
      </div>

      {/* KPI Cards Vendia Cloud */}
      <div className="sec stats vendia-kpi-grid">
        <div className="stat kpi-emerald">
          <b>{money(mrr)}</b>
          <span>MRR (Ingreso Mensual)</span>
        </div>
        <div className="stat kpi-cyan">
          <b>{money(cobradoMes)}</b>
          <span>Cobrado este mes</span>
        </div>
        <div className="stat kpi-navy">
          <b>{money(porCobrar30Dias)}</b>
          <span>Por cobrar / En mora (30 días)</span>
        </div>
        <div className="stat kpi-light">
          <b>{churnRate}%</b>
          <span>Tasa de Churn ({suspendedStores.length} tiendas / {money(churnedMrr)})</span>
        </div>
      </div>

      {/* Selector de Sub-pestaña */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '18px', paddingBottom: '2px' }}>
        <button
          type="button"
          className={`tab ${activeSubTab === 'historial' ? 'act' : ''}`}
          onClick={() => setActiveSubTab('historial')}
          style={{
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            fontWeight: 700,
            fontSize: '12px',
            padding: '8px 14px',
            borderBottom: activeSubTab === 'historial' ? '3px solid #00C853' : '3px solid transparent',
            color: activeSubTab === 'historial' ? '#0f172a' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          Historial de Pagos ({allPayments.length})
        </button>
        <button
          type="button"
          className={`tab ${activeSubTab === 'cobranzas' ? 'act' : ''}`}
          onClick={() => setActiveSubTab('cobranzas')}
          style={{
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            fontWeight: 700,
            fontSize: '12px',
            padding: '8px 14px',
            borderBottom: activeSubTab === 'cobranzas' ? '3px solid #00C853' : '3px solid transparent',
            color: activeSubTab === 'cobranzas' ? '#0f172a' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          Estado de Cobranza & Recordatorios ({stores.length})
        </button>
      </div>

      {/* CONTENIDO 1: HISTORIAL DE PAGOS */}
      {activeSubTab === 'historial' && (
        <div className="card">
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Últimos pagos registrados ({filteredPayments.length})
            </h2>
            <input
              type="search"
              placeholder="Buscar por tienda, método o nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '260px', minHeight: '34px', fontSize: '11.5px' }}
            />
          </div>

          {filteredPayments.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '760px' }}>
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc', textAlign: 'left' }}>
                    <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha</th>
                    <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tienda</th>
                    <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Método</th>
                    <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monto</th>
                    <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Comprobante</th>
                    <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((p, idx) => (
                    <tr
                      key={p.id || idx}
                      style={{
                        borderBottom: idx === filteredPayments.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 18px', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{fd(p.fecha)}</td>
                      <td style={{ padding: '10px 18px', fontWeight: 600, color: '#0f172a', fontSize: '11.5px' }}>{p.tienda}</td>
                      <td style={{ padding: '10px 18px' }}>
                        <span className="chip" style={{ fontSize: '10px', background: '#f1f5f9', color: '#0f172a', padding: '2px 7px', borderRadius: '5px' }}>
                          {p.metodo || 'Transferencia'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 18px', fontWeight: 700, color: '#0f172a', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        {money(p.monto)}
                      </td>
                      <td style={{ padding: '10px 18px' }}>
                        {p.comprobante_url ? (
                          <button
                            type="button"
                            className="btn o s"
                            style={{ fontSize: '10px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={() => setViewingProof({ url: p.comprobante_url, tienda: p.tienda, fecha: p.fecha, monto: p.monto })}
                          >
                            <span>Ver</span>
                          </button>
                        ) : (
                          <span className="hint" style={{ fontSize: '10px', color: '#94a3b8' }}>Sin adjunto</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 18px', fontSize: '10.5px', color: '#64748b' }}>
                        {p.nota || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty" style={{ padding: '30px 18px', fontSize: '11.5px' }}>No hay pagos que coincidan con la búsqueda.</div>
          )}

          <Pagination
            currentPage={validPaymentsPage}
            totalItems={totalPayments}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setPaymentsPage}
            noun="pagos"
          />
        </div>
      )}

      {/* CONTENIDO 2: ESTADO DE COBRANZA & RECORDATORIOS */}
      {activeSubTab === 'cobranzas' && (
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Estado de Suscripciones y Recordatorios Directos ({stores.length})
            </h2>
            <p className="hint" style={{ margin: '3px 0 0', color: '#64748b', fontSize: '11px' }}>
              Envía recordatorios de renovación en 1 clic por WhatsApp o correo antes del corte de servicio.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '820px' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tienda</th>
                  <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dueño / Teléfono</th>
                  <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tarifa</th>
                  <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Próximo Pago</th>
                  <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estado</th>
                  <th style={{ padding: '9px 18px', color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCobranzas.map((s, idx) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: idx === storesWithStatus.length - 1 ? 'none' : '1px solid #f1f5f9',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 18px', color: '#0f172a' }}>
                      <b style={{ fontSize: '11.5px' }}>{s.nombre}</b>
                    </td>
                    <td style={{ padding: '10px 18px', fontSize: '11px' }}>
                      <div style={{ fontWeight: 500, color: '#0f172a' }}>{s.dueno || 'Sin dueño'}</div>
                      <small className="hint" style={{ color: '#64748b', fontSize: '9.5px' }}>{s.dueno_telefono || s.telefono || 'Sin teléfono'}</small>
                    </td>
                    <td style={{ padding: '10px 18px', fontWeight: 600, color: '#0f172a', fontSize: '11px' }}>
                      {money(s.monto)} / mes
                    </td>
                    <td style={{ padding: '10px 18px', fontSize: '11px', color: '#0f172a', fontWeight: 500 }}>
                      {fd(s.proximo_pago || s.proximo)}
                    </td>
                    <td style={{ padding: '10px 18px' }}>
                      <span className={s.status.badgeClass} style={{ fontSize: '9.5px' }}>{s.status.label}</span>
                    </td>
                    <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn o s"
                          style={{ borderColor: '#25D366', color: '#128C7E', background: 'rgba(37, 211, 102, 0.08)', padding: '3px 7px' }}
                          title="Enviar recordatorio por WhatsApp"
                          onClick={() => handleSendWhatsAppReminder(s)}
                        >
                          <IconWhatsApp size={13} color="#25D366" />
                        </button>
                        <button
                          type="button"
                          className="btn o s"
                          style={{ padding: '3px 8px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Enviar recordatorio por correo"
                          onClick={() => handleSendEmailReminder(s)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                          <span>Correo</span>
                        </button>
                        <button
                          type="button"
                          className="btn p s"
                          style={{
                            padding: '3px 10px',
                            fontSize: '10px',
                            background: 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 600
                          }}
                          onClick={() => handleOpenRegisterForStore(s)}
                        >
                          + Cobrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={validCobranzasPage}
            totalItems={totalCobranzas}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCobranzasPage}
            noun="tiendas"
          />
        </div>
      )}

      {/* MODAL REGISTRAR PAGO CON COMPROBANTE */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Registrar Pago de Suscripción"
        maxWidth={520}
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
          <p className="hint" style={{ marginTop: 0, marginBottom: 16, fontSize: '12px', lineHeight: 1.4 }}>
            Registra el pago de suscripción para extender el periodo activo de la tienda y respaldar la operación con el comprobante de pago.
          </p>

          <form onSubmit={handleSubmitPayment} className="f" style={{ gap: '14px' }}>
            <label>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '5px' }}>
                Tienda / Comercio:
              </span>
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value);
                  const st = stores.find((x) => x.id === e.target.value);
                  if (st) setPagoMonto(st.monto.toString());
                }}
                required
                style={{ fontSize: '12px', minHeight: '38px', borderRadius: '8px' }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({money(s.monto)}/mes {s.plan ? `— Plan ${s.plan}` : ''})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '5px' }}>
                  Monto Pagado (S/.):
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={pagoMonto}
                  onChange={(e) => setPagoMonto(e.target.value)}
                  required
                  style={{ fontSize: '12px', minHeight: '38px', borderRadius: '8px' }}
                />
              </label>

              <label>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '5px' }}>
                  Método de Pago:
                </span>
                <select
                  value={pagoMetodo}
                  onChange={(e) => setPagoMetodo(e.target.value)}
                  style={{ fontSize: '12px', minHeight: '38px', borderRadius: '8px' }}
                >
                  <option value="Yape / Plin">Yape / Plin</option>
                  <option value="Transferencia BCP/BBVA">Transferencia BCP / BBVA</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
            </div>

            <label>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '5px' }}>
                Nota o Referencia de Operación:
              </span>
              <input
                type="text"
                placeholder="Ej: Operación N° 049382 / Renovación mensual"
                value={pagoNota}
                onChange={(e) => setPagoNota(e.target.value)}
                style={{ fontSize: '12px', minHeight: '38px', borderRadius: '8px' }}
              />
            </label>

            {/* ADJUNTAR COMPROBANTE DE PAGO */}
            <div
              style={{
                background: 'var(--fog)',
                border: '1px solid var(--mist)',
                borderRadius: '10px',
                padding: '14px',
                marginTop: '2px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--charcoal)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00C853' }}>
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  Comprobante de Pago (Voucher)
                </span>
                {comprobantePreview && (
                  <span className="chip ok" style={{ fontSize: '9.5px', padding: '2px 7px' }}>
                    Adjuntado
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleProofFileUpload}
                style={{ display: 'none' }}
              />

              {!comprobantePreview ? (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '16px 12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#ffffff',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#00C853';
                      e.currentTarget.style.background = '#f0fdf4';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 6px' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
                      Haz clic para subir captura o foto del voucher
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      JPG, PNG, WebP (optimización automática de tamaño)
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap' }}>O enlace directo:</span>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/voucher.jpg"
                      value={comprobanteUrl.startsWith('data:') ? '' : comprobanteUrl}
                      onChange={(e) => {
                        setComprobanteUrl(e.target.value);
                        setComprobantePreview(e.target.value);
                      }}
                      style={{ fontSize: '11px', minHeight: '30px', padding: '4px 8px', borderRadius: '6px', flex: 1 }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <img
                    src={comprobantePreview}
                    alt="Vista previa voucher"
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      border: '1px solid #e2e8f0'
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a' }}>
                      Voucher cargado con éxito
                    </div>
                    <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '2px', fontWeight: 500 }}>
                      Listo para guardar con el pago
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn o s"
                      style={{ fontSize: '10.5px', padding: '4px 8px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      className="btn o s"
                      style={{ fontSize: '10.5px', padding: '4px 8px', color: '#ef4444', borderColor: '#fca5a5' }}
                      onClick={handleClearProof}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn o"
                onClick={() => setIsPayModalOpen(false)}
                style={{ minHeight: '38px', padding: '0 18px', fontSize: '12.5px' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn p"
                style={{
                  minHeight: '38px',
                  padding: '0 20px',
                  background: 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0, 200, 83, 0.28)',
                  fontWeight: 700,
                  fontSize: '12.5px'
                }}
              >
                Confirmar y extender suscripción
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* MODAL VER COMPROBANTE LIGHTBOX */}
      <Modal
        isOpen={Boolean(viewingProof)}
        onClose={() => setViewingProof(null)}
        title={`Comprobante de Pago - ${viewingProof?.tienda || 'Tienda'}`}
        maxWidth={520}
      >
        {viewingProof && (
          <div
            className="no-scrollbar"
            style={{
              textAlign: 'center',
              maxHeight: '82vh',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            <div style={{ marginBottom: 12, fontSize: '11.5px', color: '#64748b' }}>
              Monto: <b style={{ color: '#0f172a' }}>{money(viewingProof.monto)}</b> | Fecha: {fd(viewingProof.fecha)}
            </div>
            <div style={{ background: '#f8fafc', padding: 8, borderRadius: 10, border: '1px solid #e2e8f0', display: 'inline-block', maxWidth: '100%' }}>
              <img
                src={viewingProof.url}
                alt="Comprobante"
                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 16 }}>
              <a
                href={viewingProof.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn o s"
                download={`Comprobante_${viewingProof.tienda}.jpg`}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                Descargar
              </a>
              <button
                type="button"
                className="btn p s"
                onClick={() => setViewingProof(null)}
                style={{
                  fontSize: '11px',
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
