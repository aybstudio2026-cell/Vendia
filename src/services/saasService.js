import { supabase } from '../lib/supabase';

// =====================================================================
// SERVICIO SAAS SUPERADMIN: Métricas, Usuarios, Planes, Comunicados y Auditoría
// =====================================================================

const STORAGE_KEYS = {
  PLANES: 'saas_planes_catalog_v2',
  COMUNICADOS: 'saas_comunicados_v1',
  AUDIT_LOGS: 'saas_audit_logs_v1',
  DISMISSED_COMUNICADOS: 'saas_dismissed_comunicados_v1'
};

// -------------------------------------------------------------
// SEED DATA INICIAL ROBUSTA
// -------------------------------------------------------------
const SEED_PLANES = [
  {
    id: 'plan_gratuito',
    codigo: 'gratuito',
    nombre: 'Prueba Gratuita (7 Días)',
    precio: 0.00,
    periodicidad: 1,
    dias_prueba: 7,
    descripcion: 'Prueba completa de 7 días sin costo para nuevos comercios.',
    modulos: ['inventario', 'ventas', 'reportes', 'escaner'],
    badge: 'Prueba Gratis',
    popular: false,
    activo: true
  },
  {
    id: 'plan_basico',
    codigo: 'basico',
    nombre: 'Plan Emprendedor',
    precio: 59.00,
    periodicidad: 1, // mensual
    descripcion: 'Lo esencial para digitalizar una bodega o tienda pequeña.',
    modulos: ['inventario', 'ventas'],
    badge: 'Básico',
    popular: false,
    activo: true
  },
  {
    id: 'plan_pro',
    codigo: 'pro',
    nombre: 'Plan Negocio Pro',
    precio: 89.00,
    periodicidad: 1, // mensual
    descripcion: 'Para comercios activos que necesitan velocidad, CobroFácil Móvil, escáner y analítica.',
    modulos: ['inventario', 'ventas', 'reportes', 'escaner'],
    badge: 'Más Vendido',
    popular: true,
    activo: true
  },
  {
    id: 'plan_full',
    codigo: 'full',
    nombre: 'Plan Full Suite / Multi-Tienda',
    precio: 139.00,
    periodicidad: 1, // mensual
    descripcion: 'Para minimarkets con compras, múltiples sedes y cajeros ilimitados.',
    modulos: ['inventario', 'ventas', 'reportes', 'escaner', 'compras'],
    badge: 'Empresarial',
    popular: false,
    activo: true
  }
];

const SEED_COMUNICADOS = [
  {
    id: 'com_1',
    titulo: '¡Nuevo módulo de Escáner y Pistola de Códigos disponible!',
    mensaje: 'Ya puedes registrar y vender productos con la cámara de tu celular o con una pistola USB/Bluetooth.',
    tipo: 'novedad', // 'novedad' | 'aviso' | 'alerta' | 'urgente'
    activo: true,
    fecha: new Date(Date.now() - 3600000 * 4).toISOString(),
    creado_por: 'Superadmin'
  }
];

const SEED_AUDIT_LOGS = [
  {
    id: 'aud_1',
    tipo: 'modulo', // 'tienda' | 'pago' | 'modulo' | 'usuario' | 'comunicado' | 'seguridad'
    accion: 'Módulo activado',
    detalle: 'Se activó el módulo "Escáner & Código de Barras" para la tienda.',
    tienda: 'Minimarket Don Pepe',
    usuario: 'Superadmin',
    fecha: new Date(Date.now() - 1000 * 60 * 25).toISOString()
  },
  {
    id: 'aud_2',
    tipo: 'pago',
    accion: 'Pago mensual registrado',
    detalle: 'Renovación de suscripción S/. 25.00 por 1 mes (Yape).',
    tienda: 'Bodega San Juan',
    usuario: 'Superadmin',
    fecha: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    id: 'aud_3',
    tipo: 'comunicado',
    accion: 'Comunicado publicado',
    detalle: 'Publicado anuncio global sobre el nuevo módulo de escáner.',
    tienda: 'Todas las tiendas',
    usuario: 'Superadmin',
    fecha: new Date(Date.now() - 1000 * 60 * 240).toISOString()
  },
  {
    id: 'aud_4',
    tipo: 'seguridad',
    accion: 'Inicio de sesión Superadmin',
    detalle: 'Acceso autenticado al panel administrativo global.',
    tienda: 'Sistema',
    usuario: 'Superadmin',
    fecha: new Date(Date.now() - 1000 * 60 * 360).toISOString()
  }
];

