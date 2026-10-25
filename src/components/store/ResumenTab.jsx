import React, { useState } from 'react';
import { money } from '../../constants/palettes';
import { IconTag, IconVender, IconReceipt, IconAlertTriangle } from '../common/Icons';
import AlertBellButton from '../common/AlertBellButton';
import {
  getPeruDateIso,
  formatPeruDate,
  getLast7DaysPeru,
  parseToPeruDateIso,
  getPeruDateParts
} from '../../utils/dateUtils';

export default function ResumenTab({
  userName = "Abraham",
  products = [],
  sales = [],
  weekData = [],
  resumenData = null,
  paymentMethods = [],
  onSelectSale,
  alertCount = 0,
  onOpenAlerts
}) {
  const [chartMode, setChartMode] = useState('horas'); // 'horas' | 'transacciones'
  const todayIso = getPeruDateIso();

  // Formato limpio del nombre de usuario (ej. abrahamordonezj18 -> Abraham)
  const displayName = userName
    ? (userName.toLowerCase().startsWith('abraham')
        ? 'Abraham'
        : userName.split(/[@._\d]/)[0].charAt(0).toUpperCase() + userName.split(/[@._\d]/)[0].slice(1))
    : 'Abraham';

  // Filtrar solo ventas válidas (no anuladas ni devueltas)
  const validSales = sales.filter((s) => s.estado !== 'anulada' && s.estado !== 'devuelta');
  
  // Ventas de hoy en Perú (estrictamente de la fecha actual en America/Lima)
  const todaySales = validSales.filter((s) => parseToPeruDateIso(s.fecha || s.creado_en) === todayIso);

  // 1. Ventas de hoy (total monetario): combina client todaySales con RPC para protegerse de desfase de zona horaria
  const clientHoyTotal = todaySales.reduce((acc, s) => {
    const itemSum = (s.items || []).reduce((a, x) => a + (parseFloat(x.precio || x.precio_unitario || 0) * parseFloat(x.cantidad || 0)), 0);
    return acc + (parseFloat(s.total) || itemSum || 0);
  }, 0);
  const clientNVentas = todaySales.length;

  const rpcHoyTotal = parseFloat(resumenData?.hoy_total || 0);
  const rpcNVentas = parseInt(resumenData?.hoy_ventas || 0, 10);

  const hoyTotal = Math.max(rpcHoyTotal, clientHoyTotal);

  // 2. Número de ventas de hoy
  const nVentas = Math.max(rpcNVentas, clientNVentas);

  // 3. Ticket promedio
  const ticketPromedio = nVentas > 0 ? (hoyTotal / nVentas) : (parseFloat(resumenData?.ticket_promedio || 0));

  // 4. Productos por reponer (stock <= stock_minimo)
  const realLowStock = products.filter(
    (p) => p.activo !== false && (parseFloat(p.stock || 0) <= parseFloat(p.stock_minimo || 5))
  ).length;
  const lowStockCount = resumenData?.por_reponer !== undefined && resumenData?.por_reponer !== null
    ? parseInt(resumenData.por_reponer, 10)
    : realLowStock;

  // Gráfico 1: Ventas en S/. últimos 7 días anclados a la fecha actual de Perú
  const baseLast7 = getLast7DaysPeru();
  const days = baseLast7.map((item) => {
    let dayTotal = 0;
    if (resumenData?.ultimos_7_dias && Array.isArray(resumenData.ultimos_7_dias)) {
      const found = resumenData.ultimos_7_dias.find((x) => x.fecha === item.iso);
      if (found) {
        dayTotal = parseFloat(found.total || 0);
      }
    }
    if (dayTotal === 0) {
      const salesOnDay = validSales.filter((s) => parseToPeruDateIso(s.fecha || s.creado_en) === item.iso);
      dayTotal = salesOnDay.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    }
    if (item.isToday && hoyTotal > 0) {
      dayTotal = hoyTotal;
    }
    return {
      iso: item.iso,
      date: item.date,
      label: item.label,
      fullLabel: item.fullLabel,
      isToday: item.isToday,
      total: dayTotal
    };
  });
  const maxSale = Math.max(...days.map((d) => d.total), 1);

  // Gráfico 2 - Modo Horas: 7 bloques de 2 horas en la jornada comercial
  const hourlySlots = [
    { start: 8, end: 10, label: '8-10h', name: '08:00 a 10:00' },
    { start: 10, end: 12, label: '10-12h', name: '10:00 a 12:00' },
    { start: 12, end: 14, label: '12-14h', name: '12:00 a 14:00' },
    { start: 14, end: 16, label: '14-16h', name: '14:00 a 16:00' },
    { start: 16, end: 18, label: '16-18h', name: '16:00 a 18:00' },
    { start: 18, end: 20, label: '18-20h', name: '18:00 a 20:00' },
    { start: 20, end: 22, label: '20-22h', name: '20:00 a 22:00' }
  ];

  const currentPeruHour = getPeruDateParts().hour;

  const hourlyData = hourlySlots.map((slot) => {
    let slotTotal = 0;
    let slotCount = 0;
    todaySales.forEach((s) => {
      let h = 12;
      if (s.hora && s.hora.includes(':')) {
        h = parseInt(s.hora.split(':')[0], 10);
      } else if (s.creado_en) {
        h = getPeruDateParts(s.creado_en).hour;
      }
      if (h >= slot.start && h < slot.end) {
        const itemSum = (s.items || []).reduce((a, x) => a + (parseFloat(x.precio || x.precio_unitario || 0) * parseFloat(x.cantidad || 0)), 0);
        slotTotal += parseFloat(s.total) || itemSum || 0;
        slotCount += 1;
      }
    });

    const isCurrent = currentPeruHour >= slot.start && currentPeruHour < slot.end;

    return {
      ...slot,
      total: slotTotal,
      count: slotCount,
      isCurrent
    };
  });
  const maxHourlySale = Math.max(...hourlyData.map((h) => h.total), 1);

  // Gráfico 2 - Modo Transacciones: número de ventas por día en los últimos 7 días
  const transactionDays = baseLast7.map((item) => {
    const salesOnDay = validSales.filter((s) => parseToPeruDateIso(s.fecha || s.creado_en) === item.iso);
    const count = item.isToday && nVentas > 0 ? nVentas : salesOnDay.length;
    return {
      ...item,
      count
    };
  });
  const maxTransactions = Math.max(...transactionDays.map((t) => t.count), 1);

  // Formas de pago: ÚNICAMENTE las habilitadas para esta tienda
  const enabledMethods = Array.isArray(paymentMethods) && paymentMethods.length > 0
    ? paymentMethods
    : ['Efectivo'];

  const displayPayments = enabledMethods.map((m) => {
    const norm = m.toLowerCase().trim();
    const foundRpc = resumenData?.por_pago?.find((x) => (x.metodo || '').toLowerCase().trim() === norm);

    let calculatedToday = 0;
    todaySales.forEach((s) => {
      const saleMethod = (s.metodo_pago || '').toLowerCase().trim();
      if (saleMethod === norm) {
        calculatedToday += parseFloat(s.total || 0);
      } else if (s.metodo_pago === 'Mixto' && Array.isArray(s.pagos_mixtos)) {
        const mix = s.pagos_mixtos.find((p) => (p.metodo || '').toLowerCase().trim() === norm);
        if (mix) calculatedToday += parseFloat(mix.monto || 0);
      }
    });

    const finalTotal = foundRpc ? Math.max(parseFloat(foundRpc.total || 0), calculatedToday) : calculatedToday;
    return {
      metodo: m,
      total: finalTotal
    };
  });

  const getMethodStyle = (metodo) => {
    const m = (metodo || '').toLowerCase();
    if (m.includes('efectivo')) return { color: '#10b981', track: 'rgba(16, 185, 129, 0.12)' };
    if (m.includes('tarjeta')) return { color: '#3b82f6', track: 'rgba(59, 130, 246, 0.12)' };
    if (m.includes('yape') || m.includes('plin')) return { color: '#06b6d4', track: 'rgba(6, 182, 212, 0.12)' };
    if (m.includes('transferencia')) return { color: '#8b5cf6', track: 'rgba(139, 92, 246, 0.12)' };
    return { color: 'var(--ember)', track: 'rgba(255, 255, 255, 0.08)' };
  };

  // Más vendidos hoy: EXCLUSIVAMENTE a partir de los productos vendidos hoy
  const todayCountMap = {};
  todaySales.forEach((s) => {
    (s.items || []).forEach((it) => {
      const pid = it.producto_id;
      const prod = products.find((p) => String(p.id) === String(pid));
      const pName = it.nombre || prod?.nombre || `Producto #${pid}`;
      const qty = parseFloat(it.cantidad || 0);
      if (qty > 0) {
        todayCountMap[pName] = (todayCountMap[pName] || 0) + qty;
      }
    });
  });

  const displayTopProducts = Object.entries(todayCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nombre, unidades]) => ({ nombre, unidades }));

  // Productos que necesitan atención: datos 100% reales del inventario
  const displayAttention = products
    .filter((p) => p.activo !== false && (parseFloat(p.stock || 0) <= parseFloat(p.stock_minimo || 5)))
    .sort((a, b) => (parseFloat(a.stock || 0) - parseFloat(b.stock || 0)))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      stock: parseFloat(p.stock || 0),
      stock_minimo: parseFloat(p.stock_minimo || 5),
      isOut: parseFloat(p.stock || 0) <= 0
    }));

  return (
    <div>
      <div className="bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: '800', letterSpacing: '-0.025em', margin: '0 0 6px', color: 'var(--ink)' }}>
            Buenos días, {displayName}
          </h1>
          <p className="lead" style={{ margin: 0, color: 'var(--pewter)', fontSize: '14.5px', textTransform: 'capitalize' }}>
            {formatPeruDate(new Date(), {
              weekday: "long",
              day: "numeric",
              month: "long"
            })}
          </p>
        </div>
        {onOpenAlerts && (
          <AlertBellButton alertCount={alertCount} onOpenAlerts={onOpenAlerts} />
        )}
      </div>

      {/* FILA 1: 4 KPI Cards */}
      <div className="sec stats" style={{ marginBottom: '24px' }}>
        <div className="stat solid-accent">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(0, 0, 0, 0.12)',
              color: 'var(--onacc)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <IconTag size={18} />
          </div>
          <b className="price-display" style={{ fontSize: '26px', lineHeight: 1.15, marginBottom: '6px', letterSpacing: '-0.02em', color: 'var(--onacc)' }}>
            {money(hoyTotal)}
          </b>
          <span style={{ fontSize: '12px', fontWeight: '500', opacity: 0.95, color: 'var(--onacc)' }}>
            Ventas de hoy
          </span>
        </div>

        <div className="stat">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#2563eb',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <IconVender size={18} />
          </div>
          <b className="price-display" style={{ fontSize: '26px', lineHeight: 1.15, marginBottom: '6px', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            {nVentas}
          </b>
          <span style={{ fontSize: '12px', color: 'var(--graphite)' }}>
            Número de ventas
          </span>
        </div>

        <div className="stat">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(147, 51, 234, 0.12)',
              color: '#7c3aed',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <IconReceipt size={18} />
          </div>
          <b className="price-display" style={{ fontSize: '26px', lineHeight: 1.15, marginBottom: '6px', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            {money(ticketPromedio)}
          </b>
          <span style={{ fontSize: '12px', color: 'var(--graphite)' }}>
            Ticket promedio
          </span>
        </div>

        <div className="stat">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <IconAlertTriangle size={18} />
          </div>
          <b className="price-display" style={{ fontSize: '26px', lineHeight: 1.15, marginBottom: '6px', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            {lowStockCount}
          </b>
          <span style={{ fontSize: '12px', color: 'var(--graphite)' }}>
            Productos por reponer
          </span>
        </div>
      </div>

      {/* FILA 2: Dos Gráficos en Paralelo (50% / 50%) */}
      <div className="sec two" style={{ marginBottom: '24px' }}>
        {/* Gráfico 1: Ventas últimos 7 días */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, borderBottom: 'none', padding: 0, color: 'var(--ink)' }}>
              Ventas de los últimos 7 días
            </h2>
            <span style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--pewter)', background: 'var(--fog)', padding: '3px 9px', borderRadius: '6px' }}>
              Ingresos (S/.)
            </span>
          </div>
          <div>
            <div style={{ height: '170px', display: 'flex', alignItems: 'flex-end', gap: '14px', padding: '0 4px' }}>
              {days.map((d, i) => {
                const isToday = i === days.length - 1;
                const hasSales = d.total > 0;
                const barHeight = hasSales ? Math.max(Math.round((d.total / maxSale) * 115), 14) : 6;
                const dayLabel = d.label;
                const fullDate = d.fullLabel;

                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      height: '100%',
                      gap: '8px'
                    }}
                    title={`${fullDate}: ${money(d.total)}`}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: isToday ? 'var(--ember)' : (hasSales ? 'var(--graphite)' : 'transparent'),
                        height: '16px',
                        lineHeight: '16px'
                      }}
                    >
                      {hasSales ? money(d.total).replace(",00", "") : ""}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: `${barHeight}px`,
                        borderRadius: hasSales ? '8px 8px 0 0' : '4px',
                        background: isToday
                          ? 'var(--ember)'
                          : hasSales
                          ? 'color-mix(in srgb, var(--ember) 75%, var(--mist))'
                          : 'color-mix(in srgb, var(--ember) 30%, var(--mist))',
                        boxShadow: isToday ? '0 4px 14px color-mix(in srgb, var(--ember) 35%, transparent)' : 'none',
                        transition: 'height 0.3s ease, background 0.2s ease',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ textAlign: 'center', marginTop: '4px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isToday ? '800' : '500',
                          color: isToday ? 'var(--ember)' : 'var(--pewter)'
                        }}
                      >
                        {dayLabel}
                      </span>
                      {isToday && (
                        <div
                          style={{
                            width: '28px',
                            height: '3px',
                            borderRadius: '2px',
                            background: 'var(--ember)',
                            margin: '3px auto 0'
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gráfico 2: Ventas por hora hoy / Transacciones 7d */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, borderBottom: 'none', padding: 0, color: 'var(--ink)' }}>
              {chartMode === 'horas' ? 'Ventas por hora (Hoy)' : 'Transacciones (7 días)'}
            </h2>
            <div style={{ display: 'inline-flex', background: 'var(--fog)', padding: '3px', borderRadius: '8px', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setChartMode('horas')}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: chartMode === 'horas' ? 'var(--ember)' : 'transparent',
                  color: chartMode === 'horas' ? 'var(--onacc)' : 'var(--pewter)',
                  transition: 'all 0.15s ease'
                }}
              >
                Horas hoy
              </button>
              <button
                type="button"
                onClick={() => setChartMode('transacciones')}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: chartMode === 'transacciones' ? 'var(--ember)' : 'transparent',
                  color: chartMode === 'transacciones' ? 'var(--onacc)' : 'var(--pewter)',
                  transition: 'all 0.15s ease'
                }}
              >
                Tickets 7d
              </button>
            </div>
          </div>

          <div>
            <div style={{ height: '170px', display: 'flex', alignItems: 'flex-end', gap: '14px', padding: '0 4px' }}>
              {chartMode === 'horas' ? (
                hourlyData.map((h, i) => {
                  const hasSales = h.total > 0;
                  const barHeight = hasSales ? Math.max(Math.round((h.total / maxHourlySale) * 115), 14) : 6;

                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        height: '100%',
                        gap: '8px'
                      }}
                      title={`${h.name}: ${money(h.total)} (${h.count} ${h.count === 1 ? 'venta' : 'ventas'})`}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: h.isCurrent ? 'var(--ember)' : (hasSales ? 'var(--graphite)' : 'transparent'),
                          height: '16px',
                          lineHeight: '16px'
                        }}
                      >
                        {hasSales ? money(h.total).replace(",00", "") : ""}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          height: `${barHeight}px`,
                          borderRadius: hasSales ? '8px 8px 0 0' : '4px',
                          background: h.isCurrent
                            ? 'var(--ember)'
                            : hasSales
                            ? 'color-mix(in srgb, var(--ember) 75%, var(--mist))'
                            : 'color-mix(in srgb, var(--ember) 30%, var(--mist))',
                          boxShadow: h.isCurrent ? '0 4px 14px color-mix(in srgb, var(--ember) 35%, transparent)' : 'none',
                          transition: 'height 0.3s ease, background 0.2s ease',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ textAlign: 'center', marginTop: '4px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: h.isCurrent ? '800' : '500',
                            color: h.isCurrent ? 'var(--ember)' : 'var(--pewter)'
                          }}
                        >
                          {h.label}
                        </span>
                        {h.isCurrent && (
                          <div
                            style={{
                              width: '24px',
                              height: '3px',
                              borderRadius: '2px',
                              background: 'var(--ember)',
                              margin: '3px auto 0'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                transactionDays.map((t, i) => {
                  const hasSales = t.count > 0;
                  const barHeight = hasSales ? Math.max(Math.round((t.count / maxTransactions) * 115), 14) : 6;

                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        height: '100%',
                        gap: '8px'
                      }}
                      title={`${t.fullLabel}: ${t.count} ${t.count === 1 ? 'venta' : 'ventas'}`}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: t.isToday ? 'var(--ember)' : (hasSales ? 'var(--graphite)' : 'transparent'),
                          height: '16px',
                          lineHeight: '16px'
                        }}
                      >
                        {hasSales ? `${t.count} v.` : ""}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          height: `${barHeight}px`,
                          borderRadius: hasSales ? '8px 8px 0 0' : '4px',
                          background: t.isToday
                            ? 'var(--ember)'
                            : hasSales
                            ? 'color-mix(in srgb, var(--ember) 75%, var(--mist))'
                            : 'color-mix(in srgb, var(--ember) 30%, var(--mist))',
                          boxShadow: t.isToday ? '0 4px 14px color-mix(in srgb, var(--ember) 35%, transparent)' : 'none',
                          transition: 'height 0.3s ease, background 0.2s ease',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ textAlign: 'center', marginTop: '4px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: t.isToday ? '800' : '500',
                            color: t.isToday ? 'var(--ember)' : 'var(--pewter)'
                          }}
                        >
                          {t.label}
                        </span>
                        {t.isToday && (
                          <div
                            style={{
                              width: '28px',
                              height: '3px',
                              borderRadius: '2px',
                              background: 'var(--ember)',
                              margin: '3px auto 0'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FILA 3: Tres Tarjetas en una Sola Fila (Formas de Pago | Necesitan Atención | Más Vendidos Hoy) */}
      <div className="sec three" style={{ marginBottom: '24px' }}>
        {/* Tarjeta 1: Por forma de pago */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 20px', borderBottom: 'none', padding: 0, color: 'var(--ink)' }}>
            Por forma de pago
          </h2>
          <div style={{ flex: 1 }}>
            {displayPayments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--pewter)' }}>
                <span style={{ fontSize: '13px' }}>No hay formas de pago habilitadas para esta tienda.</span>
              </div>
            ) : (
              displayPayments.map((p) => {
                const maxPayment = Math.max(...displayPayments.map((m) => m.total), 1);
                const pct = p.total > 0 ? Math.round((p.total / maxPayment) * 100) : 0;
                const config = getMethodStyle(p.metodo);

                return (
                  <div key={p.metodo} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: config.color,
                            display: 'inline-block'
                          }}
                        />
                        <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--ink)' }}>{p.metodo}</span>
                      </div>
                      <b className="price-display" style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--ink)' }}>{money(p.total)}</b>
                    </div>
                    <div style={{ height: '7px', background: config.track, borderRadius: '99px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: p.total > 0 ? `${Math.max(pct, 12)}%` : '0%',
                          height: '100%',
                          borderRadius: '99px',
                          background: config.color,
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tarjeta 2: Necesitan atención */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 18px', borderBottom: 'none', padding: 0, color: 'var(--ink)' }}>
            Necesitan atención
          </h2>
          <div style={{ flex: 1 }}>
            {displayAttention.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--pewter)', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '26px', marginBottom: '8px' }}>✅</div>
                <b style={{ fontSize: '13.5px', display: 'block', marginBottom: '3px', color: 'var(--ink)' }}>
                  Inventario en orden
                </b>
                <small style={{ color: 'var(--pewter)', fontSize: '12px' }}>
                  No hay productos agotados ni por debajo del stock mínimo.
                </small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayAttention.map((a, i) => (
                  <div
                    key={a.id || i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: i < displayAttention.length - 1 ? '14px' : '0',
                      borderBottom: i < displayAttention.length - 1 ? '1px solid var(--mist)' : 'none'
                    }}
                  >
                    <div>
                      <b style={{ fontSize: '13.5px', display: 'block', marginBottom: '3px', color: 'var(--ink)' }}>{a.nombre}</b>
                      <small style={{ color: 'var(--pewter)', fontSize: '12px' }}>
                        Stock {a.stock} · mínimo {a.stock_minimo}
                      </small>
                    </div>
                    <span
                      style={{
                        background: a.isOut ? 'rgba(239, 68, 68, 0.16)' : 'rgba(245, 158, 11, 0.18)',
                        color: a.isOut ? '#ef4444' : '#f59e0b',
                        padding: '3px 10px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.02em'
                      }}
                    >
                      {a.isOut ? 'Agotado' : 'Bajo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tarjeta 3: Más vendidos hoy */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 18px', borderBottom: 'none', padding: 0, color: 'var(--ink)' }}>
            Más vendidos hoy
          </h2>
          <div style={{ flex: 1 }}>
            {displayTopProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--pewter)', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '26px', marginBottom: '8px' }}>🛒</div>
                <b style={{ fontSize: '13.5px', display: 'block', marginBottom: '3px', color: 'var(--ink)' }}>
                  Sin ventas registradas hoy
                </b>
                <small style={{ color: 'var(--pewter)', fontSize: '12px' }}>
                  Los productos que vendas el día de hoy aparecerán aquí conforme se registren.
                </small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayTopProducts.map((p, i) => {
                  const isFirst = i === 0;
                  return (
                    <div
                      key={p.nombre || i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: i < displayTopProducts.length - 1 ? '14px' : '0',
                        borderBottom: i < displayTopProducts.length - 1 ? '1px solid var(--mist)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isFirst
                              ? 'var(--ember)'
                              : 'color-mix(in srgb, var(--ember) 18%, rgba(255, 255, 255, 0.12))',
                            color: isFirst
                              ? 'var(--onacc)'
                              : 'var(--ember)',
                            fontSize: '12px',
                            fontWeight: '800',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {i + 1}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--ink)' }}>
                          {p.nombre}
                        </span>
                      </div>
                      <b className="price-display" style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--ink)' }}>
                        {p.unidades} {p.unidades === 1 ? 'ud.' : 'uds.'}
                      </b>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
