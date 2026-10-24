import React, { useState } from 'react';
import { money } from '../../constants/palettes';
import { exportSalesToCSV } from '../../utils/exportCSV';
import { IconDownload } from '../common/Icons';
import { formatTicketCode } from '../../utils/ticketGenerator';
import { getPeruDateIso, formatPeruDate, parseToPeruDateIso } from '../../utils/dateUtils';

export default function VentasTab({
  sales = [],
  products = [],
  activeSaleModal = null,
  onCloseSaleModal,
  onSelectSale,
  onVoidSale = null,
  storeName = "Minimarket La Esquina",
  paymentMethods = ['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia']
}) {
  const [metodoFilter, setMetodoFilter] = useState('Todas');
  const [estadoFilter, setEstadoFilter] = useState('completadas'); // 'todas' | 'completadas' | 'anuladas'

  const todayStr = getPeruDateIso();

  // Filtrar solo las ventas de hoy en Perú para esta vista
  const todaySales = sales.filter((s) => {
    if (!s.fecha && !s.creado_en) return true;
    return parseToPeruDateIso(s.fecha || s.creado_en) === todayStr;
  });

  // Métodos únicos presentes en ventas + configurados
  const uniqueSaleMethods = Array.from(new Set(todaySales.map((s) => s.metodo_pago).filter(Boolean)));
  const filterOptions = [
    'Todas',
    ...Array.from(new Set([...(paymentMethods || ['Efectivo', 'Yape / Plin', 'Tarjeta', 'Transferencia']), ...uniqueSaleMethods]))
  ];

  // Filtrar por método y estado
  const filteredSales = todaySales.filter((s) => {
    const isAnulada = s.estado === 'anulada' || s.estado === 'devuelta';
    if (estadoFilter === 'completadas' && isAnulada) return false;
    if (estadoFilter === 'anuladas' && !isAnulada) return false;

    if (metodoFilter !== 'Todas' && s.metodo_pago !== metodoFilter) return false;

    return true;
  });

  // KPI solo suma ventas válidas (no anuladas)
  const validTodaySales = todaySales.filter((s) => s.estado !== 'anulada' && s.estado !== 'devuelta');
  const totalVendido = validTodaySales.reduce((sum, s) => {
    return sum + (s.total || (s.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0));
  }, 0);

  const nVentas = validTodaySales.length;
  const nAnuladas = todaySales.filter((s) => s.estado === 'anulada' || s.estado === 'devuelta').length;
  const ticketPromedio = nVentas > 0 ? totalVendido / nVentas : 0;

  return (
    <div>
      <div className="bar">
        <div>
          <h1>Ventas de hoy</h1>
          <p className="lead">
            {formatPeruDate(new Date(), {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })} · Consecutivos por tienda y control de devoluciones.
          </p>
        </div>

        <button
          type="button"
          className="btn o"
          onClick={() => exportSalesToCSV(sales, products, storeName)}
          title="Descargar historial de ventas en Excel / CSV"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
        >
          <IconDownload size={16} />
          <span>Exportar Ventas CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="sec stats">
        <div className="stat primary">
          <b>{money(totalVendido)}</b>
          <span>Ingreso neto cobrado</span>
        </div>
        <div className="stat">
          <b>{nVentas}</b>
          <span>Ventas efectivas</span>
        </div>
        <div className="stat">
          <b>{money(ticketPromedio)}</b>
          <span>Ticket promedio</span>
        </div>
        <div className="stat">
          <b style={{ color: nAnuladas > 0 ? '#dc2626' : 'inherit' }}>{nAnuladas}</b>
          <span>Anuladas / Devoluciones</span>
        </div>
      </div>

      {/* Filtros de Estado */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="pill"
          aria-pressed={estadoFilter === 'completadas'}
          onClick={() => setEstadoFilter('completadas')}
          style={{ minHeight: '38px' }}
        >
          Ventas Completadas ({validTodaySales.length})
        </button>
        <button
          type="button"
          className="pill"
          aria-pressed={estadoFilter === 'anuladas'}
          onClick={() => setEstadoFilter('anuladas')}
          style={{ minHeight: '38px', color: nAnuladas > 0 ? '#dc2626' : undefined }}
        >
          ⛔ Anuladas ({nAnuladas})
        </button>
        <button
          type="button"
          className="pill"
          aria-pressed={estadoFilter === 'todas'}
          onClick={() => setEstadoFilter('todas')}
          style={{ minHeight: '38px' }}
        >
          Todas ({todaySales.length})
        </button>
      </div>

      {/* Filtros de Forma de Pago */}
      <div className="pills" style={{ marginBottom: 16 }}>
        {filterOptions.map((m) => (
          <button
            key={m}
            type="button"
            className="pill"
            aria-pressed={metodoFilter === m}
            onClick={() => setMetodoFilter(m)}
            style={{ minHeight: '36px' }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Lista de Ventas */}
      <div className="card">
        {filteredSales.length > 0 ? (
          filteredSales
            .slice()
            .reverse()
            .map((s, idx) => {
              const isAnulada = s.estado === 'anulada' || s.estado === 'devuelta';
              const saleTotal = s.total || s.items.reduce((a, x) => a + x.precio * x.cantidad, 0);
              const ticketCode = formatTicketCode(s);

              const itemsSummary = (s.items || [])
                .map((x) => {
                  const p = products.find((pr) => String(pr.id) === String(x.producto_id));
                  return `${x.cantidad}× ${p ? p.nombre : (x.nombre || 'Producto')}`;
                })
                .join(', ');

              return (
                <button
                  key={s.id || idx}
                  type="button"
                  className="li"
                  onClick={() => onSelectSale(s)}
                  style={{
                    opacity: isAnulada ? 0.7 : 1,
                    background: isAnulada ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    minHeight: '52px',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <b style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--ink)' }}>
                        {ticketCode}
                      </b>
                      <span style={{ fontSize: '12px', color: 'var(--graphite)' }}>
                        {s.hora} · {s.usuario}
                      </span>
                      {isAnulada && (
                        <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 'bold' }}>
                          ANULADA
                        </span>
                      )}
                    </div>
                    <small style={{ display: 'block', marginTop: '2px', color: 'var(--pewter)' }}>
                      {itemsSummary}
                    </small>
                  </div>
                  <div className="r" style={{ textAlign: 'right' }}>
                    <b style={{ textDecoration: isAnulada ? 'line-through' : 'none', color: isAnulada ? '#dc2626' : 'inherit', fontSize: '14px' }}>
                      {money(saleTotal)}
                    </b>
                    <small style={{ display: 'block', color: 'var(--graphite)' }}>
                      {s.pagos_mixtos ? '⚡ Mixto' : s.metodo_pago}
                    </small>
                  </div>
                </button>
              );
            })
        ) : (
          <div className="empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
            No hay ventas registradas con ese filtro.
          </div>
        )}
      </div>
    </div>
  );
}