// =============================================================
// 1. MÉTRICAS GLOBALES DEL SAAS
// =============================================================
export async function getGlobalSaaSMetrics(stores = [], payments = []) {
  // 1. Total tiendas activas y suspendidas
  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.estado === 'activa');
  const suspendedStores = stores.filter((s) => s.estado === 'suspendida');

  // 2. MRR (Ingreso Mensual Recurrente) en Soles (S/.)
  const mrr = activeStores.reduce((sum, s) => {
    const monthlyRate = (s.monto || 0) / (s.periodicidad_meses || s.per || 1);
    return sum + (isNaN(monthlyRate) ? 0 : monthlyRate);
  }, 0);

  // 3. ARR (Ingreso Anual Proyectado)
  const arr = mrr * 12;

  // 4. ARPU (Ingreso Promedio por Tienda Activa)
  const arpu = activeStores.length > 0 ? mrr / activeStores.length : 0;

  // 5. GMV Global y ventas por mes (Ventas reales procesadas en Supabase)
  let gmv = 0;
  let totalSalesCount = 0;
  const salesByMonth = {};

  try {
    const { data: salesData, error } = await supabase
      .from('ventas')
      .select('total, creado_en');
    if (!error && salesData) {
      gmv = salesData.reduce((acc, row) => acc + (parseFloat(row.total) || 0), 0);
      totalSalesCount = salesData.length;
      salesData.forEach((row) => {
        if (row.creado_en) {
          const key = row.creado_en.slice(0, 7); // 'YYYY-MM'
          salesByMonth[key] = (salesByMonth[key] || 0) + (parseFloat(row.total) || 0);
        }
      });
    }
  } catch (e) {
    console.warn('Aviso consultando ventas en Supabase:', e);
  }

  // 6. Consolidar pagos reales registrados en la plataforma
  const allPayments = [];
  const seenPaymentIds = new Set();
  (payments || []).forEach((p) => {
    if (p && p.monto != null) {
      const pid = p.id || `p_${p.tienda_id}_${p.fecha || p.fecha_pago}_${p.monto}`;
      if (!seenPaymentIds.has(pid)) {
        seenPaymentIds.add(pid);
        allPayments.push(p);
      }
    }
  });
  (stores || []).forEach((s) => {
    (s.pagos || []).forEach((p) => {
      if (p && p.monto != null) {
        const pid = p.id || `st_${s.id}_${p.fecha || p.fecha_pago}_${p.monto}`;
        if (!seenPaymentIds.has(pid)) {
          seenPaymentIds.add(pid);
          allPayments.push(p);
        }
      }
    });
  });

  const totalPaymentsCollected = allPayments.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
  const totalPaymentsCount = allPayments.length;

  // 7. Adopción de Módulos
  const moduleCounts = {
    inventario: 0,
    ventas: 0,
    reportes: 0,
    escaner: 0,
    compras: 0
  };

  stores.forEach((s) => {
    const mods = s.modulos || [];
    mods.forEach((m) => {
      if (moduleCounts[m] !== undefined) {
        moduleCounts[m]++;
      }
    });
  });

  const moduleAdoption = Object.entries(moduleCounts).map(([key, count]) => {
    const names = {
      inventario: 'Inventario',
      ventas: 'Ventas & Caja',
      reportes: 'Reportes y Analíticas',
      escaner: 'Escáner & Código de Barras',
      compras: 'Compras y Proveedores'
    };
    const pct = totalStores > 0 ? Math.round((count / totalStores) * 100) : 0;
    return {
      key,
      name: names[key] || key,
      count,
      pct
    };
  });

  // 8. Churn Rate y Pérdida por Churn
  const churnedStoresCount = suspendedStores.length;
  const churnRate = totalStores > 0 ? parseFloat(((churnedStoresCount / totalStores) * 100).toFixed(1)) : 0;
  const churnedMrr = suspendedStores.reduce((sum, s) => {
    const monthlyRate = (s.monto || 0) / (s.periodicidad_meses || s.per || 1);
    return sum + (isNaN(monthlyRate) ? 0 : monthlyRate);
  }, 0);
  const retentionRate = totalStores > 0 ? parseFloat((100 - churnRate).toFixed(1)) : 100;

  return {
    totalStores,
    activeStoresCount: activeStores.length,
    suspendedStoresCount: suspendedStores.length,
    churnedStoresCount,
    churnRate,
    churnedMrr,
    retentionRate,
    mrr,
    arr,
    arpu,
    gmv,
    totalSalesCount,
    salesByMonth,
    totalPaymentsCollected,
    totalPaymentsCount,
    moduleAdoption
  };
}

