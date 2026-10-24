import React, { useState, useEffect } from 'react';
import { money, fd, diffDays } from '../../constants/palettes';
import { getGlobalSaaSMetrics, getSaaSTrendHistory } from '../../services/saasService';
import {
  IconTrending,
  IconTiendas,
  IconShield,
  IconBarcode,
  IconReportes,
  IconWhatsApp
} from '../common/Icons';

export default function MetricasTab({ stores = [], payments = [], onGoToTiendas }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartTab, setChartTab] = useState('mrr'); // 'mrr' | 'planes' | 'retencion'
  const [activePointIndex, setActivePointIndex] = useState(5);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const data = await getGlobalSaaSMetrics(stores, payments);
        setMetrics(data);
      } catch (err) {
        console.error('Error calculando métricas SaaS:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [stores, payments]);

  // Tiendas que vencen en los próximos 7 días o ya vencieron
  const tiendasPorVencer = stores.filter((s) => {
    if (s.estado === 'suspendida') return false;
    const d = diffDays(s.proximo_pago || s.proximo);
    return d <= 7;
  }).sort((a, b) => {
    const da = diffDays(a.proximo_pago || a.proximo);
    const db = diffDays(b.proximo_pago || b.proximo);
    return da - db;
  });

  const handleSendReminder = (e, store) => {
    e.stopPropagation();
    const prox = fd(store.proximo_pago || store.proximo);
    const montoFmt = money(store.monto);
    let msg = `Hola ${store.dueno || 'estimado cliente'}, te saludamos del equipo de Vendia (by A&B Studio).\n\n`;
    msg += `Te recordamos cordialmente que la suscripción de tu tienda *${store.nombre}* por el monto de *${montoFmt}* vence el *${prox}*.\n\n`;
    msg += `Agradecemos enviar tu comprobante de pago por este medio para mantener tu servicio 100% activo. ¡Muchas gracias!`;

    const cleanPhone = (store.telefono || '').replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (loading || !metrics) {
    return (
      <div>
        <div className="bar">
          <div>
            <h1>Métricas SaaS</h1>
            <p className="lead">Cargando métricas en tiempo real...</p>
          </div>
        </div>
      </div>
    );
  }

  const retentionRate = metrics.totalStores > 0
    ? Math.round((metrics.activeStoresCount / metrics.totalStores) * 100)
    : 100;

  // Datos para gráficas de tendencias históricas SaaS conectadas 100% a Supabase
  const trendHistory = getSaaSTrendHistory(stores, payments, metrics?.salesByMonth || {});
  const mrrTrend = trendHistory.mrrTrend || [];
  const selectedMonthData = mrrTrend[activePointIndex] || mrrTrend[mrrTrend.length - 1] || {};

  const mrrValues = mrrTrend.map((m) => m.mrr);
  const maxVal = Math.max(...mrrValues, 100) * 1.25;

  const chartWidth = 680;
  const chartHeight = 210;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const points = mrrTrend.map((m, idx) => {
    const x = padLeft + (idx / Math.max(1, mrrTrend.length - 1)) * plotW;
    const y = padTop + plotH - (m.mrr / maxVal) * plotH;
    return { ...m, x, y };
  });

  function getCurvedPath(pts) {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }

  const linePath = getCurvedPath(points);
  const bottomY = padTop + plotH;
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`
    : '';

  return (
    <div>
      {/* Cabecera */}
      <div className="bar">
        <div>
          <h1>Métricas Globales SaaS</h1>
          <p className="lead">Monitoreo financiero, adopción de módulos y volumen del negocio.</p>
        </div>
        {onGoToTiendas && (
          <button type="button" className="btn o s" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={onGoToTiendas}>
            Ver todas las tiendas →
          </button>
        )}
      </div>

      {/* KPIs Principales (4 columnas con los colores del Branding: Verde, Cyan, Azul Oscuro, Blanco) */}
      <div className="sec stats vendia-kpi-grid">
        <div className="stat kpi-emerald">
          <b>{money(metrics.mrr)}</b>
          <span>MRR (Ingreso Mensual Recurrente)</span>
        </div>

        <div className="stat kpi-cyan">
          <b>{money(metrics.arr)}</b>
          <span>ARR (Ingreso Anual Proyectado)</span>
        </div>

        <div className="stat kpi-navy">
          <b>{money(metrics.gmv)}</b>
          <span>GMV Global (Ventas procesadas)</span>
        </div>

        <div className="stat kpi-light">
          <b>{retentionRate}% ({metrics.activeStoresCount}/{metrics.totalStores})</b>
          <span>Tasa de Tiendas Activas</span>
        </div>
      </div>

      {/* SECCIÓN DE TENDENCIAS Y GRÁFICAS SAAS */}
      <div className="card sec" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--mist)',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, padding: 0, border: 0, fontSize: '12.5px', fontWeight: 700 }}>
                Tendencias y Rendimiento SaaS
              </h2>
              <span className="chip" style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0',
                fontSize: '8.5px',
                fontWeight: 700,
                padding: '1px 6px'
              }}>
                {trendHistory.growthLast90Days > 0
                  ? `+${trendHistory.growthLast90Days}% últimos 90d`
                  : trendHistory.growthLast90Days < 0
                    ? `${trendHistory.growthLast90Days}% últimos 90d`
                    : 'Estable últimos 90d'}
              </span>
            </div>
            <p className="hint" style={{ margin: '2px 0 0', fontSize: '9.5px' }}>
              Historial de evolución mensual de ingresos recurrentes, comercios y distribución por plan en tiempo real.
            </p>
          </div>

          {/* Selector de Vistas de Gráfica */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--fog)', padding: '2px', borderRadius: '7px' }}>
            <button
              type="button"
              className="btn s"
              style={{
                fontSize: '9.5px',
                padding: '3px 8px',
                minHeight: '24px',
                border: 'none',
                background: chartTab === 'mrr' ? '#334155' : 'transparent',
                color: chartTab === 'mrr' ? '#ffffff' : 'var(--graphite)',
                boxShadow: chartTab === 'mrr' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                fontWeight: 600,
                borderRadius: '5px'
              }}
              onClick={() => setChartTab('mrr')}
            >
              Evolución MRR
            </button>
            <button
              type="button"
              className="btn s"
              style={{
                fontSize: '9.5px',
                padding: '3px 8px',
                minHeight: '24px',
                border: 'none',
                background: chartTab === 'planes' ? '#334155' : 'transparent',
                color: chartTab === 'planes' ? '#ffffff' : 'var(--graphite)',
                boxShadow: chartTab === 'planes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                fontWeight: 600,
                borderRadius: '5px'
              }}
              onClick={() => setChartTab('planes')}
            >
              Ingresos por Plan
            </button>
            <button
              type="button"
              className="btn s"
              style={{
                fontSize: '9.5px',
                padding: '3px 8px',
                minHeight: '24px',
                border: 'none',
                background: chartTab === 'retencion' ? '#334155' : 'transparent',
                color: chartTab === 'retencion' ? '#ffffff' : 'var(--graphite)',
                boxShadow: chartTab === 'retencion' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                fontWeight: 600,
                borderRadius: '5px'
              }}
              onClick={() => setChartTab('retencion')}
            >
              Tiendas & Retención
            </button>
          </div>
        </div>

        {/* Pestaña 1: Gráfica de Área / Línea MRR (Gris Neutro Elegante) */}
        {chartTab === 'mrr' && (
          <div className="pad" style={{ padding: '16px 16px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '9.5px', color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  Ingreso Recurrente ({selectedMonthData.fullName})
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                    {money(selectedMonthData.mrr)}
                  </span>
                  {selectedMonthData.growthPct !== 0 && (
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: selectedMonthData.growthPct >= 0 ? '#16a34a' : '#dc2626',
                      background: selectedMonthData.growthPct >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      padding: '2px 6px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      {selectedMonthData.growthPct >= 0 ? '↗' : '↘'} {selectedMonthData.growthPct > 0 ? `+${selectedMonthData.growthPct}%` : `${selectedMonthData.growthPct}%`} MoM
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', fontSize: '10.5px', color: 'var(--graphite)', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '9px', color: 'var(--pewter)' }}>Comercios Activos</span>
                  <b style={{ color: 'var(--ink)', fontSize: '11.5px' }}>{selectedMonthData.stores || 0} tiendas</b>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '9px', color: 'var(--pewter)' }}>Pagos Cobrados</span>
                  <b style={{ color: 'var(--ink)', fontSize: '11.5px' }}>{money(selectedMonthData.collected || 0)}</b>
                </div>
                {selectedMonthData.gmv > 0 && (
                  <div>
                    <span style={{ display: 'block', fontSize: '9px', color: 'var(--pewter)' }}>GMV en Ventas</span>
                    <b style={{ color: 'var(--ink)', fontSize: '11.5px' }}>{money(selectedMonthData.gmv)}</b>
                  </div>
                )}
              </div>
            </div>

            {/* SVG Interactive Area Chart en Grises Neutros */}
            <div style={{ position: 'relative', width: '100%', height: '190px' }}>
              <svg
                viewBox="0 0 680 210"
                style={{ width: '100%', height: '100%', overflow: 'visible' }}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="mrrAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#475569" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#475569" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Líneas horizontales de cuadrícula con etiquetas */}
                {[0, 0.33, 0.66, 1].map((pct, idx) => {
                  const yVal = padTop + plotH * (1 - pct);
                  const labelVal = Math.round(maxVal * pct);
                  return (
                    <g key={idx}>
                      <line
                        x1={padLeft}
                        y1={yVal}
                        x2={chartWidth - padRight}
                        y2={yVal}
                        stroke="#e2e8f0"
                        strokeDasharray={pct === 0 ? "none" : "3 4"}
                        strokeWidth="1"
                      />
                      <text
                        x={padLeft - 8}
                        y={yVal + 3.5}
                        textAnchor="end"
                        fontSize="9"
                        fill="#64748b"
                        fontFamily="monospace"
                      >
                        S/. {labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Área con gradiente gris neutro */}
                <path d={areaPath} fill="url(#mrrAreaGrad)" />

                {/* Línea de tendencia fluida en gris elegante */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Puntos y columnas interactivas */}
                {points.map((pt, idx) => {
                  const isHovered = activePointIndex === idx;
                  return (
                    <g
                      key={idx}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setActivePointIndex(idx)}
                      onClick={() => setActivePointIndex(idx)}
                    >
                      {/* Línea vertical guía en hover */}
                      {isHovered && (
                        <line
                          x1={pt.x}
                          y1={padTop}
                          x2={pt.x}
                          y2={bottomY}
                          stroke="#cbd5e1"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Halo exterior en hover */}
                      {isHovered && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="9"
                          fill="rgba(71, 85, 105, 0.12)"
                        />
                      )}

                      {/* Punto principal */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 4.5 : 3.5}
                        fill="#ffffff"
                        stroke={isHovered ? "#0f172a" : "#475569"}
                        strokeWidth={isHovered ? 2.2 : 1.75}
                        style={{ transition: 'all 0.15s ease' }}
                      />

                      {/* Etiqueta del mes en eje X */}
                      <text
                        x={pt.x}
                        y="194"
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight={isHovered ? "700" : "500"}
                        fill={isHovered ? "#0f172a" : "#64748b"}
                      >
                        {pt.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Pestaña 2: Desglose y Facturación por Plan SaaS (Colores Grises Normales) */}
        {chartTab === 'planes' && (
          <div className="pad" style={{ padding: '20px 18px' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Distribución del Ingreso por Planes</span>
                <span className="hint" style={{ fontSize: '9.5px' }}>{stores.length} tiendas registradas en total</span>
              </div>
              <div style={{
                height: '10px',
                borderRadius: '6px',
                display: 'flex',
                overflow: 'hidden',
                background: '#f1f5f9',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
              }}>
                {trendHistory.planDistribution.map((p, idx) => {
                  const colors = ['#334155', '#475569', '#64748b', '#94a3b8'];
                  const color = colors[idx % colors.length];
                  const barWidth = p.mrrPct != null ? p.mrrPct : p.pct;
                  if (barWidth === 0) return null;
                  return (
                    <div
                      key={p.id}
                      style={{
                        width: `${barWidth}%`,
                        background: color,
                        transition: 'width 0.4s ease'
                      }}
                      title={`${p.nombre}: ${p.count} tiendas (${p.activeCount} activas) - ${money(p.revenue)}/mes`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Grid de Tarjetas de Planes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {trendHistory.planDistribution.map((p, idx) => {
                const borderColors = ['#334155', '#475569', '#64748b', '#94a3b8'];
                const accentColor = borderColors[idx % borderColors.length];
                return (
                  <div
                    key={p.id}
                    style={{
                      border: `1px solid var(--mist)`,
                      borderTop: `3px solid ${accentColor}`,
                      borderRadius: '10px',
                      padding: '14px',
                      background: 'var(--paper)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span className="chip" style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px' }}>{p.badge || 'Plan'}</span>
                      <b style={{ color: accentColor, fontSize: '11.5px' }}>{p.mrrPct != null ? p.mrrPct : p.pct}% de MRR</b>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)', marginBottom: 4 }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: '6px 0' }}>
                      {money(p.revenue)} <small style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--graphite)' }}>{p.precio === 0 ? '(Prueba)' : '/ mes'}</small>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--graphite)', borderTop: '1px solid var(--mist)', paddingTop: 6, marginTop: 6 }}>
                      <div><b>{p.count}</b> {p.count === 1 ? 'tienda' : 'tiendas'} ({p.activeCount} activas{p.suspendedCount > 0 ? `, ${p.suspendedCount} susp.` : ''})</div>
                      <div style={{ marginTop: 2 }}>Tarifa base: <b>{money(p.precio)}</b> {p.precio === 0 ? '(7 días)' : '/ mes'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pestaña 3: Crecimiento de Comercios y Tasa de Retención (Grises Normales) */}
        {chartTab === 'retencion' && (
          <div className="pad" style={{ padding: '20px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ink)' }}>Crecimiento de Clientes por Mes</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '125px', paddingBottom: '8px', borderBottom: '1px solid var(--mist)' }}>
                  {trendHistory.mrrTrend.map((m, idx) => {
                    const maxStores = Math.max(...trendHistory.mrrTrend.map(x => x.stores), 1);
                    const barHeight = m.stores > 0 ? Math.max(14, (m.stores / maxStores) * 95) : 3;
                    const isLatest = idx === trendHistory.mrrTrend.length - 1;
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: isLatest ? '#0f172a' : 'var(--graphite)' }}>
                          {m.stores}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '32px',
                            height: `${barHeight}px`,
                            background: isLatest ? '#475569' : m.stores > 0 ? '#cbd5e1' : '#f1f5f9',
                            borderRadius: '4px 4px 0 0',
                            border: isLatest ? 'none' : '1px solid #e2e8f0'
                          }}
                          title={`${m.fullName}: ${m.stores} tiendas activas - MRR: ${money(m.mrr)}`}
                        />
                        <span style={{ fontSize: '9.5px', color: 'var(--pewter)', fontWeight: isLatest ? 700 : 500 }}>
                          {m.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ink)' }}>Indicadores de Retención y Churn</h3>
                <div className="kv" style={{ margin: 0 }}>
                  <div>
                    <span style={{ fontSize: '11px' }}>Tasa de Retención Bruta</span>
                    <b style={{ color: '#16a34a', fontSize: '11.5px' }}>{metrics.retentionRate}%</b>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px' }}>Tasa de Churn (Bajas)</span>
                    <b style={{ color: metrics.churnRate > 0 ? '#dc2626' : 'var(--ink)', fontSize: '11.5px' }}>{metrics.churnRate}%</b>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px' }}>MRR en Riesgo / Suspendido</span>
                    <b style={{ color: metrics.churnedMrr > 0 ? '#dc2626' : 'var(--ink)', fontSize: '11.5px' }}>{money(metrics.churnedMrr)}</b>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px' }}>LTV Estimado (12 meses)</span>
                    <b style={{ fontSize: '11.5px' }}>{money(metrics.arpu * 12)} / cliente</b>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px' }}>Total Pagos Cobrados</span>
                    <b style={{ color: '#16a34a', fontSize: '11.5px' }}>{money(metrics.totalPaymentsCollected || 0)} ({metrics.totalPaymentsCount || 0})</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid de 2 Columnas */}
      <div className="two w sec">
        {/* Adopción de Módulos (Barras en Grises Limpios) */}
        <div className="card">
          <h2>Adopción de Módulos en Tiendas</h2>
          <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
              Porcentaje de comercios suscritos que tienen activo cada módulo:
            </p>

            {metrics.moduleAdoption.map((mod) => (
              <div key={mod.key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                    {mod.key === 'escaner' && <IconBarcode size={13} />}
                    {mod.key === 'reportes' && <IconReportes size={13} />}
                    {mod.name}
                  </span>
                  <span style={{ color: '#64748b' }}>
                    <b style={{ color: '#0f172a' }}>{mod.count}</b> tiendas ({mod.pct}%)
                  </span>
                </div>
                {/* Barra de progreso visual en gris sobrio */}
                <div
                  style={{
                    height: '7px',
                    borderRadius: '99px',
                    background: '#f1f5f9',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${mod.pct}%`,
                      background: 'linear-gradient(90deg, #334155 0%, #64748b 100%)',
                      borderRadius: '99px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas de Cobro Inminente */}
        <div className="card">
          <h2>Cobranzas Próximas (≤ 7 días)</h2>
          {tiendasPorVencer.length > 0 ? (
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {tiendasPorVencer.map((st) => {
                const days = diffDays(st.proximo_pago || st.proximo);
                const isOverdue = days < 0;
                return (
                  <div key={st.id} className="li" style={{ alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{st.nombre}</div>
                      <small style={{ fontSize: '10.5px', color: isOverdue ? '#e53935' : 'var(--graphite)' }}>
                        {isOverdue ? `Venció hace ${Math.abs(days)}d` : days === 0 ? '¡Vence hoy!' : `Vence en ${days} días`}
                        {' · '}
                        <b>{money(st.monto)}</b>
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn o s"
                      title="Enviar recordatorio por WhatsApp"
                      style={{
                        gap: '5px',
                        color: '#25D366',
                        borderColor: 'rgba(37, 211, 102, 0.4)',
                        background: 'rgba(37, 211, 102, 0.05)',
                        padding: '3px 7px',
                        fontSize: '10.5px'
                      }}
                      onClick={(e) => handleSendReminder(e, st)}
                    >
                      <IconWhatsApp size={13} color="#25D366" />
                      <span>Cobrar</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pad empty" style={{ textAlign: 'center', padding: '28px', fontSize: '11.5px' }}>
              Todas las tiendas están al día con sus pagos.
            </div>
          )}
        </div>
      </div>

      {/* Resumen de Salud Financiera del SaaS */}
      <div className="card sec">
        <h2>Resumen Ejecutivo del Sistema</h2>
        <div className="pad">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <small style={{ color: 'var(--graphite)', display: 'block', marginBottom: '3px', fontSize: '10.5px' }}>
                ARPU (Ingreso promedio por tienda)
              </small>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>{money(metrics.arpu)} / mes</span>
            </div>

            <div>
              <small style={{ color: 'var(--graphite)', display: 'block', marginBottom: '3px', fontSize: '10.5px' }}>
                Ventas registradas globalmente
              </small>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>
                {metrics.totalSalesCount} operaciones
              </span>
            </div>

            <div>
              <small style={{ color: 'var(--graphite)', display: 'block', marginBottom: '3px', fontSize: '10.5px' }}>
                Tiendas suspendidas
              </small>
              <span style={{ fontSize: '16px', fontWeight: 600, color: metrics.suspendedStoresCount > 0 ? '#e53935' : 'inherit' }}>
                {metrics.suspendedStoresCount} tiendas
              </span>
            </div>

            <div>
              <small style={{ color: 'var(--graphite)', display: 'block', marginBottom: '3px', fontSize: '10.5px' }}>
                Moneda de facturación
              </small>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>PEN (Soles peruanos S/.)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
