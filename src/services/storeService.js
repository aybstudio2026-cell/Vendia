import { supabase } from '../lib/supabase';
import { getPeruDateIso, getPeruTime, formatPeruDate } from '../utils/dateUtils';

// =====================================================================
// SERVICIO DE TIENDA (CLIENTE: DUEÑO Y EMPLEADO)
// Mapea directamente a las funciones RPC y tablas del esquema SQL v2
// =====================================================================

/**
 * Obtener productos e inventario de la tienda para la sede activa
 */
export async function getStoreProducts(storeId, sedeId) {
  if (!storeId) return [];

  // 1. Obtener productos de la tienda con fallback para schemas sin la columna 'activo'
  let prods = [];
  try {
    const { data: activeProds, error: prodErr } = await supabase
      .from('productos')
      .select('*')
      .eq('tienda_id', storeId)
      .eq('activo', true)
      .order('nombre');

    if (prodErr) throw prodErr;
    prods = activeProds || [];
  } catch (err) {
    // Si la columna 'activo' aún no existe en Supabase, reintentar sin filtrar por activo
    const { data: allProds, error: retryErr } = await supabase
      .from('productos')
      .select('*')
      .eq('tienda_id', storeId)
      .order('nombre');

    if (retryErr) {
      console.error('Error al obtener productos de tienda:', retryErr);
      return [];
    }
    prods = allProds || [];
  }

  if (prods.length === 0) return [];

  // 2. Obtener el stock de estos productos en la sede
  // 2. Obtener el stock de estos productos en la tienda
  const { data: inv, error: invErr } = await supabase
    .from('inventario')
    .select('*')
    .eq('tienda_id', storeId);

  if (invErr) console.warn('Aviso al obtener inventario:', invErr);

  const stockMap = {};
  (inv || []).forEach((row) => {
    // Soportar tanto stock_actual como cantidad según la versión del esquema
    const qty = parseFloat(row.stock_actual ?? row.cantidad ?? 0);
    stockMap[row.producto_id] = (stockMap[row.producto_id] || 0) + qty;
  });

  return prods.map((p) => ({
    ...p,
    precio_venta: parseFloat(p.precio_venta ?? p.precio ?? 0),
    stock: stockMap[p.id] !== undefined ? stockMap[p.id] : 0,
    stock_minimo: parseFloat(p.stock_minimo ?? p.minimo ?? 5)
  }));
}

/**
 * Obtener movimientos de inventario recientes de la tienda
 */
export async function getStoreInventoryMovements(storeId, limit = 10) {
  if (!storeId) return [];

  const { data, error } = await supabase
    .from('movimientos_inventario')
    .select(`
      id,
      tipo,
      cantidad,
      nota,
      creado_en,
      producto_id,
      productos (nombre),
      perfiles (nombre)
    `)
    .eq('tienda_id', storeId)
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error al obtener movimientos de inventario:', error);
    return [];
  }

  return (data || []).map((m) => {
    return {
      id: m.id,
      tipo: m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'venta' ? 'Venta' : 'Ajuste',
      cantidad: m.cantidad,
      producto_id: m.producto_id,
      producto_nombre: m.productos?.nombre || 'Producto',
      usuario: m.perfiles?.nombre || 'Sistema',
      hora: getPeruTime(m.creado_en),
      fecha: formatPeruDate(m.creado_en)
    };
  });
}

/**
 * Registrar una venta vía RPC: registrar_venta(...)
 * Ejecuta en una sola transacción: verifica stock con bloqueo, descuenta, crea venta,
 * genera correlativo consecutivo por tienda, registra venta_items, registra movimientos_inventario,
 * almacena pagos mixtos y clave de idempotencia anti-duplicados.
 */
export async function registrarVentaRPC({
  sedeId,
  metodoPago,
  items,
  montoRecibido,
  pagosMixtos = null,
  idempotencyKey = null
}) {
  // items: [{ producto_id: "...", cantidad: 2 }, ...]
  const payload = {
    p_sede_id: sedeId,
    p_metodo_pago: metodoPago,
    p_items: items,
    p_monto_recibido: montoRecibido ? parseFloat(montoRecibido) : null,
    p_pagos_mixtos: pagosMixtos || null,
    p_idempotency_key: idempotencyKey || null
  };

  const { data, error } = await supabase.rpc('registrar_venta', payload);
  if (error) throw error;
  return data; // { venta_id, correlativo, serie, total, vuelto }
}

