import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import TopBanner from './components/common/TopBanner';
import Toast from './components/common/Toast';
import PaletteModal from './components/common/PaletteModal';
import GlobalSearchModal from './components/common/GlobalSearchModal';
import Skeleton from './components/common/Skeleton';
import Login from './components/auth/Login';
import LoginSplashScreen from './components/common/LoginSplashScreen';
import VendiaLogo from './components/common/VendiaLogo';
import { IconWhatsApp } from './components/common/Icons';
import { inviteUser } from './services/inviteService';

// Tienda (Cliente)
import ResumenTab from './components/store/ResumenTab';
import VenderTab from './components/store/VenderTab';
import InventarioTab from './components/store/InventarioTab';
import VentasTab from './components/store/VentasTab';
import NegocioTab from './components/store/NegocioTab';
import ReportesTab from './components/store/ReportesTab';
import AlertasModal from './components/store/AlertasModal';
import TicketModal from './components/store/TicketModal';

// Superadmin
import MetricasTab from './components/admin/MetricasTab';
import TiendasTab from './components/admin/TiendasTab';
import PagosTab from './components/admin/PagosTab';
import UsuariosTab from './components/admin/UsuariosTab';
import PlanesTab from './components/admin/PlanesTab';
import ComunicadosTab from './components/admin/ComunicadosTab';
import AuditoriaTab from './components/admin/AuditoriaTab';
import DetalleTiendaModal from './components/admin/DetalleTiendaModal';
import NuevaTiendaModal from './components/admin/NuevaTiendaModal';
import BroadcastBanner from './components/common/BroadcastBanner';
import NetworkStatusIndicator from './components/common/NetworkStatusIndicator';
import OnboardingChecklist from './components/store/OnboardingChecklist';
import { logSaaSAuditEvent, resolveStorePlan } from './services/saasService';
import { exportStoreCompleteData } from './services/exportService';

import { diffDays, fd, money, DEFAULT_PAYMENT_METHODS } from './constants/palettes';
import { getPeruDateIso, formatPeruDate, getPeruTime } from './utils/dateUtils';
import { getStoreLogoStorage, setStoreLogoStorage } from './constants/categories';
import { validateSaleCheckout, validateProductInput, validateStoreInput } from './utils/security';
import {
  getStoreProducts,
  getStoreInventoryMovements,
  registrarVentaRPC,
  anularVentaRPC,
  crearProductoRPC,
  editarProductoRPC,
  guardarPaletaRPC,
  getResumenTiendaRPC,
  getStoreSalesToday,
  getStoreAlerts,
  marcarAlertasLeidasRPC,
  deleteStoreAlert,
  getStoreEmployees,
  setEmployeeActive,
  getStoreContractAndPayments,
  guardarLogoTiendaRPC
} from './services/storeService';



import {
  getAdminStores,
  getAdminPayments,
  getAllProfiles,
  createStoreRPC,
  registerPaymentRPC,
  updateStoreStatus,
  toggleStoreModule,
  assignStoreOwner,
  updateStorePaymentMethods,
  updateStorePlan
} from './services/adminService';

// Datos semilla de productos para la tienda (modo demo / fallback) con códigos de barras EAN-13 Perú
const SEED_PRODUCTS = [
  { id: 1, codigo_barras: "7750243003022", nombre: "Arroz 1 kg", categoria: "Abarrotes", precio_venta: 1.2, stock: 24, stock_minimo: 10 },
  { id: 2, codigo_barras: "7750885002011", nombre: "Aceite 1 L", categoria: "Abarrotes", precio_venta: 3.5, stock: 6, stock_minimo: 8 },
  { id: 3, codigo_barras: "7750106001012", nombre: "Leche entera 1 L", categoria: "Lácteos", precio_venta: 1.1, stock: 40, stock_minimo: 12 },
  { id: 4, codigo_barras: "7750312004015", nombre: "Azúcar 1 kg", categoria: "Abarrotes", precio_venta: 1.0, stock: 3, stock_minimo: 10 },
  { id: 5, codigo_barras: "7750456005018", nombre: "Pan de molde", categoria: "Panadería", precio_venta: 2.2, stock: 0, stock_minimo: 5 },
  { id: 6, codigo_barras: "7750567006021", nombre: "Galletas surtidas", categoria: "Panadería", precio_venta: 0.9, stock: 31, stock_minimo: 10 },
  { id: 7, codigo_barras: "7750678007034", nombre: "Jabón de tocador", categoria: "Limpieza", precio_venta: 0.8, stock: 18, stock_minimo: 6 },
  { id: 8, codigo_barras: "7750789008047", nombre: "Agua 600 ml", categoria: "Bebidas", precio_venta: 0.6, stock: 52, stock_minimo: 20 },
  { id: 9, codigo_barras: "7750890009050", nombre: "Yogur natural", categoria: "Lácteos", precio_venta: 0.7, stock: 14, stock_minimo: 8 },
  { id: 10, codigo_barras: "7750901010063", nombre: "Detergente 1 kg", categoria: "Limpieza", precio_venta: 2.9, stock: 9, stock_minimo: 5 },
  { id: 11, codigo_barras: "7750123011076", nombre: "Gaseosa 2 L", categoria: "Bebidas", precio_venta: 1.8, stock: 22, stock_minimo: 10 },
  { id: 12, codigo_barras: "7750234012089", nombre: "Queso fresco", categoria: "Lácteos", precio_venta: 3.2, stock: 7, stock_minimo: 6 }
];

// Datos semilla de tiendas para Superadmin (modo demo) con planes SaaS vinculados
const SEED_STORES = [
  {
    id: 1,
    nombre: 'Minimarket La Esquina',
    dueno: 'Carlos Peña',
    email: 'carlos@laesquina.com',
    plan: 'full',
    monto: 139,
    per: 1,
    inicio: '2026-01-15',
    proximo: '2026-11-23',
    estado: 'activa',
    paleta: 'brex',
    modulos: ['inventario', 'ventas', 'reportes', 'escaner', 'compras'],
    pagos: [
      { fecha_pago: '2026-10-23', monto: 139 },
      { fecha_pago: '2026-09-23', monto: 139 }
    ]
  },
  {
    id: 2,
    nombre: 'Ferretería El Tornillo',
    dueno: 'Marta Gómez',
    email: 'marta@eltornillo.com',
    plan: 'pro',
    monto: 89,
    per: 1,
    inicio: '2026-04-10',
    proximo: '2026-11-06',
    estado: 'activa',
    paleta: 'oceano',
    modulos: ['inventario', 'ventas', 'reportes', 'escaner'],
    pagos: [{ fecha_pago: '2026-10-06', monto: 89 }]
  },
  {
    id: 3,
    nombre: 'Boutique Aurora',
    dueno: 'Lucía Ramos',
    email: 'lucia@aurora.com',
    plan: 'basico',
    monto: 59,
    per: 1,
    inicio: '2026-07-20',
    proximo: '2026-10-25',
    estado: 'activa',
    paleta: 'fucsia',
    modulos: ['inventario', 'ventas'],
    pagos: [{ fecha_pago: '2026-09-20', monto: 59 }]
  },
  {
    id: 4,
    nombre: 'Licorería Don Pepe',
    dueno: 'José Salas',
    email: 'jose@donpepe.com',
    plan: 'pro',
    monto: 89,
    per: 1,
    inicio: '2025-09-01',
    proximo: '2026-10-11',
    estado: 'suspendida',
    paleta: 'grafito',
    modulos: ['inventario', 'ventas', 'reportes', 'escaner'],
    pagos: [{ fecha_pago: '2026-09-11', monto: 89 }]
  },
  {
    id: 5,
    nombre: 'Papelería Central',
    dueno: 'Ana Torres',
    email: 'ana@papeleriacentral.com',
    plan: 'basico',
    monto: 59,
    per: 1,
    inicio: '2026-09-01',
    proximo: '2026-10-31',
    estado: 'activa',
    paleta: 'bosque',
    modulos: ['inventario', 'ventas'],
    pagos: [{ fecha_pago: '2026-09-30', monto: 59 }]
  }
];

