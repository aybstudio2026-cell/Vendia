import React, { useState, useMemo } from 'react';
import { money, getUnidadMedida } from '../../constants/palettes';
import { exportExecutiveReportToCSV } from '../../utils/exportCSV';
import { IconDownload, IconTrending, IconUsers, IconBarcode } from '../common/Icons';
import AlertBellButton from '../common/AlertBellButton';
import { getPeruDateIso, parseToPeruDateIso, diffDaysPeru, getPeruDateParts } from '../../utils/dateUtils';

export default function ReportesTab({
  sales = [],
  products = [],
  storeName = "Mi Tienda",
  alertCount = 0,
  onOpenAlerts
}) {
  const [periodo, setPeriodo] = useState('mes'); // 'hoy', '7d', 'mes', 'todo'
  const [reportSubTab, setReportSubTab] = useState('general'); // 'general' | 'rentabilidad' | 'empleados' | 'turnos' | 'sin_rotacion'

  // Excluir ventas anuladas de los cálculos analíticos
  const validSales = useMemo(() => {
    return sales.filter((s) => s.estado !== 'anulada' && s.estado !== 'devuelta');
  }, [sales]);

  // Filtrar ventas por periodo seleccionado en hora de Perú (America/Lima)
  const { currentPeriodSales, previousPeriodSales } = useMemo(() => {
    const todayStr = getPeruDateIso();
    const todayParts = getPeruDateParts();

    const current = [];
    const previous = [];

    validSales.forEach((s) => {
      const saleIso = parseToPeruDateIso(s.fecha || s.creado_en);
      const diffDays = diffDaysPeru(saleIso); // 0 = hoy, -1 = ayer, etc.
      const saleParts = getPeruDateParts(s.creado_en || s.fecha);

      if (periodo === 'hoy') {
        if (saleIso === todayStr) {
          current.push(s);
        } else if (diffDays === -1) {
          previous.push(s); // Ayer
        }
      } else if (periodo === '7d') {
        if (diffDays <= 0 && diffDays >= -6) {
          current.push(s); // Últimos 7 días
        } else if (diffDays <= -7 && diffDays >= -13) {
          previous.push(s); // 7 días anteriores
        }
      } else if (periodo === 'mes') {
        if (saleParts.month === todayParts.month && saleParts.year === todayParts.year) {
          current.push(s);
        } else {
          const prevMonth = todayParts.month === 1 ? 12 : todayParts.month - 1;
          const prevYear = todayParts.month === 1 ? todayParts.year - 1 : todayParts.year;
          if (saleParts.month === prevMonth && saleParts.year === prevYear) {
            previous.push(s);
          }
        }
      } else {
        current.push(s);
      }
    });

    return { currentPeriodSales: current, previousPeriodSales: previous };
  }, [validSales, periodo]);

  // Totales
  const totalVendido = useMemo(() => {
    return currentPeriodSales.reduce((sum, s) => {
      return sum + (s.total || (s.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0));
    }, 0);
  }, [currentPeriodSales]);

  const totalPeriodoAnterior = useMemo(() => {
    return previousPeriodSales.reduce((sum, s) => {
      return sum + (s.total || (s.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0));
    }, 0);
  }, [previousPeriodSales]);

  // Crecimiento porcentual
  const crecimientoPct = useMemo(() => {
    if (totalPeriodoAnterior <= 0) return totalVendido > 0 ? 100 : 0;
    return Math.round(((totalVendido - totalPeriodoAnterior) / totalPeriodoAnterior) * 100);
  }, [totalVendido, totalPeriodoAnterior]);

  const nVentas = currentPeriodSales.length;
  const ticketPromedio = nVentas > 0 ? totalVendido / nVentas : 0;

  // Rentabilidad Real (COGS y Margen Bruto)
  const { unidadesVendidas, costoTotalVentas, gananciaBruta } = useMemo(() => {
    let units = 0;
    let totalCost = 0;

    currentPeriodSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        units += it.cantidad;
        const prod = products.find((p) => String(p.id) === String(it.producto_id));
        // Usar costo_unitario real si existe, o costo estimado
        const unitCost = (prod?.costo_unitario > 0 ? prod.costo_unitario : (prod?.costo > 0 ? prod.costo : it.precio * 0.65));
        totalCost += unitCost * it.cantidad;
      });
    });

    const profit = Math.max(0, totalVendido - totalCost);
    return {
      unidadesVendidas: units,
      costoTotalVentas: totalCost,
      gananciaBruta: profit
    };
  }, [currentPeriodSales, products, totalVendido]);

  const margenPorcentaje = totalVendido > 0 ? (gananciaBruta / totalVendido) * 100 : 0;

  // Ventas por Empleado
  const ventasPorEmpleado = useMemo(() => {
    const map = {};
    currentPeriodSales.forEach((s) => {
      const empName = s.usuario || 'Cajero Principal';
      if (!map[empName]) {
        map[empName] = { nombre: empName, total: 0, tickets: 0 };
      }
      const tot = s.total || (s.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0);
      map[empName].total += tot;
      map[empName].tickets += 1;
    });

    return Object.values(map)
      .map((e) => ({
        ...e,
        ticketPromedio: e.tickets > 0 ? e.total / e.tickets : 0,
        participacion: totalVendido > 0 ? (e.total / totalVendido) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [currentPeriodSales, totalVendido]);

  // Ventas por Turno (Mañana: 06:00 - 13:59 vs Tarde/Noche: 14:00 - 23:59)
  const ventasPorTurno = useMemo(() => {
    let mananaTotal = 0;
    let mananaCount = 0;
    let tardeTotal = 0;
    let tardeCount = 0;

    currentPeriodSales.forEach((s) => {
      let hour = 12;
      if (s.hora && s.hora.includes(':')) {
        hour = parseInt(s.hora.split(':')[0], 10) || 12;
      } else if (s.creado_en) {
        hour = getPeruDateParts(s.creado_en).hour;
      }

      const tot = s.total || (s.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0);
      if (hour < 14) {
        mananaTotal += tot;
        mananaCount += 1;
      } else {
        tardeTotal += tot;
        tardeCount += 1;
      }
    });

    return {
      manana: { total: mananaTotal, count: mananaCount, pct: totalVendido > 0 ? (mananaTotal / totalVendido) * 100 : 0 },
      tarde: { total: tardeTotal, count: tardeCount, pct: totalVendido > 0 ? (tardeTotal / totalVendido) * 100 : 0 }
    };
  }, [currentPeriodSales, totalVendido]);

  // Ventas por Hora (Distribución 08h a 22h)
  const ventasPorHora = useMemo(() => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8:00 a 22:00
    const amounts = hours.map(() => 0);

    currentPeriodSales.forEach((s) => {
      let hour = 12;
      if (s.hora && s.hora.includes(':')) {
        hour = parseInt(s.hora.split(':')[0], 10) || 12;
      } else if (s.creado_en) {
        hour = getPeruDateParts(s.creado_en).hour;
      }

      if (hour >= 8 && hour <= 22) {
        const index = hour - 8;
        const tot = s.total || (s.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0);
        amounts[index] += tot;
      }
    });

    const maxVal = Math.max(...amounts, 10);
    return hours.map((h, i) => ({
      hour: `${h}:00`,
      amount: amounts[i],
      heightPct: Math.round((amounts[i] / maxVal) * 100)
    }));
  }, [currentPeriodSales]);

  // Productos Sin Rotación (Dead Stock)
  const productosSinRotacion = useMemo(() => {
    const soldProductIds = new Set();
    currentPeriodSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        soldProductIds.add(String(it.producto_id));
      });
    });

    return products
      .filter((p) => p.activo !== false && (p.stock || 0) > 0 && !soldProductIds.has(String(p.id)))
      .map((p) => {
        const costPrice = p.costo_unitario > 0 ? p.costo_unitario : p.precio_venta * 0.65;
        const capitalInmovilizado = Math.round((p.stock || 0) * costPrice * 100) / 100;
        return {
          ...p,
          capitalInmovilizado
        };
      })
      .sort((a, b) => b.capitalInmovilizado - a.capitalInmovilizado);
  }, [currentPeriodSales, products]);

  const capitalTotalInmovilizado = productosSinRotacion.reduce((sum, p) => sum + p.capitalInmovilizado, 0);

  // Top 5 productos más vendidos
  const topProducts = useMemo(() => {
    const map = {};
    currentPeriodSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const prod = products.find((p) => String(p.id) === String(it.producto_id));
        const name = prod ? prod.nombre : (it.nombre || `Producto ${it.producto_id}`);
        if (!map[name]) {
          map[name] = { nombre: name, cantidad: 0, total: 0 };
        }
        map[name].cantidad += it.cantidad;
        map[name].total += it.precio * it.cantidad;
      });
    });

    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [currentPeriodSales, products]);

  // Exportar informe CSV
  const handleExportCSV = () => {
    exportExecutiveReportToCSV(
      {
        totalVendido: totalVendido.toFixed(2),
        nVentas,
        ticketPromedio: ticketPromedio.toFixed(2),
        unidadesVendidas,
        valorStock: gananciaBruta.toFixed(2)
      },
      topProducts,
      [],
      storeName
    );
  };

  return (
    <div>
      <div className="bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1>Reportes y Analíticas</h1>
            <span className="chip" style={{ background: 'color-mix(in srgb, var(--ember) 12%, transparent)', color: 'var(--ember)', borderColor: 'var(--ember)' }}>
              Pro
            </span>
          </div>
          <p className="lead">Rentabilidad, desempeño por cajero, turnos pico y capital en inventario.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn o"
            onClick={handleExportCSV}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px' }}
          >
            <IconDownload size={16} />
            <span>Exportar Informe CSV</span>
          </button>
          {onOpenAlerts && (
            <AlertBellButton alertCount={alertCount} onOpenAlerts={onOpenAlerts} />
          )}
        </div>
      </div>

      {/* Selector de Rango de Periodos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div className="pills">
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: '7d', label: 'Últimos 7 días' },
            { id: 'mes', label: 'Este mes' },
            { id: 'todo', label: 'Histórico' }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              className="pill"
              aria-pressed={periodo === p.id}
              onClick={() => setPeriodo(p.id)}
              style={{ minHeight: '38px' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Comparación con periodo anterior */}
        <div style={{ fontSize: '12px', color: 'var(--graphite)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>vs periodo anterior:</span>
          <b style={{ color: crecimientoPct >= 0 ? '#15803d' : '#dc2626' }}>
            {crecimientoPct >= 0 ? `+${crecimientoPct}% ↑` : `${crecimientoPct}% ↓`}
          </b>
          <span>({money(totalPeriodoAnterior)})</span>
        </div>
      </div>

      {/* Tarjetas de Métricas Principales (KPIs) */}
      <div className="sec stats">
        <div className="stat primary">
          <b>{money(totalVendido)}</b>
          <span>Ventas Totales</span>
        </div>
        <div className="stat">
          <b style={{ color: '#15803d' }}>{money(gananciaBruta)}</b>
          <span>Ganancia Bruta ({margenPorcentaje.toFixed(1)}%)</span>
        </div>
        <div className="stat">
          <b>{money(ticketPromedio)}</b>
          <span>Ticket Promedio</span>
        </div>
        <div className="stat">
          <b style={{ color: productosSinRotacion.length > 0 ? '#d97706' : 'inherit' }}>
            {money(capitalTotalInmovilizado)}
          </b>
          <span>Capital sin rotación ({productosSinRotacion.length} prods)</span>
        </div>
      </div>

      {/* Pestañas Secundarias de Reportes */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid var(--mist)', paddingBottom: '8px', overflowX: 'auto' }}>
        {[
          { id: 'general', label: '📊 General & Horas' },
          { id: 'rentabilidad', label: '💰 Rentabilidad & Costos' },
          { id: 'empleados', label: '👤 Ventas por Cajero' },
          { id: 'turnos', label: '⏱️ Turnos Mañana / Tarde' },
          { id: 'sin_rotacion', label: `📦 Sin Rotación (${productosSinRotacion.length})` }
        ].map((sub) => (
          <button
            key={sub.id}
            type="button"
            className="pill"
            aria-pressed={reportSubTab === sub.id}
            onClick={() => setReportSubTab(sub.id)}
            style={{ minHeight: '36px', fontSize: '12px' }}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* SECCIÓN 1: GENERAL & HORAS */}
      {reportSubTab === 'general' && (
        <div className="two" style={{ marginBottom: '24px' }}>
          {/* Gráfico de Ventas por Hora */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <b style={{ fontSize: '15px' }}>Horas Pico de Venta</b>
                <span className="hint" style={{ display: 'block', fontSize: '12px' }}>Distribución de 08:00 a 22:00</span>
              </div>
              <IconTrending size={18} />
            </div>

            <div className="bars" style={{ height: '170px', marginTop: '16px' }}>
              {ventasPorHora.map((vh, idx) => (
                <div key={idx}>
                  <small style={{ fontSize: '9px', color: 'var(--pewter)' }}>
                    {vh.amount > 0 ? `S/.${Math.round(vh.amount)}` : ''}
                  </small>
                  <i
                    style={{
                      height: `${Math.max(vh.heightPct, 6)}%`,
                      background: vh.amount > 0 ? 'var(--ember)' : 'var(--mist)',
                      transition: 'height 0.3s ease'
                    }}
                    title={`${vh.hour}: ${money(vh.amount)}`}
                  />
                  <span style={{ fontSize: '9px' }}>{vh.hour.slice(0, 2)}h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Productos */}
          <div className="card" style={{ padding: '20px' }}>
            <b style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>Top 5 Productos Más Vendidos</b>
            <span className="hint" style={{ display: 'block', marginBottom: '14px', fontSize: '12px' }}>Por recaudación total</span>

            {topProducts.length > 0 ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                {topProducts.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--fog)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: idx === 0 ? 'var(--ember)' : 'var(--paper)', color: idx === 0 ? '#fff' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                        {idx + 1}
                      </span>
                      <div>
                        <b style={{ fontSize: '12px' }}>{p.nombre}</b>
                        <small style={{ display: 'block', color: 'var(--pewter)', fontSize: '11px' }}>{p.cantidad} despachados</small>
                      </div>
                    </div>
                    <b>{money(p.total)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">Sin ventas en este periodo.</div>
            )}
          </div>
        </div>
      )}

      {/* SECCIÓN 2: RENTABILIDAD */}
      {reportSubTab === 'rentabilidad' && (
        <div className="card" style={{ padding: '20px' }}>
          <h2>Estado de Rentabilidad y Margen Bruto</h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: '20px' }}>
            Calculado en base a precios de venta y costos de compra registrados en el catálogo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '16px', background: 'var(--fog)', borderRadius: '8px' }}>
              <span className="hint" style={{ fontSize: '11px', display: 'block' }}>INGRESOS TOTALES</span>
              <b style={{ fontSize: '20px' }}>{money(totalVendido)}</b>
            </div>
            <div style={{ padding: '16px', background: 'var(--fog)', borderRadius: '8px' }}>
              <span className="hint" style={{ fontSize: '11px', display: 'block' }}>COSTO DE PRODUCTOS VENDIDOS</span>
              <b style={{ fontSize: '20px', color: 'var(--graphite)' }}>{money(costoTotalVentas)}</b>
            </div>
            <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <span className="hint" style={{ fontSize: '11px', display: 'block', color: '#15803d' }}>UTILIDAD BRUTA</span>
              <b style={{ fontSize: '20px', color: '#15803d' }}>{money(gananciaBruta)}</b>
            </div>
            <div style={{ padding: '16px', background: 'var(--fog)', borderRadius: '8px' }}>
              <span className="hint" style={{ fontSize: '11px', display: 'block' }}>MARGEN DE GANANCIA</span>
              <b style={{ fontSize: '20px' }}>{margenPorcentaje.toFixed(1)}%</b>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: VENTAS POR EMPLEADO */}
      {reportSubTab === 'empleados' && (
        <div className="card" style={{ padding: '20px' }}>
          <h2>Rendimiento de Ventas por Cajero / Empleado</h2>
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--fog)', borderBottom: '1px solid var(--mist)' }}>
                  <th style={{ padding: '10px' }}>Cajero / Empleado</th>
                  <th style={{ padding: '10px' }}>Boletas / Ventas</th>
                  <th style={{ padding: '10px' }}>Total Recaudado</th>
                  <th style={{ padding: '10px' }}>Ticket Promedio</th>
                  <th style={{ padding: '10px' }}>Participación</th>
                </tr>
              </thead>
              <tbody>
                {ventasPorEmpleado.map((emp, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--mist)' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>👤 {emp.nombre}</td>
                    <td style={{ padding: '10px' }}>{emp.tickets}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{money(emp.total)}</td>
                    <td style={{ padding: '10px' }}>{money(emp.ticketPromedio)}</td>
                    <td style={{ padding: '10px' }}>{emp.participacion.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECCIÓN 4: TURNOS MAÑANA / TARDE */}
      {reportSubTab === 'turnos' && (
        <div className="card" style={{ padding: '20px' }}>
          <h2>Comparación por Turnos de Trabajo</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
            <div style={{ padding: '16px', background: 'var(--fog)', borderRadius: '8px' }}>
              <h3>🌅 Turno Mañana (06:00 - 14:00)</h3>
              <p style={{ fontSize: '22px', fontWeight: '800', margin: '8px 0' }}>{money(ventasPorTurno.manana.total)}</p>
              <span className="hint">{ventasPorTurno.manana.count} ventas ({ventasPorTurno.manana.pct.toFixed(1)}% del total)</span>
            </div>
            <div style={{ padding: '16px', background: 'var(--fog)', borderRadius: '8px' }}>
              <h3>🌆 Turno Tarde / Noche (14:00 - 23:00)</h3>
              <p style={{ fontSize: '22px', fontWeight: '800', margin: '8px 0' }}>{money(ventasPorTurno.tarde.total)}</p>
              <span className="hint">{ventasPorTurno.tarde.count} ventas ({ventasPorTurno.tarde.pct.toFixed(1)}% del total)</span>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 5: PRODUCTOS SIN ROTACIÓN (DEAD STOCK) */}
      {reportSubTab === 'sin_rotacion' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Productos Sin Rotación (Inventario Estancado)</h2>
              <span className="hint" style={{ fontSize: '12px' }}>
                Mercadería con existencias pero con 0 ventas en el periodo seleccionado.
              </span>
            </div>
            <div style={{ padding: '6px 12px', background: '#fef3c7', borderRadius: '8px', color: '#92400e', fontWeight: 'bold', fontSize: '13px' }}>
              Capital inmovilizado: {money(capitalTotalInmovilizado)}
            </div>
          </div>

          {productosSinRotacion.length > 0 ? (
            <div style={{ overflowX: 'auto', marginTop: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--fog)', borderBottom: '1px solid var(--mist)' }}>
                    <th style={{ padding: '8px 10px' }}>Producto</th>
                    <th style={{ padding: '8px 10px' }}>Categoría</th>
                    <th style={{ padding: '8px 10px' }}>Stock Actual</th>
                    <th style={{ padding: '8px 10px' }}>Precio Venta</th>
                    <th style={{ padding: '8px 10px' }}>Capital Inmovilizado</th>
                  </tr>
                </thead>
                <tbody>
                  {productosSinRotacion.map((p) => {
                    const unit = getUnidadMedida(p.unidad_medida);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--mist)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '600' }}>{p.nombre}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--graphite)' }}>{p.categoria || 'General'}</td>
                        <td style={{ padding: '8px 10px' }}>{p.stock} {unit.short}</td>
                        <td style={{ padding: '8px 10px' }}>{money(p.precio_venta)}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#b45309' }}>
                          {money(p.capitalInmovilizado)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty" style={{ padding: '30px', textAlign: 'center' }}>
              🎉 ¡Excelente rotación! Todos tus productos con stock han registrado al menos una venta.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