/**
 * Anular o devolver una venta vía RPC: anular_venta(...)
 * Restaura automáticamente el stock de los productos vendidos y genera los movimientos de inventario correspondientes.
 */
export async function anularVentaRPC({ sedeId, ventaId, motivo = 'Anulación de venta' }) {
  // 1. Obtener la venta para conocer su sede_id y tienda_id reales
  let realSedeId = sedeId;
  let realTiendaId = null;
  try {
    const { data: vRow } = await supabase
      .from('ventas')
      .select('id, sede_id, tienda_id')
      .eq('id', ventaId)
      .maybeSingle();

    if (vRow?.sede_id) realSedeId = vRow.sede_id;
    if (vRow?.tienda_id) realTiendaId = vRow.tienda_id;
  } catch (e) {}

  // 2. Intentar llamar al RPC anular_venta
  try {
    const payload = {
      p_sede_id: realSedeId,
      p_venta_id: ventaId,
      p_motivo: motivo
    };
    const { data, error } = await supabase.rpc('anular_venta', payload);
    if (!error && data) return data;
    console.warn('RPC anular_venta avisó, usando fallback directo:', error?.message);
  } catch (rpcErr) {
    console.warn('RPC anular_venta excepción:', rpcErr);
  }

  // 3. Fallback directo garantizado: actualizar estado de la venta
  const { error: updErr } = await supabase
    .from('ventas')
    .update({
      estado: 'anulada',
      motivo_anulacion: motivo,
      anulada_en: new Date().toISOString()
    })
    .eq('id', ventaId);

  if (updErr) throw updErr;

  // 4. Restaurar stock en inventario para cada ítem vendido
  try {
    const { data: items } = await supabase
      .from('venta_items')
      .select('producto_id, cantidad, tienda_id')
      .eq('venta_id', ventaId);

    if (items && items.length > 0) {
      for (const it of items) {
        const { data: invRow } = await supabase
          .from('inventario')
          .select('producto_id, stock_actual, cantidad, tienda_id')
          .eq('producto_id', it.producto_id)
          .limit(1)
          .maybeSingle();

        if (invRow) {
          const qty = parseFloat(it.cantidad || 0);
          const currentStock = parseFloat(invRow.stock_actual ?? invRow.cantidad ?? 0);
          const restored = currentStock + qty;

          await supabase
            .from('inventario')
            .update({
              stock_actual: restored,
              cantidad: restored,
              actualizado_en: new Date().toISOString()
            })
            .eq('producto_id', it.producto_id);

          await supabase
            .from('movimientos_inventario')
            .insert({
              tienda_id: invRow.tienda_id || realTiendaId,
              producto_id: it.producto_id,
              tipo: 'ajuste',
              tipo_movimiento: 'devolucion_cliente',
              cantidad: qty,
              nota: `Devolución venta: ${motivo}`
            });
        }
      }
    }
  } catch (fallbackInvErr) {
    console.warn('Aviso al restaurar existencias en fallback:', fallbackInvErr);
  }

  return { success: true, fallback: true };
}

/**
 * Crear un producto y su stock inicial en una sola transacción vía RPC o fallback directo
 */