function AppContent() {
  const {
    user,
    profile,
    membership,
    store,
    primarySede,
    loading,
    isDemoMode,
    demoRole,
    effectiveRole,
    storeRole,
    isSuperadmin,
    userStores,
    switchStore,
    signOut,
    switchDemoRole,
    enterDemoMode,
    reloadProfileAndStore,
    updateStorePalette,
    updateStoreModules,
    isLoginSplashActive,
    triggerLoginSplash,
    dismissLoginSplash
  } = useAuth();

  const { palette, customPalette } = useTheme();

  // Conmutador de vista general (Tienda vs Superadmin)
  const [appMode, setAppMode] = useState(() => (isSuperadmin && !store ? 'superadmin' : 'tienda'));

  useEffect(() => {
    if (!isSuperadmin && appMode !== 'tienda') {
      setAppMode('tienda');
    }
  }, [isSuperadmin, appMode]);

  // Sincronizar estilo exclusivo para el panel de administración de Vendia
  useEffect(() => {
    if (appMode === 'superadmin') {
      document.body.classList.add('vendia-admin-body');
    } else {
      document.body.classList.remove('vendia-admin-body');
    }
    return () => {
      document.body.classList.remove('vendia-admin-body');
    };
  }, [appMode]);

  // Sincronizar dinámicamente el título de la pestaña del navegador con Vendia
  useEffect(() => {
    if (!user && !isDemoMode) {
      document.title = 'Vendia | Login';
    } else if (!store && !isSuperadmin && !isDemoMode) {
      document.title = 'Vendia | Activación en Proceso';
    } else if (appMode === 'superadmin') {
      document.title = 'Vendia | Panel Administrador';
    } else if (store?.nombre) {
      document.title = `${store.nombre} | Vendia`;
    } else {
      document.title = 'Vendia | Punto de Venta & Gestión';
    }
  }, [user, isDemoMode, store, isSuperadmin, appMode]);

  // Estado común
  const [toastMessage, setToastMessage] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('vendia_sidebar_collapsed') === 'true';
  });

  // Atajo de teclado global Ctrl+K / Cmd+K para abrir el buscador de productos y tickets
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('vendia_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Modo "Ver como tienda" (Solo Lectura Superadmin)
  const [impersonatedStore, setImpersonatedStore] = useState(null);

  const handleImpersonateStore = (targetStore) => {
    if (!targetStore) return;
    setImpersonatedStore(targetStore);
    setAppMode('tienda');
    setStoreTab('res');
    logSaaSAuditEvent({
      tipo: 'seguridad',
      accion: 'Acceso en modo solo lectura (Impersonación)',
      detalle: `Superadmin inició sesión de vista de solo lectura en la tienda "${targetStore.nombre}".`,
      tienda: targetStore.nombre
    });
    showToast(`Modo solo lectura activado: ${targetStore.nombre}`);
  };

  const handleExitImpersonation = () => {
    if (impersonatedStore) {
      logSaaSAuditEvent({
        tipo: 'seguridad',
        accion: 'Fin de impersonación',
        detalle: `Superadmin salió de la vista de solo lectura de "${impersonatedStore.nombre}".`,
        tienda: impersonatedStore.nombre
      });
    }
    setImpersonatedStore(null);
    setAppMode('superadmin');
    showToast("Volviste al panel administrativo");
  };

  const handleExportStoreData = async (targetStore) => {
    const t = targetStore || store;
    if (!t) return;
    showToast(`Exportando datos de ${t.nombre}...`);
    try {
      await exportStoreCompleteData({
        storeId: t.id,
        storeName: t.nombre,
        isDemoMode,
        localProducts: products,
        localSales: sales
      });
      showToast("✓ Archivo de copia de seguridad generado");
    } catch (err) {
      console.error('Error al exportar datos:', err);
      alert('Error al exportar datos de la tienda');
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2400);
  };

  // ================= ESTADO DE TIENDA =================
  const role = storeRole;
  const [storeTab, setStoreTab] = useState('res'); // 'res', 'ven', 'inv', 'vta', 'neg'
  const [storeLogo, setStoreLogo] = useState(() => {
    return store?.logo_url || store?.logo || getStoreLogoStorage(store?.id || 'demo');
  });

  useEffect(() => {
    const existing = store?.logo_url || store?.logo || getStoreLogoStorage(store?.id || 'demo');
    setStoreLogo(existing);
  }, [store?.id, store?.logo_url, store?.logo]);

  const handleUpdateStoreLogo = async (newLogo) => {
    setStoreLogo(newLogo);
    setStoreLogoStorage(store?.id || 'demo', newLogo);

    if (!isDemoMode && store?.id) {
      try {
        await guardarLogoTiendaRPC({ storeId: store.id, logoUrl: newLogo });
        showToast("Logotipo guardado en Supabase");
      } catch (err) {
        console.error('Error al guardar logo en Supabase:', err);
        showToast("Logotipo guardado localmente");
      }
    } else {
      showToast("Logotipo actualizado");
    }
  };

  // Métodos de pago configurables para la tienda
  const getInitialPaymentMethods = (sId) => {
    try {
      const cached = localStorage.getItem(`tienda_${sId || 'demo'}_metodos_pago`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { }
    const currentStore = impersonatedStore || store;
    if (Array.isArray(currentStore?.metodos_pago) && currentStore.metodos_pago.length > 0) {
      return currentStore.metodos_pago;
    }
    return DEFAULT_PAYMENT_METHODS;
  };

  const activeStore = impersonatedStore || store;

  const [storePaymentMethods, setStorePaymentMethods] = useState(() => getInitialPaymentMethods(activeStore?.id));

  useEffect(() => {
    setStorePaymentMethods(getInitialPaymentMethods(activeStore?.id));
  }, [activeStore?.id, activeStore?.metodos_pago]);

  const [products, setProducts] = useState(() => (isDemoMode ? SEED_PRODUCTS : []));
  const [cart, setCart] = useState({});
  const [sales, setSales] = useState([]);
  const [movements, setMovements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [contractData, setContractData] = useState(null);
  const [contractPayments, setContractPayments] = useState([]);
  const [resumenData, setResumenData] = useState(null);
  const [activeSaleModal, setActiveSaleModal] = useState(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [readAlerts, setReadAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('vendia_read_alerts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('vendia_dismissed_alerts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });


  // Cargar datos reales de la tienda desde Supabase cuando hay store
  const refreshStoreData = useCallback(async () => {
    if (isDemoMode || !activeStore?.id) return;

    try {
      const prods = await getStoreProducts(activeStore.id, primarySede?.id);
      setProducts(prods);

      const movs = await getStoreInventoryMovements(activeStore.id);
      setMovements(movs);

      const salesToday = await getStoreSalesToday(activeStore.id);
      setSales(salesToday);

      const emps = await getStoreEmployees(activeStore.id);
      setEmployees(emps);

      const cp = await getStoreContractAndPayments(activeStore.id);
      setContractData(cp.contract);
      setContractPayments(cp.pagos);

      const al = await getStoreAlerts(activeStore.id);
      setLiveAlerts(al);

      if (role === 'dueno') {
        try {
          const res = await getResumenTiendaRPC(activeStore.id);
          setResumenData(res);
        } catch (e) {
          console.warn('No se pudo cargar resumen RPC:', e);
        }
      }
    } catch (err) {
      console.error('Error al sincronizar datos de la tienda:', err);
    }
  }, [isDemoMode, activeStore?.id, primarySede?.id, role]);

  useEffect(() => {
    if (!isDemoMode && activeStore?.id) {
      refreshStoreData();
    } else if (isDemoMode) {
      setProducts(SEED_PRODUCTS);
      setSales([
        {
          id: 1,
          hora: "08:12",
          usuario: "Lucía Ramos",
          metodo_pago: "Efectivo",
          items: [{ producto_id: 3, nombre: "Leche entera 1 L", cantidad: 2, precio: 1.1 }, { producto_id: 5, nombre: "Pan de molde", cantidad: 1, precio: 2.2 }],
          total: 4.4,
          monto_recibido: 5.0
        },
        {
          id: 2,
          hora: "09:40",
          usuario: "Lucía Ramos",
          metodo_pago: "Tarjeta",
          items: [{ producto_id: 2, nombre: "Aceite 1 L", cantidad: 1, precio: 3.5 }],
          total: 3.5,
          monto_recibido: null
        }
      ]);
      setMovements([
        { id: 1, hora: "08:00", tipo: "Entrada", producto_id: 3, producto_nombre: "Leche entera 1 L", cantidad: 48, usuario: "Carlos Peña" },
        { id: 2, hora: "08:30", tipo: "Ajuste", producto_id: 5, producto_nombre: "Pan de molde", cantidad: -1, usuario: "Carlos Peña" }
      ]);
      setEmployees([
        { id: 1, nombre: "Lucía Ramos", correo: "lucia@laesquina.com", activo: true },
        { id: 2, nombre: "Mateo Díaz", correo: "mateo@laesquina.com", activo: true },
        { id: 3, nombre: "Sofía León", correo: "sofia@laesquina.com", activo: false }
      ]);
    }
  }, [isDemoMode, activeStore?.id, refreshStoreData]);

  // Nombre de la tienda y usuario
  const storeName = activeStore?.nombre || (isDemoMode ? "Minimarket La Esquina" : (loading ? "Cargando tienda..." : "Mi Tienda"));
  const userName = profile?.nombre || user?.email?.split('@')[0] || (isDemoMode ? (role === 'dueno' ? 'Carlos Peña' : 'Lucía Ramos') : 'Usuario');

  // Cálculo dinámico de aviso de próximo pago para la tienda
  const storeProximoPago = contractData?.proximo_pago || activeStore?.proximo_pago || activeStore?.proximo;
  let paymentNotice = null;
  if (storeProximoPago) {
    const daysLeft = diffDays(storeProximoPago);
    if (daysLeft < 0) {
      paymentNotice = {
        days: daysLeft,
        isOverdue: true,
        message: `Tu suscripción tiene un pago pendiente vencido hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'día' : 'días'} (${fd(storeProximoPago)}).`,
        actionText: 'Ver mi plan'
      };
    } else if (daysLeft === 0) {
      paymentNotice = {
        days: 0,
        isDueToday: true,
        message: `Tu próximo pago de suscripción vence hoy (${fd(storeProximoPago)}). Renueva a tiempo para mantener tu tienda activa.`,
        actionText: 'Ver mi plan'
      };
    } else if (daysLeft <= 5) {
      paymentNotice = {
        days: daysLeft,
        isDueSoon: true,
        message: `Tu próximo pago vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} (${fd(storeProximoPago)}).`,
        actionText: 'Ver mi plan'
      };
    }
  }

  // Alertas calculadas de la tienda
  const rawStoreAlerts = !isDemoMode && liveAlerts.length > 0
    ? liveAlerts
    : products
      .filter((p) => (p.stock || 0) <= (p.stock_minimo || 5))
      .map((p) => ({
        id: `stock-${p.id}-${p.stock}`,
        tipo: (p.stock || 0) <= 0 ? 'agotado' : 'stock_bajo',
        mensaje: (p.stock || 0) <= 0 ? `Agotado: ${p.nombre}` : `Stock bajo: ${p.nombre} (quedan ${p.stock}, mín. ${p.stock_minimo || 5})`
      }));

  if (role === 'dueno' && paymentNotice) {
    rawStoreAlerts.push({
      id: 'pago-sistema',
      tipo: 'pago',
      mensaje: paymentNotice.message
    });
  }

  // Filtrar las que fueron eliminadas con la X
  const storeAlerts = rawStoreAlerts.filter((a) => !dismissedAlerts.has(a.id));

  // Contador real de NO leídas (descontando leídas y eliminadas)
  const unreadAlertCount = storeAlerts.filter((a) => {
    if (readAlerts.has(a.id)) return false;
    if (!isDemoMode && a.leida) return false;
    return true;
  }).length;

  // Lógica de Vender y Carrito con soporte de decimales (pesos y fracciones)
  const handleAddToCart = (id, delta = 1, isDirectSet = false) => {
    const prod = products.find((p) => String(p.id) === String(id));
    if (!prod || prod.stock <= 0) return;
    setCart((prev) => {
      const current = prev[id] || 0;
      let next = isDirectSet ? delta : current + delta;
      next = Math.round(next * 1000) / 1000;
      if (next > prod.stock) next = prod.stock;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleDecFromCart = (id, delta = 1) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = Math.round((current - delta) * 1000) / 1000;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleClearCart = () => {
    setCart({});
  };

  const handleCheckout = async ({ metodo_pago, monto_recibido, pagos_mixtos = null, idempotency_key = null }) => {
    if (impersonatedStore) {
      alert('Acción bloqueada: Estás en modo de solo lectura (Superadmin inspeccionando tienda).');
      return;
    }

    // 0. Validación de seguridad contra manipulación en el cliente
    const validation = validateSaleCheckout({
      cart,
      products,
      metodoPago: metodo_pago,
      pagosMixtos: pagos_mixtos,
      montoRecibido: monto_recibido,
      idempotencyKey: idempotency_key
    });

    if (!validation.isValid) {
      alert(validation.errors.join('\n'));
      return;
    }

    const hora = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const userDisplay = userName;

    // Numeración consecutiva estricta por tienda
    const storeSeqKey = `tienda_${store?.id || 'demo'}_correlativo_seq`;
    let currentSeq = parseInt(localStorage.getItem(storeSeqKey) || '0', 10);
    if (currentSeq <= 0 && sales.length > 0) {
      const maxExisting = Math.max(...sales.map((s) => s.correlativo || 0));
      currentSeq = Math.max(0, maxExisting);
    }
    currentSeq += 1;
    localStorage.setItem(storeSeqKey, currentSeq.toString());

    // 1. Si no es demo y tenemos sede real, llamar al RPC transaccional registrar_venta(...)
    const targetSedeId = primarySede?.id || activeStore?.id;
    if (!isDemoMode && targetSedeId) {
      try {
        const rpcItems = Object.entries(cart).map(([prodId, qty]) => {
          const p = products.find((pr) => String(pr.id) === String(prodId));
          return {
            producto_id: prodId,
            cantidad: qty,
            precio: parseFloat(p?.precio_venta ?? p?.precio ?? 0)
          };
        });

        const result = await registrarVentaRPC({
          sedeId: targetSedeId,
          metodoPago: validation.metodoPago,
          items: rpcItems,
          montoRecibido: validation.montoRecibido,
          pagosMixtos: validation.pagosMixtos,
          idempotencyKey: validation.idempotencyKey
        });

        const receiptItems = Object.entries(cart).map(([id, qty]) => {
          const p = products.find((pr) => String(pr.id) === String(id));
          return {
            producto_id: id,
            nombre: p?.nombre || 'Producto',
            cantidad: qty,
            precio: p?.precio_venta || 0,
            unidad_medida: p?.unidad_medida || 'und'
          };
        });

        const nowObj = new Date();
        const localDateIso = getPeruDateIso(nowObj);
        const saleHora = getPeruTime(nowObj);

        const receiptSale = {
          id: result?.venta_id || Date.now(),
          serie: result?.serie || 'B001',
          correlativo: result?.correlativo || currentSeq,
          estado: 'completada',
          creado_en: nowObj.toISOString(),
          fecha: localDateIso,
          fecha_formato: formatPeruDate(nowObj, { day: '2-digit', month: '2-digit', year: 'numeric' }),
          hora: saleHora,
          usuario: userDisplay,
          metodo_pago: validation.metodoPago,
          pagos_mixtos: validation.pagosMixtos,
          idempotency_key: validation.idempotencyKey,
          items: receiptItems,
          total: parseFloat(result?.total || validation.calculatedTotal),
          monto_recibido: validation.montoRecibido,
          vuelto: result?.vuelto ? parseFloat(result.vuelto) : 0
        };

        setCart({});
        setActiveSaleModal({ sale: receiptSale, isReceipt: true });
        showToast("Venta registrada con éxito");
        await refreshStoreData();
        return;
      } catch (err) {
        console.error('Error al registrar venta vía RPC:', err);
        alert(err.message || 'Error al registrar venta.');
        return;
      }
    }

    // 2. Modo Demo / Simulación local
    const saleItems = Object.entries(cart).map(([id, qty]) => {
      const p = products.find((pr) => String(pr.id) === String(id));
      return {
        producto_id: id,
        nombre: p ? p.nombre : 'Producto',
        cantidad: qty,
        precio: p ? p.precio_venta : 0,
        unidad_medida: p?.unidad_medida || 'und'
      };
    });

    const total = Math.round(saleItems.reduce((acc, it) => acc + it.precio * it.cantidad, 0) * 100) / 100;

    // Descontar inventario local
    setProducts((prev) =>
      prev.map((p) => {
        const bought = cart[p.id];
        if (bought) {
          const newStock = Math.round((p.stock - bought) * 1000) / 1000;
          return { ...p, stock: Math.max(0, newStock) };
        }
        return p;
      })
    );

    const newMovements = saleItems.map((it) => ({
      id: Date.now() + Math.random(),
      hora,
      tipo: "Venta",
      producto_id: it.producto_id,
      producto_nombre: it.nombre,
      cantidad: -it.cantidad,
      usuario: userDisplay
    }));
    setMovements((prev) => [...prev, ...newMovements]);

    const nowDemo = new Date();
    const demoDateIso = getPeruDateIso(nowDemo);
    const demoHora = getPeruTime(nowDemo);

    const newSale = {
      id: Date.now(),
      serie: 'B001',
      correlativo: currentSeq,
      estado: 'completada',
      creado_en: nowDemo.toISOString(),
      fecha: demoDateIso,
      fecha_formato: formatPeruDate(nowDemo, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      hora: demoHora,
      usuario: userDisplay,
      metodo_pago: validation.metodoPago,
      pagos_mixtos: validation.pagosMixtos,
      idempotency_key: validation.idempotencyKey,
      items: saleItems,
      total,
      monto_recibido: validation.montoRecibido
    };

    setSales((prev) => [...prev, newSale]);
    setCart({});
    setActiveSaleModal({ sale: newSale, isReceipt: true });
    showToast("Venta cobrada con éxito");
  };

  // Anulación y devolución de venta (restaura existencias al inventario)
  const handleVoidSale = async (saleToVoid, reason = 'Devolución de cliente') => {
    if (impersonatedStore) {
      alert('Acción bloqueada: Estás en modo de solo lectura (Superadmin inspeccionando tienda).');
      return;
    }
    if (!saleToVoid || saleToVoid.estado === 'anulada') return;

    const hora = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const userDisplay = userName;

    // 1. Reingresar stock en el cliente
    setProducts((prev) =>
      prev.map((p) => {
        const itemInSale = (saleToVoid.items || []).find((it) => String(it.producto_id) === String(p.id));
        if (itemInSale) {
          const restoredStock = Math.round((p.stock + itemInSale.cantidad) * 1000) / 1000;
          return { ...p, stock: restoredStock };
        }
        return p;
      })
    );

    // 2. Registrar movimientos de devolución
    const returnMovements = (saleToVoid.items || []).map((it) => ({
      id: Date.now() + Math.random(),
      hora,
      tipo: "Devolución",
      producto_id: it.producto_id,
      producto_nombre: it.nombre,
      cantidad: it.cantidad,
      usuario: userDisplay,
      nota: `Anulación venta #${saleToVoid.correlativo || saleToVoid.id}: ${reason}`
    }));
    setMovements((prev) => [...prev, ...returnMovements]);

    // 3. Marcar venta como anulada en el estado local
    setSales((prev) =>
      prev.map((s) =>
        String(s.id) === String(saleToVoid.id)
          ? {
            ...s,
            estado: 'anulada',
            motivo_anulacion: reason,
            anulada_en: new Date().toISOString()
          }
          : s
      )
    );

    // 4. Si está en base de datos real, llamar a anularVentaRPC
    const targetSedeId = primarySede?.id || activeStore?.id;
    if (!isDemoMode && targetSedeId) {
      try {
        await anularVentaRPC({
          sedeId: targetSedeId,
          ventaId: saleToVoid.id,
          motivo: reason
        });
        await refreshStoreData();
      } catch (err) {
        console.warn('Aviso al anular venta en backend:', err);
      }
    }

    // Actualizar modal activo si está abierto
    if (activeSaleModal && String(activeSaleModal.sale?.id) === String(saleToVoid.id)) {
      setActiveSaleModal((prev) => ({
        ...prev,
        sale: {
          ...prev.sale,
          estado: 'anulada',
          motivo_anulacion: reason
        }
      }));
    }

    showToast("Venta anulada y mercadería devuelta al inventario");
  };

  // Guardar producto (Crear o Editar)
  const handleSaveProduct = async (prodData) => {
    if (impersonatedStore) {
      alert('Acción bloqueada: Estás en modo de solo lectura (Superadmin inspeccionando tienda).');
      return;
    }

    // 0. Validación y sanitización de seguridad
    const prodValidation = validateProductInput(prodData);
    if (!prodValidation.isValid) {
      alert(prodValidation.errors.join('\n'));
      return;
    }
    const safeProdData = prodValidation.data;

    const hora = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const userDisplay = userName;

    // 1. Si no es demo y tenemos sede real, usar RPCs crear_producto / editar_producto o fallback
    const targetSedeId = primarySede?.id || activeStore?.id;
    if (!isDemoMode && targetSedeId) {
      try {
        if (safeProdData.id) {
          await editarProductoRPC({
            productoId: safeProdData.id,
            sedeId: targetSedeId,
            nombre: safeProdData.nombre,
            categoria: safeProdData.categoria,
            precioVenta: safeProdData.precio_venta,
            costoUnitario: safeProdData.costo_unitario,
            stockMinimo: safeProdData.stock_minimo,
            delta: safeProdData.delta,
            codigoBarras: safeProdData.codigo_barras,
            unidadMedida: safeProdData.unidad_medida,
            activo: safeProdData.activo,
            nota: safeProdData.delta > 0 ? 'Entrada de mercancía' : 'Ajuste de stock'
          });
          showToast("Producto actualizado en la base de datos");
        } else {
          await crearProductoRPC({
            sedeId: targetSedeId,
            nombre: safeProdData.nombre,
            categoria: safeProdData.categoria,
            precioVenta: safeProdData.precio_venta,
            costoUnitario: safeProdData.costo_unitario,
            stockMinimo: safeProdData.stock_minimo,
            stockInicial: safeProdData.stock_inicial,
            codigoBarras: safeProdData.codigo_barras,
            unidadMedida: safeProdData.unidad_medida,
            activo: safeProdData.activo
          });
          showToast("Producto creado en la base de datos");
        }
        await refreshStoreData();
        return;
      } catch (err) {
        console.error('Error al guardar producto:', err);
        alert(err.message || 'Error al guardar producto.');
        return;
      }
    }

    // 2. Modo Demo / Simulación local
    if (safeProdData.id) {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === safeProdData.id) {
            const newStock = p.stock + (safeProdData.delta || 0);
            return {
              ...p,
              nombre: safeProdData.nombre || p.nombre,
              categoria: safeProdData.categoria,
              precio_venta: safeProdData.precio_venta,
              stock_minimo: safeProdData.stock_minimo,
              codigo_barras: safeProdData.codigo_barras !== undefined ? safeProdData.codigo_barras : p.codigo_barras,
              stock: newStock
            };
          }
          return p;
        })
      );
      if (safeProdData.delta !== 0) {
        setMovements((prev) => [
          ...prev,
          {
            id: Date.now(),
            hora,
            tipo: safeProdData.delta > 0 ? "Entrada" : "Ajuste",
            producto_id: safeProdData.id,
            producto_nombre: safeProdData.nombre,
            cantidad: safeProdData.delta,
            usuario: userDisplay
          }
        ]);
      }
      showToast("Cambios guardados");
    } else {
      const newProd = {
        id: Date.now(),
        nombre: safeProdData.nombre,
        categoria: safeProdData.categoria,
        precio_venta: safeProdData.precio_venta,
        stock_minimo: safeProdData.stock_minimo,
        stock: safeProdData.stock_inicial || 0,
        codigo_barras: safeProdData.codigo_barras || ''
      };
      setProducts((prev) => [...prev, newProd]);
      if (safeProdData.stock_inicial > 0) {
        setMovements((prev) => [
          ...prev,
          {
            id: Date.now(),
            hora,
            tipo: "Entrada",
            producto_id: newProd.id,
            producto_nombre: newProd.nombre,
            cantidad: safeProdData.stock_inicial,
            usuario: userDisplay
          }
        ]);
      }
      showToast("Producto creado");
    }
  };

  // Importar productos masivamente desde Excel o CSV
  const handleImportProducts = async (importedList) => {
    if (!importedList || importedList.length === 0) return;

    if (!isDemoMode && primarySede?.id) {
      try {
        let count = 0;
        for (const item of importedList) {
          try {
            await crearProductoRPC({
              sedeId: primarySede.id,
              nombre: item.nombre,
              categoria: item.categoria || 'General',
              precioVenta: item.precio_venta,
              stockMinimo: item.stock_minimo || 5,
              stockInicial: item.stock || 0
            });
            count++;
          } catch (itemErr) {
            console.warn(`Error al importar ${item.nombre}:`, itemErr);
          }
        }
        await refreshStoreData();
        showToast(`✓ ¡${count} productos importados a la base de datos!`);
        return;
      } catch (err) {
        console.error('Error al importar productos masivamente:', err);
      }
    }

    // Modo Demo / Local
    const hora = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const userDisplay = userName;

    setProducts((prev) => {
      const updated = [...prev];
      importedList.forEach((it) => {
        const existingIdx = updated.findIndex(
          (p) => (it.codigo_barras && p.codigo_barras === it.codigo_barras) || p.nombre.toLowerCase() === it.nombre.toLowerCase()
        );

        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            precio_venta: it.precio_venta,
            stock: updated[existingIdx].stock + it.stock,
            codigo_barras: it.codigo_barras || updated[existingIdx].codigo_barras
          };
        } else {
          updated.push(it);
        }
      });
      return updated;
    });

    const newMovs = importedList
      .filter((it) => it.stock > 0)
      .map((it) => ({
        id: Date.now() + Math.random(),
        hora,
        tipo: "Entrada",
        producto_id: it.id,
        producto_nombre: it.nombre,
        cantidad: it.stock,
        usuario: userDisplay
      }));

    if (newMovs.length > 0) {
      setMovements((prev) => [...prev, ...newMovs]);
    }

    showToast(`✓ ¡${importedList.length} productos cargados al inventario!`);
  };


  // Empleados
  const handleToggleEmployee = async (empId) => {
    if (!isDemoMode && store?.id) {
      try {
        const emp = employees.find((e) => e.id === empId);
        if (emp) {
          await setEmployeeActive(empId, !emp.activo);
          showToast(!emp.activo ? "Empleado activado" : "Empleado desactivado");
          await refreshStoreData();
          return;
        }
      } catch (err) {
        console.error('Error al actualizar empleado:', err);
        alert(err.message || 'Error al actualizar empleado');
        return;
      }
    }

    setEmployees((prev) =>
      prev.map((e, idx) => {
        if (e.id === empId || idx === empId) {
          const nextState = !e.activo;
          showToast(nextState ? "Empleado activado" : "Empleado desactivado");
          return { ...e, activo: nextState };
        }
        return e;
      })
    );
  };

  const handleAddEmployee = async ({ nombre, correo }) => {
    if (!isDemoMode && store?.id) {
      try {
        const result = await inviteUser({
          email: correo,
          nombre,
          tiendaId: store.id,
          rol: 'empleado'
        });
        showToast(result.message);
        await refreshStoreData();
        return;
      } catch (err) {
        console.error('Error al invitar empleado:', err);
        alert(err.message || 'Error al invitar empleado');
        return;
      }
    }

    setEmployees((prev) => [
      ...prev,
      { id: Date.now(), nombre, correo, activo: true }
    ]);
    showToast("Empleado registrado");
  };

  // Marcar una sola alerta como leída
  const handleMarkAlertRead = (alertId) => {
    setReadAlerts((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem('vendia_read_alerts', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Marcar todas las alertas como leídas
  const handleMarkAlertsRead = async () => {
    if (!isDemoMode && store?.id) {
      try {
        await marcarAlertasLeidasRPC(store.id);
        await refreshStoreData();
      } catch (err) {
        console.warn('Aviso al marcar alertas en BD:', err);
      }
    }

    setReadAlerts((prev) => {
      const next = new Set(prev);
      storeAlerts.forEach((a) => next.add(a.id));
      try {
        localStorage.setItem('vendia_read_alerts', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
    showToast("Alertas marcadas como leídas");
  };

  // Eliminar alerta individual con la X (sin confirmación)
  const handleDeleteAlert = async (alertId) => {
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem('vendia_dismissed_alerts', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });

    // Marcarla también como leída para asegurar que no sume al contador
    setReadAlerts((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem('vendia_read_alerts', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });

    if (!isDemoMode && typeof alertId === 'string' && !alertId.startsWith('stock-') && !alertId.startsWith('pago-')) {
      deleteStoreAlert(alertId);
    }

    showToast("Alerta eliminada");
  };

  // Guardar paleta de la tienda en Supabase
  const handleSavePalette = async (chosenPalette) => {
    const palToSave = (typeof chosenPalette === 'string' && chosenPalette) ? chosenPalette : palette;

    // Persistir en localStorage inmediatamente
    try {
      localStorage.setItem('store_palette', palToSave);
      setPalette(palToSave);
      if (palToSave === 'custom') {
        localStorage.setItem('store_custom_palette', JSON.stringify(customPalette));
      }
    } catch { }

    updateStorePalette(palToSave, palToSave === 'custom' ? customPalette : null);

    if (!isDemoMode && store?.id && (role === 'dueno' || isSuperadmin)) {
      try {
        await guardarPaletaRPC({
          storeId: store.id,
          paleta: palToSave,
          custom: palToSave === 'custom' ? customPalette : null
        });
        showToast("Paleta guardada");
      } catch (err) {
        console.error('Error al guardar paleta:', err);
      }
    }
    setIsPaletteOpen(false);
  };

  // Módulos contratados por la tienda
  const storeModules = store?.modulos || (isDemoMode ? ['inventario', 'ventas', 'reportes'] : ['inventario', 'ventas']);
  const hasInventario = storeModules.includes('inventario');
  const hasVentas = storeModules.includes('ventas');
  const hasReportes = storeModules.includes('reportes');

  // Tabs permitidos para la tienda según los módulos contratados y el rol
  const storeTabs = [];
  if (role === 'dueno') {
    storeTabs.push({ id: 'res', label: 'Resumen' });
  }
  if (hasVentas) {
    storeTabs.push({ id: 'ven', label: 'Vender' });
  }
  if (hasInventario) {
    storeTabs.push({ id: 'inv', label: 'Inventario' });
  }
  if (hasVentas) {
    storeTabs.push({ id: 'vta', label: 'Ventas' });
  }
  if (hasReportes && role === 'dueno') {
    storeTabs.push({ id: 'rep', label: 'Reportes' });
  }
  if (role === 'dueno') {
    storeTabs.push({ id: 'neg', label: 'Negocio' });
  }

  const handleRoleChange = (newRole) => {
    if (isDemoMode) {
      switchDemoRole(newRole);
    }
    if (newRole === 'empleado' && (storeTab === 'res' || storeTab === 'neg')) {
      setStoreTab('ven');
    }
  };

  // ================= ESTADO DE SUPERADMIN =================
  const [adminTab, setAdminTab] = useState('metricas'); // 'metricas' | 'tiendas' | 'pagos' | 'usuarios' | 'planes' | 'comunicados' | 'auditoria'
  const [stores, setStores] = useState(SEED_STORES);
  const [adminProfiles, setAdminProfiles] = useState([]);
  const [adminPaymentsList, setAdminPaymentsList] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isNewStoreOpen, setIsNewStoreOpen] = useState(false);

  // Cargar datos reales de Superadmin desde Supabase
  const refreshAdminData = useCallback(async () => {
    if (isDemoMode || !isSuperadmin) return;

    try {
      const realStores = await getAdminStores();
      setStores(realStores);

      const profiles = await getAllProfiles();
      setAdminProfiles(profiles);

      const payments = await getAdminPayments();
      setAdminPaymentsList(payments);
    } catch (err) {
      console.error('Error al cargar datos de superadmin:', err);
    }
  }, [isDemoMode, isSuperadmin]);

  useEffect(() => {
    if (!isDemoMode && isSuperadmin) {
      refreshAdminData();
    }
  }, [isDemoMode, isSuperadmin, refreshAdminData]);

  const pendingAttentionCount = stores.filter(
    (s) => s.estado === 'activa' && diffDays(s.proximo_pago || s.proximo) <= 3
  ).length;

  // Registrar Pago Superadmin (con soporte de comprobante adjunto)
  const handleRegisterPayment = async (storeId, contratoId, monto, metodo = null, nota = null, comprobanteUrl = null) => {
    const targetStore = stores.find((x) => x.id === storeId);
    logSaaSAuditEvent({
      tipo: 'pago',
      accion: 'Pago registrado',
      detalle: `Se registró pago de S/. ${monto}${comprobanteUrl ? ' (Con comprobante adjunto)' : ''}${metodo ? ' vía ' + metodo : ''}.`,
      tienda: targetStore ? targetStore.nombre : 'Tienda'
    });

    if (!isDemoMode && contratoId) {
      try {
        await registerPaymentRPC({ contratoId, monto, metodo, nota, comprobanteUrl });
        showToast("Pago registrado en la base de datos");
        await refreshAdminData();
        setSelectedStore(null);
        return;
      } catch (err) {
        console.error('Error al registrar pago RPC:', err);
        alert(err.message || 'Error al registrar pago');
        return;
      }
    }

    // Modo demo
    setStores((prev) =>
      prev.map((s) => {
        if (s.id === storeId) {
          const currentProx = new Date(s.proximo || s.proximo_pago || new Date());
          currentProx.setMonth(currentProx.getMonth() + (s.periodicidad_meses || s.per || 1));
          const newProxStr = getPeruDateIso(currentProx);
          const newPayment = {
            id: 'pay_' + Date.now(),
            fecha: getPeruDateIso(),
            monto: parseFloat(monto) || s.monto,
            metodo: metodo || 'Yape / Plin',
            nota: nota || '',
            comprobante_url: comprobanteUrl || null
          };
          const updated = {
            ...s,
            estado: 'activa',
            proximo: newProxStr,
            proximo_pago: newProxStr,
            pagos: [...(s.pagos || []), newPayment]
          };
          setSelectedStore(updated);
          return updated;
        }
        return s;
      })
    );
    showToast("Pago registrado con éxito");
  };

  // Suspender / Reactivar acceso Superadmin
  const handleToggleSuspension = async (storeId) => {
    const s = stores.find((x) => x.id === storeId);
    if (!s) return;
    const nextState = s.estado === 'activa' ? 'suspendida' : 'activa';

    logSaaSAuditEvent({
      tipo: 'tienda',
      accion: nextState === 'suspendida' ? 'Tienda suspendida' : 'Tienda reactivada',
      detalle: `Acceso del comercio ${s.nombre} cambiado a ${nextState}.`,
      tienda: s.nombre
    });

    if (!isDemoMode) {
      try {
        await updateStoreStatus(storeId, nextState);
        showToast(nextState === 'suspendida' ? "Acceso suspendido" : "Acceso reactivado");
        await refreshAdminData();
        setSelectedStore((prev) => prev ? { ...prev, estado: nextState } : null);
        return;
      } catch (err) {
        console.error('Error al actualizar estado:', err);
        alert(err.message || 'Error al actualizar estado');
        return;
      }
    }

    setStores((prev) =>
      prev.map((item) => {
        if (item.id === storeId) {
          const updated = { ...item, estado: nextState };
          setSelectedStore(updated);
          showToast(nextState === 'suspendida' ? "Acceso suspendido" : "Acceso reactivado");
          return updated;
        }
        return item;
      })
    );
  };

  // Activar / Desactivar módulos Superadmin
  const handleToggleModule = async (storeId, moduleCode) => {
    const st = stores.find((x) => x.id === storeId);
    if (!st) return;
    const currentMods = st.modulos || [];
    const isCurrentlyActive = currentMods.includes(moduleCode);

    logSaaSAuditEvent({
      tipo: 'modulo',
      accion: !isCurrentlyActive ? 'Módulo activado' : 'Módulo desactivado',
      detalle: `Módulo "${moduleCode}" ${!isCurrentlyActive ? 'activado' : 'desactivado'}.`,
      tienda: st.nombre
    });

    if (!isDemoMode) {
      try {
        await toggleStoreModule(storeId, moduleCode, !isCurrentlyActive);
        showToast("Módulos actualizados");
        await refreshAdminData();
        const nextMods = isCurrentlyActive
          ? currentMods.filter((m) => m !== moduleCode)
          : [...currentMods, moduleCode];

        setSelectedStore((prev) => {
          if (!prev) return null;
          return { ...prev, modulos: nextMods };
        });

        // Sincronizar de inmediato la tienda activa en la vista del usuario
        if (store?.id === storeId) {
          updateStoreModules(nextMods);
        }
        return;
      } catch (err) {
        console.error('Error al cambiar módulo:', err);
        alert(err.message || 'Error al cambiar módulo');
        return;
      }
    }

    setStores((prev) =>
      prev.map((s) => {
        if (s.id === storeId) {
          const nextMods = isCurrentlyActive
            ? currentMods.filter((m) => m !== moduleCode)
            : [...currentMods, moduleCode];
          const updated = { ...s, modulos: nextMods };
          setSelectedStore(updated);
          showToast("Módulos actualizados");
          return updated;
        }
        return s;
      })
    );
  };

  // Asignar Dueño Superadmin
  const handleAssignOwner = async (storeId, profileId) => {
    if (!isDemoMode) {
      try {
        await assignStoreOwner(storeId, profileId);
        showToast("Dueño asignado a la tienda con éxito");
        await refreshAdminData();
        await reloadProfileAndStore();
        setSelectedStore(null);
        return;
      } catch (err) {
        console.error('Error al asignar dueño:', err);
        alert(err.message || 'Error al asignar dueño');
        return;
      }
    }

    const pr = adminProfiles.find((p) => p.id === profileId);
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, dueno: pr?.nombre || 'Dueño', email: pr?.correo || '-' } : s))
    );
    showToast("Dueño asignado");
  };

  // Actualizar Métodos de Pago Habilitados (Superadmin o Dueño)
  const handleUpdatePaymentMethods = async (storeId, methods) => {
    try {
      localStorage.setItem(`tienda_${storeId || 'demo'}_metodos_pago`, JSON.stringify(methods));
    } catch (e) { }

    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, metodos_pago: methods } : s))
    );

    setSelectedStore((prev) => (prev && prev.id === storeId ? { ...prev, metodos_pago: methods } : prev));

    if (store?.id === storeId || storeId === 'demo' || !store?.id) {
      setStorePaymentMethods(methods);
    }

    if (!isDemoMode && storeId && storeId !== 'demo') {
      try {
        await updateStorePaymentMethods(storeId, methods);
        showToast("Métodos de pago guardados");
      } catch (err) {
        console.error('Error al guardar métodos de pago:', err);
      }
    } else {
      showToast("Métodos de pago actualizados");
    }
  };

  // Vincular / Actualizar Plan SaaS de una tienda (Superadmin)
  const handleUpdateStorePlan = async (storeId, newPlan) => {
    const targetStore = stores.find((x) => x.id === storeId);
    logSaaSAuditEvent({
      tipo: 'tienda',
      accion: 'Plan SaaS actualizado',
      detalle: `Se cambió el plan de "${targetStore?.nombre || 'Tienda'}" a ${newPlan.nombre} (${money(newPlan.precio)}/mes).`,
      tienda: targetStore?.nombre || 'Tienda'
    });

    const updatedData = {
      plan: newPlan.codigo || newPlan.id,
      monto: parseFloat(newPlan.precio),
      modulos: newPlan.modulos || targetStore?.modulos || ['inventario', 'ventas']
    };

    // Actualización inmediata en UI para respuesta instantánea
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, ...updatedData } : s))
    );
    setSelectedStore((prev) => (prev && prev.id === storeId ? { ...prev, ...updatedData } : prev));
    showToast(`✓ Plan cambiado a ${newPlan.nombre}`);

    if (!isDemoMode && storeId) {
      try {
        await updateStorePlan(storeId, newPlan.codigo, newPlan.precio, newPlan.modulos);
        await refreshAdminData();
        // Mantener la selección consistente con el nuevo plan
        setSelectedStore((prev) => (prev && prev.id === storeId ? { ...prev, ...updatedData } : prev));
      } catch (err) {
        console.error('Error al actualizar plan de la tienda:', err);
      }
    }
  };

  // Crear Tienda Superadmin
  const handleCreateStore = async (newStoreData) => {
    // Validación y sanitización de seguridad
    const storeValidation = validateStoreInput(newStoreData);
    if (!storeValidation.isValid) {
      alert(storeValidation.errors.join('\n'));
      return;
    }
    const safeStoreData = storeValidation.data;

    logSaaSAuditEvent({
      tipo: 'tienda',
      accion: 'Tienda creada',
      detalle: `Nueva tienda "${safeStoreData.nombre}" registrada con plan "${safeStoreData.plan || 'basico'}", monto S/. ${safeStoreData.monto} y ${safeStoreData.modulos?.length || 2} módulos.`,
      tienda: safeStoreData.nombre
    });

    if (!isDemoMode && isSuperadmin) {
      try {
        const result = await createStoreRPC({
          nombre: safeStoreData.nombre,
          monto: safeStoreData.monto,
          periodicidad_meses: safeStoreData.periodicidad_meses,
          fecha_inicio: safeStoreData.fecha_inicio,
          modulos: safeStoreData.modulos,
          plan: safeStoreData.plan || 'basico',
          duenoNombre: safeStoreData.dueno,
          duenoEmail: safeStoreData.email
        });

        if (result.ownerLinked) {
          showToast("Tienda creada y dueño vinculado con éxito");
        } else if (safeStoreData.email) {
          const inv = await inviteUser({
            email: safeStoreData.email,
            nombre: safeStoreData.dueno,
            tiendaId: result.tiendaId,
            rol: 'dueno'
          });

          showToast(inv.message);
        } else {
          showToast("Tienda creada en la base de datos");
        }

        await refreshAdminData();
        await reloadProfileAndStore();
        return;
      } catch (err) {
        console.error('Error al crear tienda vía RPC:', err);
        alert(err.message || 'Error al crear tienda');
        return;
      }
    }

    // Modo demo
    const nextProx = new Date(newStoreData.fecha_inicio);
    if (newStoreData.plan === 'gratuito' || parseFloat(newStoreData.monto) === 0) {
      nextProx.setDate(nextProx.getDate() + 7);
    } else {
      nextProx.setMonth(nextProx.getMonth() + newStoreData.periodicidad_meses);
    }
    const newEntry = {
      id: Date.now(),
      nombre: newStoreData.nombre,
      dueno: newStoreData.dueno,
      email: newStoreData.email,
      plan: newStoreData.plan || 'basico',
      monto: newStoreData.monto,
      per: newStoreData.periodicidad_meses,
      inicio: newStoreData.fecha_inicio,
      proximo: getPeruDateIso(nextProx),
      estado: 'activa',
      paleta: 'brex',
      modulos: newStoreData.modulos,
      pagos: [{ fecha_pago: newStoreData.fecha_inicio, monto: newStoreData.monto }]
    };

    setStores((prev) => [newEntry, ...prev]);
    showToast("Tienda creada con éxito");
  };


  // 0. Si el splash screen de inicio de sesión está activo y los datos aún están cargando
  if (isLoginSplashActive && (loading || (!user && !isDemoMode))) {
    return <LoginSplashScreen onComplete={dismissLoginSplash} />;
  }

  // 1. Cargando sesión con esqueleto Brex
  if (loading) {
    return <Skeleton />;
  }

  // 2. Si no hay usuario ni modo demo activo: Mostrar Login
  if (!user && !isDemoMode) {
    return <Login />;
  }

  // 3. Usuario registrado sin tienda asignada ni superadmin (Onboarding en espera de activación)
  if (!store && !isSuperadmin && !isDemoMode) {
    const userPhone =
      user?.user_metadata?.telefono ||
      (user?.email ? localStorage.getItem('user_phone_' + user.email.toLowerCase()) : null) ||
      localStorage.getItem('vendia_user_phone');

    const whatsappHelpUrl = `https://wa.me/51987654321?text=${encodeURIComponent(
      `Hola equipo de Vendia, me acabo de registrar con el correo ${user?.email || ''} y deseo coordinar la activación de mi tienda.`
    )}`;

    return (
      <div
        style={{
          minHeight: '100vh',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '36px 16px',
          backgroundColor: '#060B17',
          backgroundImage: `
            radial-gradient(circle at 82% 45%, rgba(0, 229, 255, 0.16) 0%, transparent 55%),
            radial-gradient(circle at 18% 55%, rgba(0, 200, 83, 0.13) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(13, 23, 44, 0.7) 0%, transparent 80%),
            linear-gradient(135deg, #050914 0%, #070e1e 50%, #060b18 100%)
          `,
          overflow: 'hidden',
          userSelect: 'none',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}
      >
        <style>{`
          @keyframes floatWaitingCard {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
          }
          @keyframes pulseWaitingGlow {
            0%, 100% { opacity: 0.55; transform: scale(0.96); }
            50% { opacity: 0.9; transform: scale(1.05); }
          }
          @keyframes driftWaitingWatermark {
            0% { transform: translate(0, 0); }
            100% { transform: translate(170px, 120px); }
          }
          .vendia-waiting-card {
            animation: floatWaitingCard 5.5s ease-in-out infinite;
          }
          .vendia-waiting-card:hover {
            animation-play-state: paused;
          }
        `}</style>

        {/* PATRÓN WATERMARK EN TODA LA PANTALLA */}
        <svg
          style={{
            position: 'absolute',
            inset: '-120px',
            width: 'calc(100% + 240px)',
            height: 'calc(100% + 240px)',
            pointerEvents: 'none',
            opacity: 0.95
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="vendiaWaitingWatermark"
              width="170"
              height="120"
              patternUnits="userSpaceOnUse"
            >
              {/* Tile 1: Isotipo V en wireframe */}
              <g
                transform="translate(12, 12) scale(0.38)"
                stroke="rgba(0, 229, 255, 0.08)"
                strokeWidth="2.5"
                fill="none"
                strokeLinejoin="round"
              >
                <polygon points="212,10 188,10 105,146 75,100 66,108 96,163 116,163" />
                <polygon points="160,15 133,27 139,34 105,83 82,51 50,90 58,102 82,75 105,114 149,43 158,44" />
                <polygon points="10,28 68,28 77,43 68,54 58,43 38,43 54,69 43,81" />
              </g>

              {/* Tile 2: Isotipo V alternado (staggered) */}
              <g
                transform="translate(97, 72) scale(0.38)"
                stroke="rgba(0, 229, 255, 0.08)"
                strokeWidth="2.5"
                fill="none"
                strokeLinejoin="round"
              >
                <polygon points="212,10 188,10 105,146 75,100 66,108 96,163 116,163" />
                <polygon points="160,15 133,27 139,34 105,83 82,51 50,90 58,102 82,75 105,114 149,43 158,44" />
                <polygon points="10,28 68,28 77,43 68,54 58,43 38,43 54,69 43,81" />
              </g>
            </pattern>
          </defs>
          <g style={{ animation: 'driftWaitingWatermark 60s linear infinite' }}>
            <rect width="100%" height="100%" fill="url(#vendiaWaitingWatermark)" />
          </g>
        </svg>

        {/* RESPLANDOR AMBIENTAL DETRÁS DE LA TARJETA */}
        <div
          style={{
            position: 'absolute',
            width: '540px',
            height: '540px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 229, 255, 0.14) 0%, rgba(0, 200, 83, 0.08) 50%, transparent 70%)',
            filter: 'blur(75px)',
            pointerEvents: 'none',
            animation: 'pulseWaitingGlow 4.5s ease-in-out infinite'
          }}
        />

        {/* TARJETA ELEGANTE OBSIDIAN GLASS */}
        <div
          className="vendia-waiting-card"
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: '470px',
            padding: '36px 30px',
            background: 'rgba(11, 18, 32, 0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.65), 0 0 25px rgba(0, 229, 255, 0.08)',
            textAlign: 'center'
          }}
        >
          {/* LOGO OFICIAL */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <VendiaLogo variant="full" size={42} theme="dark" showSubtitle={true} />
          </div>

          {/* BADGE DE ESTADO */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              background: 'rgba(0, 229, 255, 0.10)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              color: '#38bdf8',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              marginBottom: '14px'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#00E5FF',
                boxShadow: '0 0 8px #00E5FF'
              }}
            />
            Solicitud en Proceso de Activación
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px' }}>
            ¡Todo listo, {userName}!
          </h2>
          <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 20px' }}>
            Tu cuenta ha sido creada exitosamente. Estamos configurando tu espacio de trabajo para tu tienda o comercio.
          </p>

          {/* TRACKER DE PROGRESO (TRANQUILIZADOR PARA EL USUARIO) */}
          <div
            style={{
              background: 'rgba(2, 6, 23, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '18px'
            }}
          >
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px'
              }}
            >
              Progreso de tu cuenta
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Paso 1: Completado */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(0, 200, 83, 0.2)',
                    border: '1.5px solid #00C853',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00C853',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0
                  }}
                >
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>Cuenta registrada</div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Usuario verificado con {user?.email}</div>
                </div>
              </div>

              {/* Paso 2: En curso */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(0, 229, 255, 0.2)',
                    border: '1.5px solid #00E5FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00E5FF',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                    boxShadow: '0 0 10px rgba(0, 229, 255, 0.4)'
                  }}
                >
                  ⏳
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>Configuración de comercio (En curso)</div>
                  <div style={{ fontSize: '10.5px', color: '#cbd5e1' }}>El equipo administrador está asignando tu tienda y habilitando tus módulos.</div>
                </div>
              </div>

              {/* Paso 3: Próximo */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', opacity: 0.6 }}>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1.5px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    fontSize: '11px',
                    flexShrink: 0
                  }}
                >
                  3
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>Acceso al Punto de Venta</div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>Podrás iniciar ventas, registrar inventario y emitir comprobantes.</div>
                </div>
              </div>
            </div>
          </div>

          {/* TARJETA INFORMATIVA DE WHATSAPP */}
          <div
            style={{
              background: 'rgba(37, 211, 102, 0.08)',
              border: '1px solid rgba(37, 211, 102, 0.25)',
              borderRadius: '12px',
              padding: '12px 14px',
              textAlign: 'left',
              marginBottom: '20px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}
          >
            <IconWhatsApp size={22} color="#25D366" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45 }}>
              Un asesor de Vendia se comunicará {userPhone ? <>al número <b>{userPhone}</b></> : 'contigo'} vía WhatsApp para darte acceso y ayudarte a comenzar.
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              href={whatsappHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 18px',
                background: 'linear-gradient(135deg, #00C853 0%, #00B0FF 100%)',
                color: '#ffffff',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '12.5px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0, 200, 83, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              <IconWhatsApp size={16} color="#ffffff" />
              <span>Escribir a Soporte por WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={signOut}
              style={{
                padding: '9px 16px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '11px', color: '#64748b', zIndex: 10 }}>
          <span>Vendia Cloud · Conexión segura SSL · by A&B Studio</span>
        </div>
      </div>
    );
  }

  // 4. Si la tienda está suspendida y no es superadmin
  if (store && store.estado === 'suspendida' && !isSuperadmin) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--paper)',
          padding: '24px'
        }}
      >
        <div
          className="card"
          style={{ maxWidth: '480px', padding: '32px', textAlign: 'center' }}
        >
          <span className="chip sus" style={{ marginBottom: '16px' }}>
            Acceso Suspendido
          </span>
          <h2>{store.nombre}</h2>
          <p className="hint" style={{ margin: '16px 0 24px' }}>
            El acceso a esta tienda ha sido suspendido temporalmente por falta de pago.
            Por favor, ponte en contacto con el administrador de la plataforma para reactivar el servicio.
          </p>
          <button type="button" className="btn o" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Pantalla Splash de Bienvenida (Estilo Tarjeta de Marca Vendia con Watermark) */}
      {isLoginSplashActive && (
        <LoginSplashScreen onComplete={dismissLoginSplash} />
      )}

      {/* Banner de Impersonación "Ver como tienda" (Solo Lectura Superadmin) */}
      {impersonatedStore && (
        <div className="impersonation-banner">
          <span>
            👁️ <strong>MODO VISTA DE TIENDA (SOLO LECTURA):</strong> Estás inspeccionando <strong>{impersonatedStore.nombre}</strong> como Superadmin. Las modificaciones están bloqueadas.
          </span>
          <button
            type="button"
            className="btn s"
            onClick={handleExitImpersonation}
            style={{ background: '#000', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            ✕ Salir al Panel Admin
          </button>
        </div>
      )}

      {/* Banner de Aviso de Pago para Dueño (solo cuando vence en <= 5 días o está vencido) */}
      {appMode === 'tienda' && role === 'dueno' && paymentNotice && (
        <TopBanner
          message={paymentNotice.message}
          actionText={paymentNotice.actionText}
          onActionClick={() => setStoreTab('neg')}
        />
      )}

      {/* Comunicado Broadcast Global para Tiendas */}
      {appMode === 'tienda' && <BroadcastBanner />}

      {/* Contenedor de la Aplicación */}
      <div
        className={`app ${appMode === 'superadmin' ? 'vendia-admin-theme' : ''} ${appMode === 'superadmin' && isSidebarCollapsed ? 'sidebar-collapsed' : ''
          }`}
      >
        {/* Navegación Lateral */}
        <Sidebar
          brand={appMode === 'tienda' ? storeName : "Panel admin"}
          logo={appMode === 'tienda' ? storeLogo : null}
          userName={userName}
          onSignOut={signOut}
          tabs={
            appMode === 'tienda'
              ? storeTabs
              : [
                { id: 'metricas', label: 'Métricas' },
                { id: 'tiendas', label: 'Tiendas' },
                { id: 'pagos', label: 'Pagos' },
                { id: 'usuarios', label: 'Usuarios' },
                { id: 'planes', label: 'Planes' },
                { id: 'comunicados', label: 'Comunicados' },
                { id: 'auditoria', label: 'Auditoría' }
              ]
          }
          activeTab={appMode === 'tienda' ? storeTab : adminTab}
          onSelectTab={appMode === 'tienda' ? setStoreTab : setAdminTab}
          isSuperadmin={isSuperadmin}
          appMode={appMode}
          onToggleAppMode={() => setAppMode((prev) => (prev === 'tienda' ? 'superadmin' : 'tienda'))}
          userStores={userStores}
          activeStoreId={activeStore?.id}
          onSwitchStore={(storeId) => {
            if (impersonatedStore) setImpersonatedStore(null);
            switchStore(storeId);
          }}
          isCollapsed={appMode === 'superadmin' ? isSidebarCollapsed : false}
          onToggleCollapse={handleToggleSidebar}
        />

        {/* Área Principal de Contenido */}
        <div className="main">
          {/* Header solo en modo superadmin (en tienda se retira el navbar superior según diseño del usuario) */}
          {appMode === 'superadmin' && (
            <Header
              isSuperadmin={true}
              storeName={storeName}
              storeLogo={null}
              userName={userName}
              role={role}
              onRoleChange={isDemoMode ? handleRoleChange : undefined}
              alertCount={unreadAlertCount}
              onOpenAlerts={() => setIsAlertsOpen(true)}
              onOpenPalette={() => setIsPaletteOpen(true)}
              onSignOut={signOut}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={handleToggleSidebar}
              onTriggerSplash={triggerLoginSplash}
              products={products}
              sales={sales}
              onSelectTab={setStoreTab}
              onSelectSale={(s) => setActiveSaleModal({ sale: s, isReceipt: false })}
            />
          )}

          {/* Banner de atención de cobros en modo superadmin */}
          {appMode === 'superadmin' && pendingAttentionCount > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <TopBanner
                message={`${pendingAttentionCount} ${pendingAttentionCount === 1 ? 'tienda requiere' : 'tiendas requieren'
                  } atención de cobro.`}
                actionText="Ver vencidas"
                onActionClick={() => setAdminTab('tiendas')}
              />
            </div>
          )}

          {/* Onboarding Checklist interactivo para tiendas nuevas */}
          {appMode === 'tienda' && !impersonatedStore && (
            <OnboardingChecklist
              products={products}
              sales={sales}
              employees={employees}
              palette={palette}
              onNavigateTab={(tabKey) => {
                if (tabKey === 'inventario') setStoreTab('inv');
                else if (tabKey === 'vender') setStoreTab('ven');
                else if (tabKey === 'negocio') setStoreTab('neg');
                else setStoreTab(tabKey);
              }}
              onOpenPaletteModal={() => setIsPaletteOpen(true)}
            />
          )}

          {/* Vistas de Tienda */}
          {appMode === 'tienda' && (
            <>
              {storeTab === 'res' && role === 'dueno' && (
                <ResumenTab
                  userName={userName}
                  products={products}
                  sales={sales}
                  resumenData={resumenData}
                  paymentMethods={storePaymentMethods}
                  onSelectSale={(s) => setActiveSaleModal({ sale: s, isReceipt: false })}
                  alertCount={unreadAlertCount}
                  onOpenAlerts={() => setIsAlertsOpen(true)}
                />
              )}

              {storeTab === 'ven' && (
                <VenderTab
                  products={products}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onDecFromCart={handleDecFromCart}
                  onClearCart={handleClearCart}
                  onCheckout={handleCheckout}
                  storeName={storeName}
                  userName={userName}
                  storeLogo={storeLogo}
                  paymentMethods={storePaymentMethods}
                  alertCount={unreadAlertCount}
                  onOpenAlerts={() => setIsAlertsOpen(true)}
                />
              )}

              {storeTab === 'inv' && (
                <InventarioTab
                  products={products}
                  movements={movements}
                  role={role}
                  onSaveProduct={handleSaveProduct}
                  onImportProducts={handleImportProducts}
                  alertCount={unreadAlertCount}
                  onOpenAlerts={() => setIsAlertsOpen(true)}
                />
              )}

              {storeTab === 'vta' && (
                <VentasTab
                  sales={sales}
                  products={products}
                  storeName={storeName}
                  activeSaleModal={activeSaleModal}
                  onCloseSaleModal={() => setActiveSaleModal(null)}
                  onSelectSale={(s) => setActiveSaleModal({ sale: s, isReceipt: false })}
                  onVoidSale={handleVoidSale}
                  paymentMethods={storePaymentMethods}
                  alertCount={unreadAlertCount}
                  onOpenAlerts={() => setIsAlertsOpen(true)}
                />
              )}

              {storeTab === 'rep' && role === 'dueno' && (
                <ReportesTab
                  sales={sales}
                  products={products}
                  storeName={storeName}
                  alertCount={unreadAlertCount}
                  onOpenAlerts={() => setIsAlertsOpen(true)}
                />
              )}

              {storeTab === 'neg' && role === 'dueno' && (
                <NegocioTab
                  employees={employees}
                  storeId={store?.id}
                  storeName={storeName}
                  storeLogo={storeLogo}
                  products={products}
                  sales={sales}
                  isDemoMode={isDemoMode}
                  onUpdateLogo={handleUpdateStoreLogo}
                  paymentMethods={storePaymentMethods}
                  onUpdatePaymentMethods={handleUpdatePaymentMethods}
                  contract={
                    contractData
                      ? {
                        plan: contractData.plan || activeStore?.plan,
                        monto: contractData.monto ?? activeStore?.monto,
                        moneda: contractData.moneda || activeStore?.moneda || 'PEN',
                        periodicidad_meses: contractData.periodicidad_meses || activeStore?.periodicidad_meses || activeStore?.per || 1,
                        fecha_inicio: contractData.fecha_inicio || activeStore?.fecha_inicio || activeStore?.inicio,
                        proximo_pago: contractData.proximo_pago || activeStore?.proximo_pago || activeStore?.proximo,
                        modulos: storeModules
                      }
                      : {
                        plan: activeStore?.plan || 'Plan Full Suite / Multi-Tienda',
                        monto: activeStore?.monto ?? 139,
                        moneda: activeStore?.moneda || 'PEN',
                        periodicidad_meses: activeStore?.periodicidad_meses || activeStore?.per || 1,
                        fecha_inicio: activeStore?.fecha_inicio || activeStore?.inicio || '2026-01-15',
                        proximo_pago: activeStore?.proximo_pago || activeStore?.proximo || '2026-11-23',
                        modulos: storeModules
                      }
                  }
                  pagos={contractPayments.length > 0 ? contractPayments : (activeStore?.pagos || [])}
                  onToggleEmployee={handleToggleEmployee}
                  onAddEmployee={handleAddEmployee}
                  onOpenPalette={() => setIsPaletteOpen(true)}
                  alertCount={unreadAlertCount}
                  onOpenAlerts={() => setIsAlertsOpen(true)}
                />
              )}
            </>
          )}

          {/* Vistas de Superadmin */}
          {appMode === 'superadmin' && (
            <>
              {adminTab === 'metricas' && (
                <MetricasTab
                  stores={stores}
                  payments={adminPaymentsList}
                  onGoToTiendas={() => setAdminTab('tiendas')}
                />
              )}

              {adminTab === 'tiendas' && (
                <TiendasTab
                  stores={stores}
                  onOpenStore={(st) => setSelectedStore(st)}
                  onOpenNewStore={() => setIsNewStoreOpen(true)}
                  onImpersonateStore={handleImpersonateStore}
                />
              )}

              {adminTab === 'pagos' && (
                <PagosTab
                  stores={stores}
                  payments={adminPaymentsList}
                  onRegisterPayment={handleRegisterPayment}
                />
              )}

              {adminTab === 'usuarios' && (
                <UsuariosTab stores={stores} />
              )}

              {adminTab === 'planes' && (
                <PlanesTab stores={stores} />
              )}

              {adminTab === 'comunicados' && (
                <ComunicadosTab />
              )}

              {adminTab === 'auditoria' && (
                <AuditoriaTab />
              )}
            </>
          )}
        </div>
      </div>

      {/* Modales Compartidos */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        products={products}
        sales={sales}
        onSelectProduct={() => {
          setIsGlobalSearchOpen(false);
          setStoreTab('inv');
        }}
        onSelectSale={(s) => {
          setIsGlobalSearchOpen(false);
          setActiveSaleModal({ sale: s, isReceipt: false });
        }}
        onSelectTab={(tab) => {
          setIsGlobalSearchOpen(false);
          setStoreTab(tab);
        }}
      />

      <PaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSave={handleSavePalette}
      />

      <AlertasModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alertas={storeAlerts}
        readSet={readAlerts}
        onMarkRead={handleMarkAlertRead}
        onMarkAllRead={handleMarkAlertsRead}
        onDeleteAlert={handleDeleteAlert}
      />

      {/* Modal de Ticket Térmico, Detalle y Anulación */}
      <TicketModal
        isOpen={Boolean(activeSaleModal)}
        onClose={() => setActiveSaleModal(null)}
        sale={activeSaleModal?.sale}
        products={products}
        storeName={storeName}
        storeLogo={storeLogo}
        isReceipt={activeSaleModal?.isReceipt}
        onVoidSale={handleVoidSale}
        canVoid={role === 'dueno' || isSuperadmin}
      />


      {/* Modales de Superadmin */}
      <DetalleTiendaModal
        isOpen={Boolean(selectedStore)}
        onClose={() => setSelectedStore(null)}
        store={selectedStore}
        profiles={adminProfiles}
        onRegisterPayment={handleRegisterPayment}
        onToggleSuspension={handleToggleSuspension}
        onToggleModule={handleToggleModule}
        onAssignOwner={handleAssignOwner}
        onUpdatePaymentMethods={handleUpdatePaymentMethods}
        onUpdatePlan={handleUpdateStorePlan}
        onImpersonateStore={handleImpersonateStore}
        onExportStoreData={handleExportStoreData}
      />

      <NuevaTiendaModal
        isOpen={isNewStoreOpen}
        onClose={() => setIsNewStoreOpen(false)}
        onCreateStore={handleCreateStore}
        profiles={adminProfiles}
      />

      {/* Indicador de Conexión a Internet */}
      <NetworkStatusIndicator />

      {/* Notificación Toast */}
      <Toast message={toastMessage} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
