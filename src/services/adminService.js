import { supabase } from '../lib/supabase';
import { getPeruDateIso } from '../utils/dateUtils';

// =====================================================================
// SERVICIO DE ADMINISTRACIÓN (SUPERADMIN)
// Mapea directamente a v_panel_tiendas y las funciones RPC del esquema SQL v2
// =====================================================================

/**
 * Obtener la lista de todas las tiendas desde la vista v_panel_tiendas
 */
export async function getAdminStores() {
  const { data, error } = await supabase
    .from('v_panel_tiendas')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Cargar pagos de cada tienda para el modal de detalle
  const storeIds = data.map((s) => s.id);
  const { data: pagosData } = await supabase
    .from('pagos')
    .select('*')
    .in('tienda_id', storeIds)
    .order('fecha_pago', { ascending: false });

  const pagosByStore = {};
  (pagosData || []).forEach((p) => {
    if (!pagosByStore[p.tienda_id]) pagosByStore[p.tienda_id] = [];
    pagosByStore[p.tienda_id].push({
      id: p.id,
      monto: parseFloat(p.monto),
      fecha: p.fecha_pago,
      metodo: p.metodo,
      nota: p.nota,
      comprobante_url: p.comprobante_url || localStorage.getItem('vendia_voucher_' + p.id) || null
    });
  });

  return data.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    logo_url: s.logo_url || null,
    estado: s.estado,
    creado_en: s.creado_en,
    dueno: s.dueno || 'Sin asignar',
    dueno_correo: s.dueno_correo || '-',
    dueno_telefono: s.dueno_telefono || s.telefono || (s.dueno_correo ? localStorage.getItem('user_phone_' + s.dueno_correo.toLowerCase()) : null) || localStorage.getItem('vendia_user_phone') || null,
    telefono: s.telefono || s.dueno_telefono || (s.dueno_correo ? localStorage.getItem('user_phone_' + s.dueno_correo.toLowerCase()) : null) || null,
    contrato_id: s.contrato_id,
    plan: s.plan,
    monto: parseFloat(s.monto || 0),
    moneda: s.moneda || 'PEN',
    periodicidad_meses: s.periodicidad_meses || 1,
    fecha_inicio: s.fecha_inicio,
    proximo_pago: s.proximo_pago,
    dias_para_pago: s.dias_para_pago,
    estado_pago: s.estado_pago,
    modulos: s.modulos || [],
    pagos: pagosByStore[s.id] || []
  }));
}

/**
 * Obtener todos los pagos de la plataforma
 */
export async function getAdminPayments() {
  const { data, error } = await supabase
    .from('pagos')
    .select(`
      id,
      monto,
      fecha_pago,
      periodo_hasta,
      metodo,
      nota,
      comprobante_url,
      tiendas (id, nombre)
    `)
    .order('fecha_pago', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error al obtener pagos admin:', error);
    return [];
  }

  return (data || []).map((p) => ({
    id: p.id,
    monto: parseFloat(p.monto),
    fecha: p.fecha_pago,
    tienda: p.tiendas?.nombre || 'Tienda',
    tienda_id: p.tiendas?.id,
    metodo: p.metodo,
    nota: p.nota,
    comprobante_url: p.comprobante_url || localStorage.getItem('vendia_voucher_' + p.id) || null
  }));
}

/**
 * Obtener todos los perfiles de usuarios registrados para asignar dueños
 */
export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, correo, es_superadmin')
    .order('nombre');

  if (error) {
    console.error('Error al obtener perfiles:', error);
    return [];
  }
  return (data || []).map((p) => ({
    ...p,
    telefono: (p.correo ? localStorage.getItem('user_phone_' + p.correo.toLowerCase()) : null) || null
  }));
}

/**
 * Crear tienda vía RPC: crear_tienda(...)
 * Crea la tienda, su sede principal, contrato, primer pago y módulos.
 * Si se especifica el correo del dueño y ya existe en perfiles, lo vincula automáticamente como 'dueno' en miembros.
 */
export async function createStoreRPC({
  nombre,
  monto,
  periodicidad_meses,
  fecha_inicio,
  modulos = ['inventario', 'ventas'],
  plan = 'basico',
  duenoNombre = null,
  duenoEmail = null
}) {
  const payload = {
    p_nombre: nombre.trim(),
    p_monto: parseFloat(monto),
    p_periodicidad_meses: parseInt(periodicidad_meses, 10),
    p_inicio: fecha_inicio,
    p_modulos: modulos,
    p_plan: plan
  };

  // 1. Invocar RPC crear_tienda
  const { data: tiendaId, error: rpcError } = await supabase.rpc('crear_tienda', payload);
  if (rpcError) throw rpcError;

  // Ajuste especial para Plan Gratuito (Prueba de 7 días sin costo)
  if (plan === 'gratuito' || parseFloat(monto) === 0) {
    try {
      const trialDate = new Date(fecha_inicio || new Date());
      trialDate.setDate(trialDate.getDate() + 7);
      const proximoTrial = getPeruDateIso(trialDate);
      await supabase
        .from('contratos')
        .update({
          plan: 'gratuito',
          monto: 0.00,
          proximo_pago: proximoTrial
        })
        .eq('tienda_id', tiendaId);
    } catch (trialErr) {
      console.warn('Aviso al ajustar periodo de 7 días de prueba gratuita:', trialErr);
    }
  }

  // 2. Si se proporcionó correo del dueño, buscar si ya está registrado en perfiles
  let ownerLinked = false;
  if (duenoEmail) {
    const cleanEmail = duenoEmail.trim().toLowerCase();
    const { data: userProfile } = await supabase
      .from('perfiles')
      .select('id, nombre, correo')
      .ilike('correo', cleanEmail)
      .maybeSingle();

    if (userProfile) {
      // Vincular directamente como dueño en miembros
      const { error: miembroErr } = await supabase
        .from('miembros')
        .insert({
          tienda_id: tiendaId,
          usuario_id: userProfile.id,
          rol: 'dueno',
          activo: true
        });

      if (!miembroErr) {
        ownerLinked = true;
      } else {
        console.warn('No se pudo vincular automáticamente el dueño:', miembroErr);
      }
    }
  }

  return {
    tiendaId,
    ownerLinked
  };
}