export async function crearProductoRPC({
  sedeId,
  nombre,
  categoria = 'General',
  precioVenta,
  costoUnitario = 0,
  stockMinimo = 5,
  stockInicial = 0,
  codigoBarras = null,
  unidadMedida = 'und',
  activo = true
}) {
  // 1. Intentar vía RPC crear_producto si existe
  try {
    const payload = {
      p_sede_id: sedeId,
      p_nombre: nombre,
      p_categoria: categoria,
      p_precio: parseFloat(precioVenta),
      p_minimo: parseInt(stockMinimo, 10) || 5,
      p_stock_inicial: parseFloat(stockInicial) || 0
    };
    const { data, error } = await supabase.rpc('crear_producto', payload);
    if (!error && data) return data;
  } catch (rpcErr) {
    console.warn('RPC crear_producto no disponible, ejecutando inserción directa:', rpcErr);
  }

  // 2. Fallback resiliente: inserción directa en tablas respetando RLS
  let realTiendaId = null;
  let realSedeId = null;

  // Verificar si sedeId es un id válido en sedes
  const { data: sedeRecord } = await supabase
    .from('sedes')
    .select('id, tienda_id')
    .eq('id', sedeId)
    .maybeSingle();

  if (sedeRecord) {
    realSedeId = sedeRecord.id;
    realTiendaId = sedeRecord.tienda_id;
  } else {
    // Si no es un id de sede, es un id de tienda: buscar o crear la sede de esa tienda
    realTiendaId = sedeId;
    const { data: foundSede } = await supabase
      .from('sedes')
      .select('id')
      .eq('tienda_id', realTiendaId)
      .limit(1)
      .maybeSingle();

    if (foundSede) {
      realSedeId = foundSede.id;
    } else {
      try {
        const { data: newSede } = await supabase
          .from('sedes')
          .insert({
            tienda_id: realTiendaId,
            nombre: 'Sede Principal',
            es_principal: true,
            activa: true
          })
          .select('id')
          .single();
        realSedeId = newSede?.id || null;
      } catch (sErr) {
        console.warn('Aviso al crear sede:', sErr);
      }
    }
  }

  const { data: newProd, error: pErr } = await supabase
    .from('productos')
    .insert({
      tienda_id: realTiendaId,
      nombre: nombre.trim(),
      categoria: categoria || 'General',
      precio: parseFloat(precioVenta),
      precio_venta: parseFloat(precioVenta),
      costo_unitario: parseFloat(costoUnitario) || 0,
      unidad_medida: unidadMedida || 'und',
      codigo_barras: codigoBarras ? String(codigoBarras).trim() : null,
      activo: activo !== false
    })
    .select('id')
    .single();

  if (pErr) throw pErr;

  const prodId = newProd.id;
  const initialQty = parseFloat(stockInicial) || 0;

  // Insertar existencia en inventario
  const invData = {
    tienda_id: realTiendaId,
    producto_id: prodId,
    stock_actual: initialQty,
    cantidad: initialQty,
    stock_minimo: parseFloat(stockMinimo) || 5,
    actualizado_en: new Date().toISOString()
  };
  if (realSedeId) invData.sede_id = realSedeId;

  const { error: invErr } = await supabase
    .from('inventario')
    .insert(invData);

  if (invErr) console.warn('Aviso al insertar inventario:', invErr.message);

  // Registrar movimiento kardex si hay stock inicial
  if (initialQty > 0) {
    const movData = {
      tienda_id: realTiendaId,
      producto_id: prodId,
      tipo: 'entrada',
      tipo_movimiento: 'entrada',
      cantidad: initialQty,
      nota: 'Stock inicial de apertura de producto'
    };
    if (realSedeId) movData.sede_id = realSedeId;
    await supabase.from('movimientos_inventario').insert(movData);
  }

  return prodId;
}

/**
 * Editar precio, categoría, stock mínimo y delta de stock vía RPC o fallback directo
 */
