import { supabase } from '../lib/supabase';
import { getPeruDateIso } from '../utils/dateUtils';

/**
 * Exportar todos los datos de una tienda en formato JSON y CSV
 * Soporta modo en línea (Supabase) y modo demo/offline.
 */
export async function exportStoreCompleteData({
  storeId,
  storeName = 'Mi_Tienda',
  isDemoMode = false,
  localProducts = [],
  localSales = [],
  storeConfig = {}
}) {
  let exportData = {
    metadata: {
      tienda_id: storeId,
      tienda_nombre: storeName,
      fecha_exportacion: new Date().toISOString(),
      version_schema: '2.0',
      sistema: 'CobroFácil POS'
    },
    configuracion: storeConfig,
    productos: [],
    ventas: [],
    movimientos: []
  };

  if (!isDemoMode && storeId) {
    try {
      // 1. Obtener productos de Supabase
      const { data: dbProducts } = await supabase
        .from('productos')
        .select(`
          id,
          codigo_barras,
          nombre,
          precio,
          costo_unitario,
          unidad_medida,
          activo,
          creado_en,
          inventario (stock_actual, stock_minimo)
        `)
        .eq('tienda_id', storeId);

      if (dbProducts) {
        exportData.productos = dbProducts.map((p) => ({
          id: p.id,
          codigo_barras: p.codigo_barras || '',
          nombre: p.nombre,
          precio: parseFloat(p.precio) || 0,
          costo_unitario: parseFloat(p.costo_unitario) || 0,
          unidad_medida: p.unidad_medida || 'und',
          stock_actual: p.inventario?.[0]?.stock_actual ?? 0,
          stock_minimo: p.inventario?.[0]?.stock_minimo ?? 0,
          activo: p.activo ?? true,
          creado_en: p.creado_en
        }));
      }

      // 2. Obtener ventas de Supabase
      const { data: dbSales } = await supabase
        .from('ventas')
        .select(`
          id,
          serie,
          correlativo,
          total,
          metodo_pago,
          pagos_mixtos,
          estado,
          motivo_anulacion,
          creado_en,
          venta_items (
            producto_id,
            cantidad,
            precio_unitario,
            subtotal
          )
        `)
        .eq('tienda_id', storeId)
        .order('creado_en', { ascending: false });

      if (dbSales) {
        exportData.ventas = dbSales;
      }

      // 3. Obtener movimientos de inventario
      const { data: dbMovements } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('tienda_id', storeId)
        .order('creado_en', { ascending: false })
        .limit(500);

      if (dbMovements) {
        exportData.movimientos = dbMovements;
      }
    } catch (err) {
      console.warn('Fallback a datos locales para la exportación:', err);
      exportData.productos = localProducts;
      exportData.ventas = localSales;
    }
  } else {
    // Modo local / demo
    exportData.productos = localProducts;
    exportData.ventas = localSales;
  }

  // Si falló o estaba vacío en DB, asegurar que usemos los locales
  if (exportData.productos.length === 0 && localProducts.length > 0) {
    exportData.productos = localProducts;
  }
  if (exportData.ventas.length === 0 && localSales.length > 0) {
    exportData.ventas = localSales;
  }

  const cleanStoreName = storeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = getPeruDateIso();

  // 1. Descargar Archivo JSON Principal Completo
  const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json;charset=utf-8;'
  });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement('a');
  jsonLink.href = jsonUrl;
  jsonLink.download = `Backup_${cleanStoreName}_${dateStr}.json`;
  document.body.appendChild(jsonLink);
  jsonLink.click();
  document.body.removeChild(jsonLink);
  URL.revokeObjectURL(jsonUrl);

  return {
    success: true,
    totalProductos: exportData.productos.length,
    totalVentas: exportData.ventas.length
  };
}

/**
 * Exportar productos a archivo CSV compatible con Excel
 */
export function exportProductsToCSV(products, storeName = 'Tienda') {
  const headers = ['Código de Barras', 'Nombre', 'Precio Venta', 'Costo Unitario', 'Unidad de Medida', 'Stock Actual', 'Stock Mínimo', 'Estado'];
  const rows = products.map((p) => [
    `"${(p.codigo_barras || '').replace(/"/g, '""')}"`,
    `"${(p.nombre || '').replace(/"/g, '""')}"`,
    (p.precio || 0).toFixed(2),
    (p.costo_unitario || 0).toFixed(3),
    `"${p.unidad_medida || 'und'}"`,
    p.stock ?? p.stock_actual ?? 0,
    p.stock_minimo ?? 0,
    p.activo === false ? '"Archivado"' : '"Activo"'
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Productos_${storeName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${getPeruDateIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