// =============================================================
// 2. GESTIÓN CENTRALIZADA DE USUARIOS
// =============================================================
export async function getSaaSUsers() {
  try {
    // Obtener perfiles
    const { data: perfiles, error: perfErr } = await supabase
      .from('perfiles')
      .select('id, nombre, correo, es_superadmin, creado_en')
      .order('creado_en', { ascending: false });

    if (perfErr) throw perfErr;

    // Obtener miembros para cruzar con tiendas
    const { data: miembros, error: miembErr } = await supabase
      .from('miembros')
      .select(`
        id,
        usuario_id,
        tienda_id,
        rol,
        activo,
        tiendas (id, nombre, estado)
      `);

    if (miembErr) throw miembErr;

    const miembrosByUser = {};
    (miembros || []).forEach((m) => {
      if (!miembrosByUser[m.usuario_id]) {
        miembrosByUser[m.usuario_id] = [];
      }
      miembrosByUser[m.usuario_id].push(m);
    });

    return (perfiles || []).map((p) => {
      const userMiembros = miembrosByUser[p.id] || [];
      const primaryMembership = userMiembros[0] || null;

      return {
        id: p.id,
        nombre: p.nombre || 'Usuario',
        correo: p.correo,
        es_superadmin: Boolean(p.es_superadmin),
        rol: p.es_superadmin ? 'superadmin' : (primaryMembership?.rol || 'sin_asignar'),
        activo: primaryMembership ? primaryMembership.activo : true,
        tiendaNombre: primaryMembership?.tiendas?.nombre || (p.es_superadmin ? 'Administración Global' : 'Sin tienda'),
        tiendaId: primaryMembership?.tiendas?.id || null,
        memberId: primaryMembership?.id || null,
        creado_en: p.creado_en
      };
    });
  } catch (err) {
    console.warn('Fallback cargando usuarios SaaS:', err);
    // Fallback local
    return [
      {
        id: 'usr_super',
        nombre: 'Administrador General',
        correo: 'admin@sistema.com',
        es_superadmin: true,
        rol: 'superadmin',
        activo: true,
        tiendaNombre: 'Administración Global',
        tiendaId: null,
        creado_en: new Date().toISOString()
      }
    ];
  }
}

export async function updateSaaSUserStatus(userId, memberId, nuevoActivo) {
  if (memberId) {
    const { error } = await supabase
      .from('miembros')
      .update({ activo: nuevoActivo })
      .eq('id', memberId);
    if (error) throw error;
  }
  return true;
}