export async function editarProductoRPC({
  productoId,
  sedeId,
  nombre = null,
  categoria = 'General',
  precioVenta,
  costoUnitario = null,
  stockMinimo = 5,
  delta = 0,
  codigoBarras = undefined,
  unidadMedida = null,
  activo = undefined,
  nota = null
}) {
  const numericDelta = parseFloat(delta) || 0;

  // 1. Intentar vía RPC si sólo son campos clásicos
  try {
    const payload = {
      p_producto_id: productoId,
      p_sede_id: sedeId,
      p_categoria: categoria,
      p_precio: parseFloat(precioVenta),
      p_minimo: parseInt(stockMinimo, 10) || 5,
      p_delta: numericDelta,
      p_nota: nota
    };
    const { data, error } = await supabase.rpc('editar_producto', payload);
    if (!error) {
      // Si se especificó nombre, costo, código o activo, actualizar esos campos adicionales
      const extraFields = {};
      if (nombre) extraFields.nombre = nombre.trim();
      if (costoUnitario !== null && costoUnitario !== undefined) extraFields.costo_unitario = parseFloat(costoUnitario) || 0;
      if (codigoBarras !== undefined) extraFields.codigo_barras = codigoBarras ? String(codigoBarras).trim() : null;
      if (unidadMedida) extraFields.unidad_medida = unidadMedida;
      if (activo !== undefined) extraFields.activo = activo;

      if (Object.keys(extraFields).length > 0) {
        await supabase.from('productos').update(extraFields).eq('id', productoId);
      }
      return data;
    }
  } catch (rpcErr) {
    console.warn('RPC editar_producto avisó, usando fallback directo:', rpcErr);
  }

  // 2. Fallback resiliente: actualización directa
  const updateFields = {
    categoria: categoria || 'General',
    precio: parseFloat(precioVenta),
    precio_venta: parseFloat(precioVenta),
    stock_minimo: parseFloat(stockMinimo) || 5
  };
  if (nombre) updateFields.nombre = nombre.trim();
  if (costoUnitario !== null && costoUnitario !== undefined) updateFields.costo_unitario = parseFloat(costoUnitario) || 0;
  if (codigoBarras !== undefined) updateFields.codigo_barras = codigoBarras ? String(codigoBarras).trim() : null;
  if (unidadMedida) updateFields.unidad_medida = unidadMedida;
  if (activo !== undefined) updateFields.activo = activo;

  const { error: prodErr } = await supabase
    .from('productos')
    .update(updateFields)
    .eq('id', productoId);

  if (prodErr) throw prodErr;

  // Ajustar inventario si hay variación (delta != 0) o asegurar existencia de fila
  const { data: invRow } = await supabase
    .from('inventario')
    .select('producto_id, stock_actual, cantidad, tienda_id, sede_id')
    .eq('producto_id', productoId)
    .maybeSingle();

  if (invRow) {
    const currentStock = parseFloat(invRow.stock_actual ?? invRow.cantidad ?? 0);
    const newStock = Math.max(0, currentStock + numericDelta);

    await supabase
      .from('inventario')
      .update({
        stock_actual: newStock,
        cantidad: newStock,
        stock_minimo: parseFloat(stockMinimo) || 5,
        actualizado_en: new Date().toISOString()
      })
      .eq('producto_id', productoId);

    if (numericDelta !== 0) {
      await supabase.from('movimientos_inventario').insert({
        tienda_id: invRow.tienda_id,
        sede_id: invRow.sede_id || null,
        producto_id: productoId,
        tipo: numericDelta > 0 ? 'entrada' : 'ajuste',
        tipo_movimiento: numericDelta > 0 ? 'entrada' : 'ajuste',
        cantidad: numericDelta,
        nota: nota || (numericDelta > 0 ? 'Entrada de mercancía' : 'Ajuste de inventario')
      });
    }
  } else {
    // Si no existía fila de inventario, crearla con el stock establecido
    const { data: prodData } = await supabase.from('productos').select('tienda_id').eq('id', productoId).maybeSingle();
    if (prodData?.tienda_id) {
      await supabase.from('inventario').insert({
        tienda_id: prodData.tienda_id,
        producto_id: productoId,
        stock_actual: Math.max(0, numericDelta),
        cantidad: Math.max(0, numericDelta),
        stock_minimo: parseFloat(stockMinimo) || 5,
        actualizado_en: new Date().toISOString()
      });
    }
  }

  return { success: true };
}

/**
 * Guardar la paleta de la tienda vía RPC
 */
export async function guardarPaletaRPC({ storeId, paleta, custom = null }) {
  const payload = {
    p_tienda_id: storeId,
    p_paleta: paleta,
    p_custom: custom
  };

  // 1. Intentar vía RPC
  try {
    const { data, error } = await supabase.rpc('guardar_paleta', payload);
    if (!error) return data;
    console.warn('RPC guardar_paleta avisó:', error.message);
  } catch (err) {
    console.warn('RPC guardar_paleta excepción:', err);
  }

  // 2. Fallback: actualización directa en tabla tiendas protegida por RLS
  const updateData = { paleta };
  if (custom) updateData.paleta_custom = custom;

  const { data, error } = await supabase
    .from('tiendas')
    .update(updateData)
    .eq('id', storeId)
    .select();

  if (error) {
    console.warn('Fallback update tiendas paleta avisó:', error.message);
  }
  return data;
}

