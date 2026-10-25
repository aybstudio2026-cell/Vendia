import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from './ThemeContext';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const { setPalette, updateCustomPalette } = useTheme();

  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [store, setStore] = useState(null);
  const [primarySede, setPrimarySede] = useState(null);
  const [userStores, setUserStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Guardar ID de tienda cuya paleta ya fue sincronizada para no revertir la paleta del usuario
  const initialPaletteStoreId = useRef(null);

  // Modo Demo para pruebas locales sin forzar registro previo en Supabase Auth
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoRole, setDemoRole] = useState('dueno'); // 'dueno' | 'empleado' | 'superadmin'

  // Pantalla de bienvenida Splash al iniciar sesión exitosamente
  const [isLoginSplashActive, setIsLoginSplashActive] = useState(false);

  // Cargar datos de perfil, membresía y tienda desde Supabase
  const loadUserData = useCallback(async (currentUser) => {
    try {
      if (!currentUser) {
        initialPaletteStoreId.current = null;
        setProfile(null);
        setMembership(null);
        setStore(null);
        setPrimarySede(null);
        return;
      }

      // 1. Obtener perfil
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (perfilError && perfilError.code !== 'PGRST116') {
        console.error('Error al cargar perfil:', perfilError);
      }

      // La bandera es_superadmin se lee prioritariamente desde los app_metadata del JWT (gestionados solo con service_role_key)
      const isSuperadminFromAppMetadata = Boolean(
        currentUser?.app_metadata?.es_superadmin === true ||
        currentUser?.app_metadata?.role === 'superadmin' ||
        perfilData?.es_superadmin
      );

      setProfile(perfilData ? { ...perfilData, es_superadmin: isSuperadminFromAppMetadata } : null);

      // 2. Obtener todas las membresías activas del usuario (para permitir selector multitienda)
      let targetStoreId = null;
      let availableStores = [];

      let miembrosRows = [];
      try {
        const { data: todosMiembros, error: miembrosError } = await supabase
          .from('miembros')
          .select(`
            id,
            rol,
            tienda_id,
            tiendas (
              id,
              nombre,
              logo_url,
              paleta,
              paleta_custom
            )
          `)
          .eq('usuario_id', currentUser.id)
          .eq('activo', true)
          .order('creado_en', { ascending: false });

        if (miembrosError) throw miembrosError;
        miembrosRows = todosMiembros || [];
      } catch (err) {
        console.warn('Aviso al obtener miembros con relaciones, reintentando básico:', err.message);
        try {
          const { data: basicMiembros } = await supabase
            .from('miembros')
            .select('id, rol, tienda_id')
            .eq('usuario_id', currentUser.id)
            .eq('activo', true);

          if (basicMiembros && basicMiembros.length > 0) {
            const tIds = basicMiembros.map((m) => m.tienda_id);
            const { data: storesList } = await supabase
              .from('tiendas')
              .select('*')
              .in('id', tIds);

            const sMap = {};
            (storesList || []).forEach((st) => { sMap[st.id] = st; });

            miembrosRows = basicMiembros.map((m) => ({
              ...m,
              tiendas: sMap[m.tienda_id] || { id: m.tienda_id, nombre: 'Mi Tienda' }
            }));
          }
        } catch (retryErr) {
          console.error('Error al reintentar miembros:', retryErr);
        }
      }

      if (miembrosRows && miembrosRows.length > 0) {
        availableStores = miembrosRows.map((m) => ({
          id: m.tienda_id,
          nombre: m.tiendas?.nombre || 'Mi Tienda',
          rol: m.rol,
          membership: m,
          logo_url: m.tiendas?.logo_url,
          paleta: m.tiendas?.paleta,
          paleta_custom: m.tiendas?.paleta_custom
        }));
      }

      // Si no tiene membresías directas, invocar la función de base de datos con SECURITY DEFINER
      // para vincular contratos existentes de forma segura sin exponer tablas ni inserciones directas
      if (availableStores.length === 0 && currentUser.email) {
        try {
          const { data: linkedStores, error: rpcErr } = await supabase.rpc('vincular_usuario_contratos', {
            p_usuario_id: currentUser.id,
            p_email: currentUser.email.trim()
          });

          if (!rpcErr && linkedStores && linkedStores.length > 0) {
            linkedStores.forEach((st) => {
              if (st && st.tienda_id) {
                availableStores.push({
                  id: st.tienda_id,
                  nombre: st.nombre || 'Mi Tienda',
                  rol: st.rol || 'dueno',
                  membership: { id: `auto-${st.tienda_id}`, rol: st.rol || 'dueno', tienda_id: st.tienda_id },
                  logo_url: st.logo_url,
                  paleta: st.paleta,
                  paleta_custom: st.paleta_custom
                });
              }
            });
          }
        } catch (contractErr) {
          console.warn('Aviso al invocar función segura de vinculación de contratos en BD:', contractErr);
        }
      }

      // Si es superadmin (verificado en app_metadata del JWT), listar las tiendas globales para permitir gestionarlas
      if (isSuperadminFromAppMetadata) {
        try {
          const { data: allStores, error: allErr } = await supabase
            .from('tiendas')
            .select('*')
            .order('creado_en', { ascending: false })
            .limit(20);

          if (!allErr && allStores && allStores.length > 0) {
            allStores.forEach((st) => {
              if (!availableStores.some((s) => s.id === st.id)) {
                availableStores.push({
                  id: st.id,
                  nombre: st.nombre,
                  rol: 'dueno',
                  membership: { id: `sa-${st.id}`, rol: 'dueno', tienda_id: st.id },
                  logo_url: st.logo_url,
                  paleta: st.paleta,
                  paleta_custom: st.paleta_custom
                });
              }
            });
          }
        } catch (allStoresErr) {
          console.warn('Aviso al cargar tiendas globales para superadmin:', allStoresErr);
        }
      }

      setUserStores(availableStores);

      // Selección de tienda: verificar si el usuario tiene una tienda activa guardada en localStorage
      const savedActiveStoreId = localStorage.getItem('active_store_id');
      // Descartar IDs de demo en sesión autenticada real
      const cleanSavedId = savedActiveStoreId && !savedActiveStoreId.startsWith('demo') ? savedActiveStoreId : null;
      if (savedActiveStoreId && savedActiveStoreId.startsWith('demo')) {
        localStorage.removeItem('active_store_id');
      }

      const matchedStore = cleanSavedId ? availableStores.find((s) => s.id === cleanSavedId) : null;

      // Preferir una tienda donde sea miembro directo antes que una tienda arbitraria de superadmin
      const directMembershipStore = availableStores.find((s) => !String(s.membership?.id || '').startsWith('sa-'));

      const activeStoreEntry = matchedStore || directMembershipStore || availableStores[0];

      if (activeStoreEntry) {
        targetStoreId = activeStoreEntry.id;
        setMembership(activeStoreEntry.membership || { rol: activeStoreEntry.rol, tienda_id: targetStoreId });
        localStorage.setItem('active_store_id', targetStoreId);
      }

      // 3. Cargar datos de la tienda seleccionada y su sede principal
      if (targetStoreId) {
        const { data: tiendaData, error: tiendaError } = await supabase
          .from('tiendas')
          .select('*')
          .eq('id', targetStoreId)
          .single();

        if (tiendaError) {
          console.error('Error al cargar tienda:', tiendaError);
        } else if (tiendaData) {
          const { data: tmData } = await supabase
            .from('tienda_modulos')
            .select('modulo_codigo, activo')
            .eq('tienda_id', targetStoreId);

          let storeModulos = ['inventario', 'ventas'];
          if (tmData && tmData.length > 0) {
            storeModulos = tmData
              .filter((m) => m.activo !== false)
              .map((m) => m.modulo_codigo);
          }
          tiendaData.modulos = storeModulos;
          setStore(tiendaData);

          if (initialPaletteStoreId.current !== tiendaData.id) {
            initialPaletteStoreId.current = tiendaData.id;
            const savedLocal = localStorage.getItem('store_palette');
            if (tiendaData.paleta && tiendaData.paleta !== 'brex') {
              setPalette(tiendaData.paleta);
              if (tiendaData.paleta === 'custom' && tiendaData.paleta_custom) {
                updateCustomPalette(tiendaData.paleta_custom);
              }
            } else if (savedLocal && savedLocal !== 'brex') {
              setPalette(savedLocal);
            } else if (tiendaData.paleta) {
              setPalette(tiendaData.paleta);
            }
          }
        }

        let sedeData = null;
        try {
          const { data: sData } = await supabase
            .from('sedes')
            .select('*')
            .eq('tienda_id', targetStoreId)
            .limit(1)
            .maybeSingle();

          sedeData = sData;
        } catch (sErr) {
          console.warn('Aviso al obtener sede:', sErr);
        }

        setPrimarySede(sedeData || null);
      }
    } catch (err) {
      console.error('Error en loadUserData:', err);
    } finally {
      setLoading(false);
    }
  }, [setPalette, updateCustomPalette]);

  // Mantener referencia estable para el listener de autenticación
  const loadUserDataRef = useRef(loadUserData);
  useEffect(() => {
    loadUserDataRef.current = loadUserData;
  }, [loadUserData]);

  // Escuchar cambios de sesión de Supabase Auth
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user || null);
          if (currentSession?.user) {
            await loadUserDataRef.current(currentSession.user);
          } else {
            setLoading(false);
          }
        }
      } catch (e) {
        console.error('Error al iniciar sesión:', e);
        if (mounted) setLoading(false);
      }
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user || null);
        if (newSession?.user) {
          if (event === 'SIGNED_IN') {
            await loadUserDataRef.current(newSession.user);
          } else {
            // Actualización en segundo plano sin interrumpir la interacción del usuario
            loadUserDataRef.current(newSession.user);
          }
        } else {
          initialPaletteStoreId.current = null;
          setProfile(null);
          setMembership(null);
          setStore(null);
          setPrimarySede(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Iniciar sesión con email y contraseña
  const signInWithPassword = async (email, password) => {
    setIsDemoMode(false);
    const saved = localStorage.getItem('active_store_id');
    if (saved && saved.startsWith('demo')) {
      localStorage.removeItem('active_store_id');
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setLoading(false);
      throw error;
    }
    // Activar pantalla de bienvenida (Splash con Watermark) tras inicio de sesión exitoso
    setIsLoginSplashActive(true);
    return data;
  };

  // Cerrar sesión
  const signOut = async () => {
    setIsLoginSplashActive(false);
    initialPaletteStoreId.current = null;
    setIsDemoMode(false);
    setSession(null);
    setUser(null);
    setProfile(null);
    setMembership(null);
    setStore(null);
    setPrimarySede(null);
    localStorage.removeItem('active_store_id');
    await supabase.auth.signOut();
  };

  // Actualizar paleta en el estado local de la tienda sin forzar reload
  const updateStorePalette = useCallback((newPal, custom = null) => {
    setStore((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paleta: newPal,
        paleta_custom: custom || prev.paleta_custom
      };
    });
  }, []);

  // Actualizar módulos activos en el estado local de la tienda
  const updateStoreModules = useCallback((newModulos) => {
    setStore((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modulos: newModulos
      };
    });
  }, []);

  // Recuperar contraseña
  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    return data;
  };

  // Entorno seguro: modo demo restringido a desarrollo o explícitamente habilitado por variable de entorno
  const isDemoAllowed = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true';

  // Entrar al modo Demo
  const enterDemoMode = (initialRole = 'dueno') => {
    if (!isDemoAllowed) {
      console.warn('El modo demo está deshabilitado en este entorno de producción.');
      return;
    }
    // Activar pantalla de bienvenida (Splash con Watermark) al iniciar sesión en demo
    setIsLoginSplashActive(true);
    setIsDemoMode(true);
    setDemoRole(initialRole);
    setLoading(false);
  };

  // Cambiar rol dentro del modo Demo
  const switchDemoRole = (newRole) => {
    if (!isDemoAllowed) return;
    setDemoRole(newRole);
  };

  // Selector multitienda: cambiar la tienda activa
  const switchStore = async (storeId) => {
    if (!storeId) return;
    localStorage.setItem('active_store_id', storeId);
    if (isDemoMode) {
      setStore((prev) => ({
        ...(prev || {}),
        id: storeId,
        nombre: storeId === 'demo-2' ? 'Bodega Don Pepe' : 'Minimarket La Esquina'
      }));
      return;
    }
    await loadUserData(user);
  };

  const effectiveUserStores = isDemoMode
    ? [
        { id: 'demo-1', nombre: 'Minimarket La Esquina', rol: 'dueno' },
        { id: 'demo-2', nombre: 'Bodega Don Pepe', rol: 'dueno' }
      ]
    : userStores;

  // Si el usuario es Superadmin o tiene membresía de dueño, su rol efectivo en la tienda es 'dueno'
  // La condición de superadmin se valida prioritariamente desde los app_metadata del JWT
  const isSuperadmin = isDemoMode
    ? demoRole === 'superadmin'
    : Boolean(
        user?.app_metadata?.es_superadmin === true ||
        user?.app_metadata?.role === 'superadmin' ||
        profile?.es_superadmin
      );

  const storeRole = isDemoMode
    ? (demoRole === 'empleado' ? 'empleado' : 'dueno')
    : (isSuperadmin || membership?.rol === 'dueno')
    ? 'dueno'
    : (membership?.rol || 'empleado');

  const effectiveRole = isDemoMode
    ? demoRole
    : isSuperadmin
    ? 'superadmin'
    : storeRole;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        membership,
        store,
        primarySede,
        userStores: effectiveUserStores,
        switchStore,
        loading,
        isDemoAllowed,
        isDemoMode,
        demoRole,
        effectiveRole,
        storeRole,
        isSuperadmin,
        isLoginSplashActive,
        triggerLoginSplash: () => setIsLoginSplashActive(true),
        dismissLoginSplash: () => setIsLoginSplashActive(false),
        signInWithPassword,
        signOut,
        resetPassword,
        enterDemoMode,
        switchDemoRole,
        updateStorePalette,
        updateStoreModules,
        reloadProfileAndStore: () => loadUserData(user)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  return context;
};