/**
 * Registrar pago manual vía RPC: registrar_pago(...)
 * Extiende la fecha del contrato según su periodicidad y reactiva la tienda si estaba suspendida.
 */
export async function registerPaymentRPC({ contratoId, monto, metodo = null, nota = null, comprobanteUrl = null }) {
  // 1. Invocar procedimiento oficial en Supabase
  const { data: nuevoVencimiento, error } = await supabase.rpc('registrar_pago', {
    p_contrato_id: contratoId,
    p_monto: parseFloat(monto),
    p_metodo: metodo,
    p_nota: nota
  });
  if (error) throw error;

  // 2. Si hay comprobante adjunto, asociarlo al pago registrado en la tabla pagos
  if (comprobanteUrl) {
    try {
      const { data: recentPayments } = await supabase
        .from('pagos')
        .select('id, comprobante_url')
        .eq('contrato_id', contratoId)
        .order('fecha_pago', { ascending: false })
        .limit(5);

      if (recentPayments && recentPayments.length > 0) {
        const targetPayment = recentPayments.find((p) => !p.comprobante_url) || recentPayments[0];
        const paymentId = targetPayment.id;
        await supabase
          .from('pagos')
          .update({ comprobante_url: comprobanteUrl })
          .eq('id', paymentId);

        try {
          localStorage.setItem('vendia_voucher_' + paymentId, comprobanteUrl);
        } catch (_) {}
      }
    } catch (attachErr) {
      console.warn('Aviso asociando comprobante a pago:', attachErr);
    }
  }

  return nuevoVencimiento;
}

/**
 * Suspender o reactivar tienda manualmente
 */
export async function updateStoreStatus(storeId, nuevoEstado) {
  // nuevoEstado: 'activa' | 'suspendida'
  const { data, error } = await supabase
    .from('tiendas')
    .update({ estado: nuevoEstado })
    .eq('id', storeId);

  if (error) throw error;
  return data;
}

/**
 * Activar o desactivar módulo para una tienda
 */
export async function toggleStoreModule(storeId, moduloCodigo, activo) {
  if (activo) {
    const { data, error } = await supabase
      .from('tienda_modulos')
      .upsert({
        tienda_id: storeId,
        modulo_codigo: moduloCodigo,
        activo: true
      });
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('tienda_modulos')
      .delete()
      .eq('tienda_id', storeId)
      .eq('modulo_codigo', moduloCodigo);
    if (error) throw error;
    return data;
  }
}

/**
 * Asignar un dueño a una tienda usando su ID de perfil o correo
 */
export async function assignStoreOwner(storeId, usuarioId) {
  // 1. Desactivar dueños anteriores si hubiese
  await supabase
    .from('miembros')
    .delete()
    .eq('tienda_id', storeId)
    .eq('rol', 'dueno');

  // 2. Insertar nuevo dueño
  const { data, error } = await supabase
    .from('miembros')
    .insert({
      tienda_id: storeId,
      usuario_id: usuarioId,
      rol: 'dueno',
      activo: true
    });

  if (error) throw error;
  return data;
}

/**
 * Actualizar los métodos de pago habilitados para una tienda
 */
export async function updateStorePaymentMethods(storeId, metodosPago) {
  // 1. Guardar en localStorage para disponibilidad inmediata y offline/demo
  try {
    localStorage.setItem(`tienda_${storeId}_metodos_pago`, JSON.stringify(metodosPago));
  } catch (e) {}

  // 2. Intentar actualizar en Supabase en la tabla tiendas
  try {
    const { data, error } = await supabase
      .from('tiendas')
      .update({ metodos_pago: metodosPago })
      .eq('id', storeId)
      .select();

    if (error) {
      console.warn('Aviso al guardar metodos_pago en Supabase:', error.message);
    }
    return data;
  } catch (err) {
    console.warn('Excepción al guardar metodos_pago en Supabase:', err);
    return null;
  }
}

/**
 * Actualizar el plan SaaS asignado a una tienda y su contrato
 */
export async function updateStorePlan(storeId, planCode, monto = null, modulos = null) {
  try {
    const updateContrato = { plan: planCode };
    if (monto != null) updateContrato.monto = parseFloat(monto);
    
    // 1. Actualizar contrato en Supabase por tienda_id
    const { error: errContrato } = await supabase
      .from('contratos')
      .update(updateContrato)
      .eq('tienda_id', storeId);

    if (errContrato) {
      console.warn('Aviso al actualizar contrato:', errContrato);
    }

    // 3. Sincronizar módulos en tienda_modulos si se especificaron
    if (modulos && Array.isArray(modulos)) {
      for (const mod of modulos) {
        try {
          await supabase.from('tienda_modulos').upsert({
            tienda_id: storeId,
            modulo_codigo: mod,
            activo: true
          });
        } catch {}
      }
    }

    // Guardar en caché local para persistencia inmediata
    try {
      localStorage.setItem(`tienda_${storeId}_plan`, planCode);
      if (monto != null) localStorage.setItem(`tienda_${storeId}_monto`, String(monto));
    } catch {}
  } catch (err) {
    console.warn('Aviso al actualizar plan de la tienda en Supabase:', err);
  }
  return true;
}