/**
 * Obtener métricas de la pantalla Resumen del dueño vía RPC: resumen_tienda(...)
 */
export async function getResumenTiendaRPC(storeId) {
  const { data, error } = await supabase.rpc('resumen_tienda', {
    p_tienda_id: storeId
  });

  if (error) throw error;
  return data;
}

/**
 * Obtener las ventas de la tienda
 */
export async function getStoreSalesToday(storeId) {
  if (!storeId) return [];

  let salesData = [];
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select(`
        id,
        total,
        metodo_pago,
        monto_recibido,
        pagos_mixtos,
        estado,
        motivo_anulacion,
        anulada_en,
        serie,
        correlativo,
        idempotency_key,
        creado_en,
        perfiles (nombre),
        venta_items (
          id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          productos (nombre)
        )
      `)
      .eq('tienda_id', storeId)
      .order('creado_en', { ascending: false })
      .limit(300);

    if (error) throw error;
    salesData = data || [];
  } catch (err) {
    console.warn('Aviso al obtener ventas avanzadas, reintentando con campos básicos:', err.message);
    const { data: basicData, error: basicErr } = await supabase
      .from('ventas')
      .select(`
        id,
        total,
        metodo_pago,
        monto_recibido,
        creado_en,
        perfiles (nombre),
        venta_items (
          id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          productos (nombre)
        )
      `)
      .eq('tienda_id', storeId)
      .order('creado_en', { ascending: false })
      .limit(300);

    if (basicErr) {
      console.error('Error al obtener ventas:', basicErr);
      return [];
    }
    salesData = basicData || [];
  }

  const data = salesData;

  return (data || []).map((v) => {
    return {
      id: v.id,
      total: parseFloat(v.total),
      metodo_pago: v.metodo_pago,
      monto_recibido: v.monto_recibido ? parseFloat(v.monto_recibido) : null,
      pagos_mixtos: v.pagos_mixtos || null,
      estado: v.estado || 'completada',
      motivo_anulacion: v.motivo_anulacion || null,
      anulada_en: v.anulada_en || null,
      serie: v.serie || 'B001',
      correlativo: v.correlativo || null,
      idempotency_key: v.idempotency_key || null,
      creado_en: v.creado_en,
      hora: getPeruTime(v.creado_en),
      fecha: getPeruDateIso(v.creado_en),
      fecha_formato: formatPeruDate(v.creado_en, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      usuario: v.perfiles?.nombre || 'Empleado',
      items: (v.venta_items || []).map((it) => {
        const qty = parseFloat(it.cantidad || 0);
        const unitPrice = parseFloat(it.precio_unitario ?? it.precio ?? 0);
        const sub = parseFloat(it.subtotal ?? (qty * unitPrice) ?? 0);
        return {
          id: it.id,
          producto_id: it.producto_id,
          nombre: it.productos?.nombre || 'Producto',
          cantidad: qty,
          precio: unitPrice,
          subtotal: sub
        };
      })
    };
  });
}

/**
 * Obtener alertas de la tienda
 */
export async function getStoreAlerts(storeId) {
  if (!storeId) return [];

  const { data, error } = await supabase
    .from('alertas')
    .select(`
      id,
      destinatario,
      tipo,
      mensaje,
      referencia,
      creado_en,
      alertas_leidas (leida_en)
    `)
    .eq('tienda_id', storeId)
    .order('creado_en', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error al obtener alertas:', error);
    return [];
  }

  return (data || []).map((a) => ({
    id: a.id,
    tipo: a.tipo,
    mensaje: a.mensaje,
    leida: Boolean(a.alertas_leidas && a.alertas_leidas.length > 0)
  }));
}

/**
 * Marcar alertas como leídas vía RPC
 */
export async function marcarAlertasLeidasRPC(storeId) {
  const { data, error } = await supabase.rpc('marcar_alertas_leidas', {
    p_tienda_id: storeId
  });
  if (error) throw error;
  return data;
}

/**
 * Eliminar alerta por ID
 */
export async function deleteStoreAlert(alertId) {
  if (!alertId) return;
  try {
    const { error } = await supabase.from('alertas').delete().eq('id', alertId);
    if (error) console.warn('Aviso al eliminar alerta en BD:', error.message);
  } catch (err) {
    console.warn('Error al eliminar alerta:', err);
  }
}