// =============================================================
// 4. COMUNICADOS GLOBALES (BROADCAST) - Tabla real saas_comunicados
// =============================================================
export async function fetchSaaSComunicados() {
  try {
    const { data, error } = await supabase
      .from('saas_comunicados')
      .select('*')
      .order('fecha', { ascending: false });

    if (!error && data && data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.COMUNICADOS, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.warn('Aviso al consultar saas_comunicados en Supabase, usando caché local:', e);
  }
  return getSaaSComunicados();
}

export function getSaaSComunicados() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMUNICADOS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(STORAGE_KEYS.COMUNICADOS, JSON.stringify(SEED_COMUNICADOS));
  return SEED_COMUNICADOS;
}

export async function saveSaaSComunicado(comunicado) {
  const current = getSaaSComunicados();
  let updated;
  let targetCom;

  if (comunicado.id) {
    targetCom = { ...comunicado };
    updated = current.map((c) => (c.id === comunicado.id ? { ...c, ...comunicado } : c));
  } else {
    targetCom = {
      ...comunicado,
      id: 'com_' + Date.now(),
      fecha: new Date().toISOString(),
      creado_por: 'Superadmin'
    };
    updated = [targetCom, ...current];
  }
  localStorage.setItem(STORAGE_KEYS.COMUNICADOS, JSON.stringify(updated));

  // Si se crea o actualiza, remover de descartados para que vuelva a ser visible
  undismissStoreComunicado(targetCom.id);

  // Intentar persistir en Supabase
  try {
    await supabase.from('saas_comunicados').upsert(targetCom);
  } catch (err) {
    console.warn('Aviso al guardar saas_comunicado en Supabase:', err);
  }

  return updated;
}

export async function deleteSaaSComunicado(id) {
  const current = getSaaSComunicados();
  const updated = current.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.COMUNICADOS, JSON.stringify(updated));

  undismissStoreComunicado(id);

  try {
    await supabase.from('saas_comunicados').delete().eq('id', id);
  } catch (err) {
    console.warn('Aviso al borrar saas_comunicado en Supabase:', err);
  }

  return updated;
}

export function getActiveStoreComunicado() {
  const all = getSaaSComunicados();
  if (!Array.isArray(all)) return null;

  let dismissed = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISMISSED_COMUNICADOS);
    if (raw) dismissed = JSON.parse(raw);
    if (!Array.isArray(dismissed)) dismissed = [];
  } catch (e) {
    dismissed = [];
  }

  // Retornar el primer comunicado activo que NO haya sido cerrado por el usuario
  return all.find((c) => c && c.activo && !dismissed.includes(c.id)) || null;
}

export function dismissStoreComunicado(id) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISMISSED_COMUNICADOS);
    let dismissed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(dismissed)) dismissed = [];
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem(STORAGE_KEYS.DISMISSED_COMUNICADOS, JSON.stringify(dismissed));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {}
}

export function undismissStoreComunicado(id) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISMISSED_COMUNICADOS);
    if (!raw) return;
    let dismissed = JSON.parse(raw);
    if (Array.isArray(dismissed) && dismissed.includes(id)) {
      dismissed = dismissed.filter((d) => d !== id);
      localStorage.setItem(STORAGE_KEYS.DISMISSED_COMUNICADOS, JSON.stringify(dismissed));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {}
}

