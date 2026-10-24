import { getPeruDateIso, formatPeruDate, getPeruTime } from './dateUtils';

// =====================================================================
// UTILIDAD PARA EXPORTAR DATOS A EXCEL / CSV CON UTF-8 BOM
// =====================================================================

function downloadCSV(filename, csvContent) {
  // UTF-8 BOM (\uFEFF) para que Microsoft Excel abra caracteres acentuados correctamente
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// 1. Exportar Catálogo de Inventario
export function exportProductsToCSV(products = [], storeName = 'MiTienda') {
  const headers = ['ID', 'Nombre', 'Categoría', 'Precio Venta', 'Stock Actual', 'Stock Mínimo', 'Estado Stock', 'Valor en Stock'];
  const rows = products.map((p) => {
    const estado = p.stock === 0 ? 'Agotado' : p.stock <= p.stock_minimo ? 'Bajo' : 'Normal';
    const valorStock = ((p.precio_venta || 0) * (p.stock || 0)).toFixed(2);
    return [
      p.id,
      p.nombre,
      p.categoria || 'General',
      (p.precio_venta || 0).toFixed(2),
      p.stock || 0,
      p.stock_minimo || 0,
      estado,
      valorStock
    ].map(escapeCSV).join(';');
  });

  const csv = [headers.map(escapeCSV).join(';'), ...rows].join('\r\n');
  const dateStr = getPeruDateIso();
  downloadCSV(`Inventario_${storeName.replace(/\s+/g, '_')}_${dateStr}.csv`, csv);
}

// 2. Exportar Historial de Ventas
export function exportSalesToCSV(sales = [], products = [], storeName = 'MiTienda') {
  const headers = ['ID Venta', 'Fecha/Hora', 'Vendedor', 'Método de Pago', 'Productos Detalle', 'Total (S/.)', 'Monto Recibido', 'Vuelto'];
  const rows = sales.map((s) => {
    const total = (s.total || s.items.reduce((a, x) => a + x.precio * x.cantidad, 0)).toFixed(2);
    const summary = s.items
      .map((x) => {
        const prod = products.find((p) => String(p.id) === String(x.producto_id));
        const nom = prod ? prod.nombre : (x.nombre || 'Producto');
        return `${x.cantidad}x ${nom} (S/. ${(x.precio * x.cantidad).toFixed(2)})`;
      })
      .join(' | ');

    const recibido = s.monto_recibido ? Number(s.monto_recibido).toFixed(2) : '-';
    const vuelto = s.monto_recibido && s.monto_recibido >= total ? (s.monto_recibido - total).toFixed(2) : '-';

    return [
      s.id,
      s.hora || s.fecha || '-',
      s.usuario || 'Vendedor',
      s.metodo_pago || 'Efectivo',
      summary,
      total,
      recibido,
      vuelto
    ].map(escapeCSV).join(';');
  });

  const csv = [headers.map(escapeCSV).join(';'), ...rows].join('\r\n');
  const dateStr = getPeruDateIso();
  downloadCSV(`Ventas_${storeName.replace(/\s+/g, '_')}_${dateStr}.csv`, csv);
}

// 3. Exportar Reporte Ejecutivo Consolidado
export function exportExecutiveReportToCSV(metrics = {}, topProducts = [], paymentMethods = [], storeName = 'MiTienda') {
  const lines = [
    `REPORTE EJECUTIVO Y ANALÍTICA DE VENTAS - ${storeName}`,
    `Fecha de generación: ${formatPeruDate(new Date())} ${getPeruTime()}`,
    '',
    'MÉTRICAS PRINCIPALES',
    `Ventas Totales (S/.);${metrics.totalVendido || '0.00'}`,
    `Número de Ventas;${metrics.nVentas || 0}`,
    `Ticket Promedio (S/.);${metrics.ticketPromedio || '0.00'}`,
    `Unidades Vendidas;${metrics.unidadesVendidas || 0}`,
    `Valor Estimado de Stock (S/.);${metrics.valorStock || '0.00'}`,
    '',
    'VENTAS POR FORMA DE PAGO',
    'Método;Total (S/.);Porcentaje (%)',
    ...paymentMethods.map((pm) => `${escapeCSV(pm.metodo)};${pm.total.toFixed(2)};${pm.porcentaje.toFixed(1)}%`),
    '',
    'TOP 5 PRODUCTOS MÁS VENDIDOS',
    'Ranking;Producto;Unidades Vendidas;Total Generado (S/.)',
    ...topProducts.map((p, idx) => `${idx + 1};${escapeCSV(p.nombre)};${p.cantidad};${p.total.toFixed(2)}`)
  ];

  const dateStr = getPeruDateIso();
  downloadCSV(`Informe_Analitica_${storeName.replace(/\s+/g, '_')}_${dateStr}.csv`, lines.join('\r\n'));
}