/**
 * Obtener empleados de la tienda
 */
export async function getStoreEmployees(storeId) {
  if (!storeId) return [];

  const { data, error } = await supabase
    .from('miembros')
    .select(`
      id,
      rol,
      activo,
      creado_en,
      perfiles (id, nombre, correo)
    `)
    .eq('tienda_id', storeId)
    .eq('rol', 'empleado')
    .order('creado_en');

  if (error) {
    console.error('Error al obtener empleados:', error);
    return [];
  }

  return (data || []).map((m) => ({
    id: m.id,
    nombre: m.perfiles?.nombre || 'Empleado',
    correo: m.perfiles?.correo || '-',
    activo: m.activo
  }));
}

/**
 * Activar o desactivar empleado (permitido por RLS al dueño)
 */
export async function setEmployeeActive(memberId, activo) {
  const { data, error } = await supabase
    .from('miembros')
    .update({ activo })
    .eq('id', memberId);

  if (error) throw error;
  return data;
}

/**
 * Obtener contrato y pagos de la tienda
 */
export async function getStoreContractAndPayments(storeId) {
  if (!storeId) return { contract: null, pagos: [] };

  const { data: contract, error: contractErr } = await supabase
    .from('contratos')
    .select('*')
    .eq('tienda_id', storeId)
    .eq('activo', true)
    .maybeSingle();

  if (contractErr) console.warn('Error al cargar contrato:', contractErr);

  const { data: pagos, error: pagosErr } = await supabase
    .from('pagos')
    .select('*')
    .eq('tienda_id', storeId)
    .order('fecha_pago', { ascending: false })
    .limit(5);

  if (pagosErr) console.warn('Error al cargar pagos:', pagosErr);

  return {
    contract: contract || null,
    pagos: pagos || []
  };
}

/**
 * Guardar logotipo de la tienda en Supabase (actualiza tabla tiendas)
 */
export async function guardarLogoTiendaRPC({ storeId, logoUrl }) {
  if (!storeId) return null;

  // 1. Intentar actualizar columna logo_url
  try {
    const { data, error } = await supabase
      .from('tiendas')
      .update({ logo_url: logoUrl })
      .eq('id', storeId)
      .select();

    if (!error) return data;
    console.warn('Update logo_url avisó:', error.message);
  } catch (err) {
    console.warn('Update logo_url error:', err);
  }

  // 2. Fallback si la columna se llama logo
  try {
    const { data, error } = await supabase
      .from('tiendas')
      .update({ logo: logoUrl })
      .eq('id', storeId)
      .select();

    if (!error) return data;
  } catch (err) {
    console.warn('Update logo fallback error:', err);
  }

  return null;
}

/**
 * Subir archivo de imagen a Supabase Storage o comprimir a DataURL optimizado
 */
export async function uploadStoreLogoToSupabase(storeId, file) {
  if (!file || !storeId) return null;

  // 1. Intentar subir al bucket de almacenamiento en Supabase
  try {
    const fileExt = file.name.split('.').pop().toLowerCase();
    const cleanExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(fileExt) ? fileExt : 'png';
    const filePath = `logos/${storeId}_logo_${Date.now()}.${cleanExt}`;

    const { data, error } = await supabase.storage
      .from('tiendas')
      .upload(filePath, file, { upsert: true });

    if (!error) {
      const { data: publicUrlData } = supabase.storage
        .from('tiendas')
        .getPublicUrl(filePath);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('Supabase storage no disponible para logos, usando DataURL optimizado:', err);
  }

  // 2. Fallback: optimizar y comprimir imagen en base64 con HTML5 Canvas (máx 320px)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
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
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Obtener cálculos y analíticas calculadas directamente en el servidor (PostgreSQL RPC)
 */
export async function getReportesAnaliticasRPC({ storeId, sedeId = null, periodo = 'mes' }) {
  if (!storeId) return null;
  const { data, error } = await supabase.rpc('obtener_metricas_reportes', {
    p_tienda_id: storeId,
    p_sede_id: sedeId,
    p_periodo: periodo
  });
  if (error) {
    console.warn('Aviso al llamar RPC obtener_metricas_reportes:', error);
    return null;
  }
  return data;
}