export function resetDismissedComunicados() {
  try {
    localStorage.removeItem(STORAGE_KEYS.DISMISSED_COMUNICADOS);
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
}

// =============================================================
// 5. GESTIÓN DE PLANES Y TARIFAS - Tabla real saas_planes
// =============================================================
export async function fetchSaaSPlanes() {
  try {
    const { data, error } = await supabase
      .from('saas_planes')
      .select('*')
      .order('precio', { ascending: true });

    if (!error && data && data.length > 0) {
      // Garantizar que el plan gratuito esté siempre incluido si la base de datos aún no lo tiene
      const hasFree = data.some((p) => p.codigo === 'gratuito' || p.id === 'plan_gratuito' || parseFloat(p.precio) === 0);
      let mergedData = data;
      if (!hasFree) {
        mergedData = [SEED_PLANES[0], ...data];
        // Sincronizarlo e insertarlo en Supabase en segundo plano con la sesión autenticada de superadmin
        try {
          supabase.from('saas_planes').upsert({
            id: SEED_PLANES[0].id,
            codigo: SEED_PLANES[0].codigo,
            nombre: SEED_PLANES[0].nombre,
            precio: SEED_PLANES[0].precio,
            periodicidad: SEED_PLANES[0].periodicidad,
            descripcion: SEED_PLANES[0].descripcion,
            modulos: SEED_PLANES[0].modulos,
            badge: SEED_PLANES[0].badge,
            popular: SEED_PLANES[0].popular,
            activo: SEED_PLANES[0].activo
          }).then(({ error: upsertErr }) => {
            if (upsertErr) console.warn('Aviso sincronizando plan gratuito a saas_planes:', upsertErr);
          });
        } catch (e) {}
      }
      localStorage.setItem(STORAGE_KEYS.PLANES, JSON.stringify(mergedData));
      return mergedData;
    }
  } catch (e) {
    console.warn('Aviso al consultar saas_planes en Supabase, usando caché local:', e);
  }
  return getSaaSPlanes();
}

export function getSaaSPlanes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLANES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Garantizar que plan_gratuito siempre esté disponible
        const hasFree = parsed.some((p) => p.codigo === 'gratuito' || p.id === 'plan_gratuito');
        if (!hasFree) {
          const updated = [SEED_PLANES[0], ...parsed];
          localStorage.setItem(STORAGE_KEYS.PLANES, JSON.stringify(updated));
          return updated;
        }
        return parsed;
      }
    }
  } catch (e) {}
  localStorage.setItem(STORAGE_KEYS.PLANES, JSON.stringify(SEED_PLANES));
  return SEED_PLANES;
}

export async function saveSaaSPlan(plan) {
  const current = getSaaSPlanes();
  let updated;
  let targetPlan;

  if (plan.id) {
    targetPlan = { ...plan };
    updated = current.map((p) => (p.id === plan.id ? { ...p, ...plan } : p));
  } else {
    targetPlan = {
      ...plan,
      id: 'plan_' + Date.now(),
      activo: true
    };
    updated = [...current, targetPlan];
  }
  localStorage.setItem(STORAGE_KEYS.PLANES, JSON.stringify(updated));

  try {
    await supabase.from('saas_planes').upsert(targetPlan);
  } catch (err) {
    console.warn('Aviso al guardar saas_plan en Supabase:', err);
  }

  return updated;
}

export async function deleteSaaSPlan(id) {
  const current = getSaaSPlanes();
  const updated = current.filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.PLANES, JSON.stringify(updated));

  try {
    await supabase.from('saas_planes').delete().eq('id', id);
  } catch (err) {
    console.warn('Aviso al borrar saas_plan en Supabase:', err);
  }

  return updated;
}

/**
 * Resolver el plan SaaS oficial de una tienda según su código, id, nombre, tarifa mensual o módulos activos
 */
