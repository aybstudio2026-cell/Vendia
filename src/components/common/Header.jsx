import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  IconPalette,
  IconSun,
  IconMoon,
  IconBell,
  IconLogout,
  IconShield,
  IconMenu,
  IconSearch
} from './Icons';
import GlobalSearchModal from './GlobalSearchModal';

export default function Header({
  storeName = "Minimarket La Esquina",
  storeLogo = null,
  userName = "Carlos Peña",
  role = "dueno",
  onRoleChange,
  alertCount = 0,
  onOpenAlerts,
  onOpenPalette,
  isSuperadmin = false,
  onSignOut,
  isSidebarCollapsed = false,
  onToggleSidebar = null,
  onTriggerSplash = null,
  products = [],
  sales = [],
  onSelectTab = null,
  onSelectSale = null
}) {
  const { theme, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const profileRef = useRef(null);

  // Atajo de teclado global Ctrl+K / Cmd+K para abrir el buscador
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Cerrar el menú desplegable al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  return (
    <div className="top" style={{ position: 'relative' }}>
      {/* Lado izquierdo: Buscador Global Inteligente para la tienda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
        {!isSuperadmin ? (
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '12px',
                background: 'var(--paper)',
                border: '1px solid var(--mist)',
                color: 'var(--graphite)',
                cursor: 'pointer',
                transition: 'all 0.16s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                textAlign: 'left',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--ember)';
                e.currentTarget.style.boxShadow = '0 3px 12px color-mix(in srgb, var(--ember) 12%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--mist)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.03)';
              }}
              title="Buscar en toda la tienda (Ctrl + K)"
              aria-label="Buscar productos, tickets o secciones"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <IconSearch size={15} style={{ color: 'var(--ember)', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--graphite)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Buscar productos, tickets, secciones...
                </span>
              </div>
              <kbd
                style={{
                  background: 'var(--fog)',
                  border: '1px solid var(--mist)',
                  padding: '2px 6px',
                  borderRadius: '5px',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'var(--pewter)',
                  fontFamily: 'monospace',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
              >
                Ctrl K
              </kbd>
            </button>
          </div>
        ) : null}
      </div>

      {/* Lado derecho */}
      <div className="tr" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Selector de rol para modo demostración únicamente */}
        {!isSuperadmin && onRoleChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="role-select" style={{ fontSize: '12px' }}>Ver como</label>
            <select
              id="role-select"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              style={{ minHeight: '36px', padding: '6px 10px', fontSize: '13px' }}
            >
              <option value="dueno">Dueño</option>
              <option value="empleado">Empleado</option>
            </select>
          </div>
        )}

        {/* Botón Paleta (Solo para dueños de tienda comercial) */}
        {!isSuperadmin && role === "dueno" && (
          <button
            type="button"
            className="header-btn"
            onClick={onOpenPalette}
            title="Personalizar paleta de colores de mi tienda"
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--ember)',
                boxShadow: '0 0 6px color-mix(in srgb, var(--ember) 60%, transparent)',
                flexShrink: 0
              }}
            />
            <IconPalette size={16} />
            <span>Paleta</span>
          </button>
        )}

        {/* Botón Modo Oscuro / Claro */}
        <button
          type="button"
          className="header-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
        </button>

        {/* Botón Alertas en Tienda */}
        {!isSuperadmin && (
          <button
            type="button"
            className="header-btn bell-btn"
            onClick={onOpenAlerts}
            aria-label="Ver alertas"
            title="Centro de alertas"
          >
            <IconBell size={16} />
            <span>Alertas</span>
            {alertCount > 0 && (
              <span className="bell-badge">{alertCount}</span>
            )}
          </button>
        )}

        {/* Modal Buscador Global Inteligente */}
        {!isSuperadmin && (
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            products={products}
            sales={sales}
            onSelectTab={onSelectTab}
            onSelectSale={onSelectSale}
            onOpenPalette={onOpenPalette}
            toggleTheme={toggleTheme}
            theme={theme}
          />
        )}

        {/* En Superadmin: Foto de perfil interactiva con letra 'A' y menú desplegable */}
        {isSuperadmin && (
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              aria-expanded={isProfileOpen}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00C853 0%, #00E5FF 100%)',
                color: '#ffffff',
                border: isProfileOpen ? '2px solid #00E5FF' : '2px solid rgba(255, 255, 255, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '16px',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                cursor: 'pointer',
                boxShadow: isProfileOpen
                  ? '0 0 16px rgba(0, 229, 255, 0.65)'
                  : '0 2px 10px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                padding: 0
              }}
              title="Mi cuenta (Administrador)"
            >
              A
            </button>

            {/* Menú flotante del perfil */}
            {isProfileOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  right: 0,
                  width: '240px',
                  background: '#0d1527',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 229, 255, 0.15)',
                  padding: '16px',
                  zIndex: 200,
                  color: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                {/* Cabecera del usuario */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #00C853 0%, #00E5FF 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '18px',
                      flexShrink: 0,
                      boxShadow: '0 0 12px rgba(0, 229, 255, 0.4)'
                    }}
                  >
                    A
                  </div>
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div
                      style={{
                        fontWeight: '700',
                        fontSize: '14px',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={userName}
                    >
                      {userName || 'Administrador'}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(0, 229, 255, 0.14)',
                          color: '#00E5FF',
                          border: '1px solid rgba(0, 229, 255, 0.3)',
                          letterSpacing: '0.04em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00E5FF' }}></span>
                        Superadmin
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    height: '1px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    margin: '14px -16px'
                  }}
                />

                {/* Botón para previsualizar la pantalla de bienvenida / Watermark Splash */}
                {onTriggerSplash && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onTriggerSplash();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '9px 12px',
                      marginBottom: '10px',
                      borderRadius: '10px',
                      background: 'rgba(0, 229, 255, 0.08)',
                      border: '1px solid rgba(0, 229, 255, 0.22)',
                      color: '#00E5FF',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 229, 255, 0.18)';
                      e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.45)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 229, 255, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.22)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>✨</span>
                    <span>Ver pantalla de bienvenida</span>
                  </button>
                )}

                {/* Botón Salir */}
                {onSignOut && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onSignOut();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                      e.currentTarget.style.color = '#f87171';
                    }}
                  >
                    <IconLogout size={16} />
                    <span>Cerrar sesión</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