export function resolveStorePlan(planCodeOrName, price = null, modules = []) {
  const planes = getSaaSPlanes();
  const numPrice = price != null ? parseFloat(price) : null;
  const raw = (planCodeOrName || '').toString().toLowerCase().trim();

  // 1. PRIORIDAD MÁXIMA: Coincidencia por código o ID exacto (ej: 'gratuito', 'pro', 'basico', 'full')
  if (raw && raw !== 'personalizado') {
    // Coincidencia para Plan Gratuito / Prueba Gratis de 7 días
    if (
      raw.includes('gratuito') ||
      raw.includes('gratis') ||
      raw.includes('prueba') ||
      raw === 'trial' ||
      raw === 'free'
    ) {
      const freePlan = planes.find((p) => p.codigo === 'gratuito' || p.id === 'plan_gratuito');
      if (freePlan) return freePlan;
    }

    const byCodeOrId = planes.find(
      (p) =>
        (p.codigo && p.codigo.toLowerCase() === raw) ||
        (p.id && p.id.toLowerCase() === raw) ||
        (p.nombre && p.nombre.toLowerCase() === raw)
    );
    if (byCodeOrId) return byCodeOrId;

    // Substrings de palabras clave
    if (raw.includes('full') || raw.includes('suite') || raw.includes('empresarial') || raw.includes('multi')) {
      const full = planes.find((p) => p.codigo === 'full' || p.id.includes('full'));
      if (full) return full;
    }
    if (raw.includes('pro') || raw.includes('negocio')) {
      const pro = planes.find((p) => p.codigo === 'pro' || p.id.includes('pro'));
      if (pro) return pro;
    }
    if (raw.includes('basico') || raw.includes('básico') || raw.includes('emprendedor')) {
      const basico = planes.find((p) => p.codigo === 'basico' || p.id.includes('basico'));
      if (basico) return basico;
    }
  }

  // 2. Coincidencia por tarifa mensual
  if (numPrice != null && !isNaN(numPrice)) {
    if (numPrice === 0 || numPrice === 0.0) {
      const freePlan = planes.find((p) => p.codigo === 'gratuito' || p.precio === 0);
      if (freePlan) return freePlan;
    }
    const byPrice = planes.find((p) => Math.abs(parseFloat(p.precio) - numPrice) < 1.0);
    if (byPrice) return byPrice;
  }

  // 3. Deducir según módulos activos si no hubo coincidencia por código/precio
  if (Array.isArray(modules) && (modules.length >= 5 || (modules.includes('compras') && modules.includes('escaner')))) {
    const full = planes.find((p) => p.codigo === 'full');
    if (full) return full;
  }

  if (Array.isArray(modules) && modules.length >= 3) {
    const pro = planes.find((p) => p.codigo === 'pro');
    if (pro) return pro;
  }

  // Fallback seguro usando el primer plan o estructura estándar
  return planes[0] || {
    id: 'plan_basico',
    codigo: 'basico',
    nombre: 'Plan Emprendedor',
    precio: numPrice || 59.00,
    badge: 'Básico',
    modulos: ['inventario', 'ventas']
  };
}

/**
 * Calcular el historial de tendencias del SaaS para los últimos 6 meses (MRR, Tiendas, GMV, Planes)
 * Conectado 100% a datos reales de Supabase (stores, pagos registrados y ventas).
 */
export function getSaaSTrendHistory(stores = [], payments = [], salesByMonth = {}) {
  const months = [];
  const now = new Date();

  // Consolidar todos los pagos reales (desde array payments y store.pagos)
  const allPayments = [];
  const seenPaymentIds = new Set();

  (payments || []).forEach((p) => {
    if (p && (p.monto != null)) {
      const pid = p.id || `p_${p.tienda_id}_${p.fecha || p.fecha_pago}_${p.monto}`;
      if (!seenPaymentIds.has(pid)) {
        seenPaymentIds.add(pid);
        allPayments.push({
          id: p.id,
          tienda_id: p.tienda_id,
          monto: parseFloat(p.monto) || 0,
          fecha: p.fecha || p.fecha_pago || p.creado_en
        });
      }
    }
  });

  (stores || []).forEach((s) => {
    (s.pagos || []).forEach((p) => {
      if (p && (p.monto != null)) {
        const pid = p.id || `st_${s.id}_${p.fecha || p.fecha_pago}_${p.monto}`;
        if (!seenPaymentIds.has(pid)) {
          seenPaymentIds.add(pid);
          allPayments.push({
            id: p.id,
            tienda_id: s.id,
            monto: parseFloat(p.monto) || 0,
            fecha: p.fecha_pago || p.fecha || p.creado_en
          });
        }
      }
    });
  });

  // Generar últimos 6 meses cronológicos (ej: May, Jun, Jul, Ago, Set, Oct)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = d.toLocaleString('es-PE', { month: 'short' });
    const fullMonth = d.toLocaleString('es-PE', { month: 'long', year: 'numeric' });
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${yyyy}-${mm}`;
    const startOfMonth = new Date(yyyy, d.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(yyyy, d.getMonth() + 1, 0, 23, 59, 59, 999);

    months.push({
      index: 5 - i,
      month: monthKey.charAt(0).toUpperCase() + monthKey.slice(1).replace('.', ''),
      fullName: fullMonth.charAt(0).toUpperCase() + fullMonth.slice(1),
      year: yyyy,
      monthNum: d.getMonth(),
      yearMonth,
      startOfMonth,
      endOfMonth
    });
  }

  // MRR y tiendas activas actuales
  const activeStores = stores.filter((s) => s.estado === 'activa');
  const baseMrr = activeStores.reduce(
    (sum, s) => sum + ((s.monto || 0) / (s.periodicidad_meses || s.per || 1)),
    0
  );
  const currentMrr = baseMrr;
  const currentStoresCount = activeStores.length;

  // Historial mensual real basado en fechas de creación y pagos en Supabase
  const mrrTrend = months.map((m, idx) => {
    const isCurrentMonth = idx === months.length - 1;

    // 1. Pagos reales cobrados en este mes
    const monthPayments = allPayments.filter((p) => {
      if (!p.fecha) return false;
      const pDate = new Date(p.fecha);
      if (isNaN(pDate.getTime())) return false;
      return pDate >= m.startOfMonth && pDate <= m.endOfMonth;
    });
    const collected = monthPayments.reduce((acc, p) => acc + p.monto, 0);

    // 2. Tiendas activas en este mes (según fecha de creación o inicio)
    const monthStores = stores.filter((s) => {
      const rawDate = s.creado_en || s.fecha_inicio || s.inicio;
      if (!rawDate) return isCurrentMonth;
      const createdDate = new Date(rawDate);
      if (isNaN(createdDate.getTime())) return isCurrentMonth;
      return createdDate <= m.endOfMonth;
    });

    const activeInMonth = monthStores.filter((s) => s.estado === 'activa');
    const storeCount = isCurrentMonth ? currentStoresCount : activeInMonth.length;

    // 3. MRR real en este mes
    let mrrVal = 0;
    if (isCurrentMonth) {
      mrrVal = currentMrr;
    } else {
      const contractedInMonth = activeInMonth.reduce(
        (sum, s) => sum + ((s.monto || 0) / (s.periodicidad_meses || s.per || 1)),
        0
      );
      // Tomar la tarifa mensual contratada o pagos cobrados si fueron mayores
      mrrVal = Math.max(contractedInMonth, collected);
    }

    // 4. GMV real de ventas de ese mes (de Supabase ventas)
    const gmvVal = salesByMonth && salesByMonth[m.yearMonth] !== undefined
      ? Math.round(salesByMonth[m.yearMonth])
      : 0;

    return {
      ...m,
      mrr: Math.round(mrrVal),
      realMrr: mrrVal,
      stores: storeCount,
      collected: Math.round(collected),
      gmv: gmvVal
    };
  });

  // Calcular crecimiento MoM real
  for (let idx = 0; idx < mrrTrend.length; idx++) {
    const item = mrrTrend[idx];
    if (idx === 0) {
      item.growthPct = 0;
    } else {
      const prev = mrrTrend[idx - 1];
      if (prev.mrr > 0) {
        item.growthPct = parseFloat((((item.mrr - prev.mrr) / prev.mrr) * 100).toFixed(1));
      } else if (item.mrr > 0) {
        item.growthPct = 100;
      } else {
        item.growthPct = 0;
      }
    }
  }

  // Crecimiento de los últimos 90 días (mes actual vs hace 3 meses)
  const mrrNow = mrrTrend[5]?.mrr || 0;
  const mrr90d = mrrTrend[2]?.mrr || 0;
  let growthLast90Days = 0;
  if (mrr90d > 0) {
    growthLast90Days = Math.round(((mrrNow - mrr90d) / mrr90d) * 100);
  } else if (mrrNow > 0) {
    growthLast90Days = 100;
  }

  // Distribución real por Planes SaaS
  const planesCatalog = getSaaSPlanes();
  const planDistribution = planesCatalog.map((p) => {
    const subscribedStores = stores.filter((s) => {
      const resolved = resolveStorePlan(s.plan, s.monto, s.modulos);
      return resolved.id === p.id || resolved.codigo === p.codigo;
    });

    const activeForPlan = subscribedStores.filter((s) => s.estado === 'activa');
    const suspendedForPlan = subscribedStores.filter((s) => s.estado === 'suspendida');
    const count = subscribedStores.length;
    const activeCount = activeForPlan.length;

    // Ingreso recurrente activo real para este plan (MRR)
    const activeRevenue = activeForPlan.reduce(
      (sum, s) => sum + ((parseFloat(s.monto) || p.precio) / (s.periodicidad_meses || s.per || 1)),
      0
    );

    const pct = stores.length > 0 ? Math.round((count / stores.length) * 100) : 0;
    const mrrPct = currentMrr > 0 ? Math.round((activeRevenue / currentMrr) * 100) : 0;

    return {
      id: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      badge: p.badge,
      precio: p.precio,
      popular: p.popular,
      modulos: p.modulos || [],
      count,
      activeCount,
      suspendedCount: suspendedForPlan.length,
      pct,
      mrrPct,
      revenue: Math.round(activeRevenue * 100) / 100
    };
  });

  return {
    mrrTrend,
    planDistribution,
    currentMrr,
    growthLast90Days
  };
}


// =============================================================
// 6. HISTORIAL DE AUDITORÍA (AUDIT LOGS) - Tabla real saas_auditoria
// =============================================================
export async function fetchSaaSAuditLogs() {
  try {
    const { data, error } = await supabase
      .from('saas_auditoria')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.warn('Aviso al consultar saas_auditoria en Supabase, usando caché local:', e);
  }
  return getSaaSAuditLogs();
}

export function getSaaSAuditLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(SEED_AUDIT_LOGS));
  return SEED_AUDIT_LOGS;
}

export function logSaaSAuditEvent({ tipo = 'tienda', accion, detalle, tienda = 'Sistema', usuario = 'Superadmin', metadata = {} }) {
  const current = getSaaSAuditLogs();
  const newEvent = {
    id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    tipo,
    accion,
    detalle,
    tienda,
    usuario,
    fecha: new Date().toISOString(),
    metadata
  };
  const updated = [newEvent, ...current.slice(0, 99)]; // Mantener últimos 100
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));

  // Persistir en tabla saas_auditoria de solo inserción (inmutable)
  try {
    supabase
      .from('saas_auditoria')
      .insert({
        id: newEvent.id,
        tipo: newEvent.tipo,
        accion: newEvent.accion,
        detalle: newEvent.detalle,
        tienda: newEvent.tienda,
        usuario: newEvent.usuario,
        fecha: newEvent.fecha,
        metadata: newEvent.metadata
      })
      .then(({ error }) => {
        if (error) console.warn('Aviso al insertar en saas_auditoria:', error.message);
      });
  } catch (err) {
    console.warn('Error al enviar evento de auditoría:', err);
  }

  return updated;
}
