import React from 'react';
import VendiaLogo from './VendiaLogo';
import {
  IconResumen,
  IconVender,
  IconInventario,
  IconVentas,
  IconNegocio,
  IconTiendas,
  IconPagos,
  IconShield,
  IconReportes,
  IconDashboard,
  IconUsers,
  IconMegaphone,
  IconPlanes,
  IconAuditoria,
  IconLogout
} from './Icons';

const ICON_MAP = {
  res: IconResumen,
  ven: IconVender,
  inv: IconInventario,
  vta: IconVentas,
  rep: IconReportes,
  neg: IconNegocio,
  metricas: IconDashboard,
  tiendas: IconTiendas,
  pagos: IconPagos,
  usuarios: IconUsers,
  planes: IconPlanes,
  comunicados: IconMegaphone,
  auditoria: IconAuditoria
};

export default function Sidebar({
  brand = "Mi tienda",
  logo = null,
  userName = "Usuario",
  onSignOut = null,
  tabs = [],
  activeTab,
  onSelectTab,
  isSuperadmin = false,
  appMode = 'tienda',
  onToggleAppMode,
  userStores = [],
  activeStoreId = null,
  onSwitchStore = null,
  isCollapsed = false,
  onToggleCollapse = null
}) {
  const [isStoreModalOpen, setIsStoreModalOpen] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isStoreModalOpen) {
        setIsStoreModalOpen(false);
      }
    }
    if (isStoreModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStoreModalOpen]);

  const displayName = userName
    ? (userName.toLowerCase().startsWith('abraham')
        ? 'Abraham'
        : userName.split(/[@._\d]/)[0].charAt(0).toUpperCase() + userName.split(/[@._\d]/)[0].slice(1))
    : 'Abraham';
  return (
    <nav
      aria-label="Secciones"
      className={isCollapsed ? 'is-collapsed' : ''}
    >
      {appMode === 'superadmin' ? (
        isCollapsed ? (
          /* Cabecera Colapsada: Solo Monograma 'V' centrado */
          <div
            style={{
              padding: '6px 0 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'transform 0.15s ease'
              }}
              title="Expandir barra lateral"
              aria-label="Expandir barra lateral"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <VendiaLogo variant="icon" size={32} />
            </button>
          </div>
        ) : (
          /* Cabecera Desplegada: Al presionar el logo se recoge (colapsa) el sidebar */
          <div
            style={{
              padding: '6px 2px 18px',
              display: 'flex',
              alignItems: 'center',
              marginBottom: '10px'
            }}
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '10px',
                transition: 'all 0.15s ease',
                textAlign: 'left'
              }}
              title="Colapsar barra lateral"
              aria-label="Colapsar barra lateral"
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.85';
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <VendiaLogo variant="full" size={36} />
            </button>
          </div>
        )
      ) : (
        <div
          className="brand"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '10px 8px 18px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {logo ? (
            <img
              src={logo}
              alt={brand}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                display: 'block'
              }}
            />
          ) : (
            <span
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--ember)',
                color: 'var(--onacc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '20px',
                letterSpacing: '-0.02em',
                boxShadow: '0 6px 20px color-mix(in srgb, var(--ember) 40%, transparent)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                flexShrink: 0
              }}
            >
              {brand.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'M'}
            </span>
          )}

          <div style={{ marginTop: '12px', width: '100%', overflow: 'hidden' }}>
            <b
              style={{
                display: 'block',
                fontSize: '15px',
                fontWeight: '700',
                color: '#ffffff',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.25
              }}
              title={brand}
            >
              {brand}
            </b>
            <span
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.65)',
                marginTop: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={displayName}
            >
              {displayName}
            </span>

            {/* Píldora interactiva sin emojis para abrir el modal centrado */}
            {!isCollapsed && userStores && userStores.length > 1 && onSwitchStore && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    color: 'rgba(255, 255, 255, 0.92)',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    outline: 'none',
                    maxWidth: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.92)';
                  }}
                  title="Cambiar de tienda"
                  aria-label="Cambiar de tienda"
                >
                  <span>{userStores.length} tiendas</span>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.8 }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Centrado en Pantalla con la Paleta de la Vista Tienda / Resumen */}
      {isStoreModalOpen && !isCollapsed && userStores && userStores.length > 1 && onSwitchStore && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setIsStoreModalOpen(false)}
        >
          <div
            className="card"
            style={{
              background: 'var(--paper)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.45)',
              width: '100%',
              maxWidth: '430px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: '22px 24px',
              boxSizing: 'border-box',
              animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              textAlign: 'left'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '14px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3
                    style={{
                      fontSize: '17px',
                      fontWeight: '700',
                      color: 'var(--ink)',
                      margin: 0,
                      letterSpacing: '-0.01em'
                    }}
                  >
                    Tus Tiendas
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      background: 'color-mix(in srgb, var(--ember) 14%, transparent)',
                      color: 'var(--ember)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid color-mix(in srgb, var(--ember) 25%, transparent)'
                    }}
                  >
                    {userStores.length} disponibles
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--graphite)',
                    margin: '4px 0 0',
                    fontWeight: '500'
                  }}
                >
                  Selecciona la tienda que deseas administrar
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsStoreModalOpen(false)}
                style={{
                  background: 'var(--fog)',
                  border: '1px solid var(--mist)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--graphite)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ink)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--graphite)';
                  e.currentTarget.style.borderColor = 'var(--mist)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Cerrar modal"
                aria-label="Cerrar modal"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Lista scrollable de tiendas */}
            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px'
              }}
            >
              {userStores.map((st) => {
                const isActive =
                  (activeStoreId && String(st.id) === String(activeStoreId)) ||
                  (!activeStoreId && userStores[0]?.id === st.id);
                const storeLogoSrc = st.logo_url || st.logo;
                const initials =
                  st.nombre
                    ?.trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase() || 'T';

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onSwitchStore(st.id);
                      setIsStoreModalOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: isActive
                        ? 'color-mix(in srgb, var(--ember) 10%, var(--paper))'
                        : 'var(--fog)',
                      border: isActive
                        ? '1.5px solid var(--ember)'
                        : '1px solid var(--mist)',
                      cursor: 'pointer',
                      transition: 'all 0.16s ease',
                      textAlign: 'left',
                      boxSizing: 'border-box'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--ember) 6%, var(--fog))';
                        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ember) 35%, var(--mist))';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--fog)';
                        e.currentTarget.style.borderColor = 'var(--mist)';
                      }
                    }}
                  >
                    {storeLogoSrc ? (
                      <img
                        src={storeLogoSrc}
                        alt={st.nombre}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: isActive
                            ? '2px solid var(--ember)'
                            : '1.5px solid var(--border)'
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: isActive
                            ? 'var(--ember)'
                            : 'color-mix(in srgb, var(--ink) 10%, transparent)',
                          color: isActive ? 'var(--onacc)' : 'var(--ink)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '13px',
                          flexShrink: 0,
                          border: isActive
                            ? '2px solid var(--ember)'
                            : '1.5px solid var(--border)'
                        }}
                      >
                        {initials}
                      </span>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: isActive ? '700' : '600',
                          color: 'var(--ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.3
                        }}
                        title={st.nombre}
                      >
                        {st.nombre}
                      </div>
                      {isActive ? (
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: 'var(--ember)',
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--ember)',
                              boxShadow: '0 0 6px var(--ember)',
                              display: 'inline-block'
                            }}
                          />
                          Activa ahora
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--graphite)',
                            marginTop: '2px'
                          }}
                        >
                          Hacer clic para cambiar
                        </div>
                      )}
                    </div>

                    {isActive ? (
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'color-mix(in srgb, var(--ember) 18%, transparent)',
                          color: 'var(--ember)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: '800',
                          marginLeft: 'auto',
                          flexShrink: 0
                        }}
                      >
                        ✓
                      </div>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--graphite)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.6 }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pestañas de Navegación */}
      <div className="nav-tabs-wrapper">
        {tabs.map((tab) => {
          const IconComp = ICON_MAP[tab.id] || IconResumen;
          return (
            <button
              key={tab.id}
              type="button"
              className="nav-link"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => onSelectTab(tab.id)}
              title={tab.label}
              aria-label={tab.label}
            >
              <span className="nav-icon">
                <IconComp size={isCollapsed ? 20 : 18} />
              </span>
              <span className="nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer corporativo de Vendia en modo superadmin */}
      {appMode === 'superadmin' && (
        isCollapsed ? (
          /* Footer en modo colapsado */
          <div
            style={{
              marginTop: 'auto',
              marginBottom: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 229, 255, 0.1)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                color: '#00E5FF',
                fontSize: '10px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px rgba(0, 229, 255, 0.15)'
              }}
              title="Vendia SaaS Core v2.4 · by A&B Studio"
            >
              v2.4
            </span>

            {isSuperadmin && onToggleAppMode && (
              <button
                type="button"
                className="btn o s"
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#94a3b8'
                }}
                onClick={onToggleAppMode}
                title="Cambiar a Vista Tienda"
                aria-label="Cambiar a Vista Tienda"
              >
                <IconTiendas size={18} />
              </button>
            )}
          </div>
        ) : (
          /* Footer en modo expandido */
          <div
            style={{
              marginTop: 'auto',
              marginBottom: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.08) 0%, rgba(0, 229, 255, 0.08) 100%)',
              border: '1px solid rgba(0, 229, 255, 0.22)',
              fontSize: '11px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '700', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00E5FF', display: 'inline-block', boxShadow: '0 0 8px #00E5FF' }}></span>
                Vendia SaaS Core
              </span>
              <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0, 229, 255, 0.15)', color: '#00E5FF', border: '1px solid rgba(0, 229, 255, 0.3)' }}>
                v2.4
              </span>
            </div>
            <div style={{ color: '#94A3B8', fontSize: '10px', marginTop: '4px', fontWeight: '500' }}>
              Powered by A&B Studio · Enterprise
            </div>
          </div>
        )
      )}

      {/* Pie de la barra lateral (Modo tienda) */}
      {appMode === 'tienda' && (
        <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Botón exclusivo para Superadmin para ir al panel general */}
          {isSuperadmin && onToggleAppMode && (
            <button
              type="button"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12.5px',
                fontWeight: '600',
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'rgba(0, 229, 255, 0.08)',
                border: '1px solid rgba(0, 229, 255, 0.28)',
                color: '#00e5ff',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onClick={onToggleAppMode}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.16)';
                e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.45)';
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 229, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.28)';
                e.currentTarget.style.color = '#00e5ff';
                e.currentTarget.style.boxShadow = 'none';
              }}
              title="Ir al Panel de Administración Vendia"
              aria-label="Ir al Panel de Administración Vendia"
            >
              <IconShield size={16} />
              <span>Panel Admin</span>
            </button>
          )}

          {/* Botón Salir para todos los usuarios */}
          {onSignOut && (
            <button
              type="button"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '600',
                padding: '9px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onClick={onSignOut}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                e.currentTarget.style.color = '#f87171';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
              title="Cerrar sesión"
            >
              <IconLogout size={16} />
              <span>Salir</span>
            </button>
          )}
        </div>
      )}

      {/* Switcher para Superadmin al pie de la barra lateral (Solo cuando está en modo superadmin) */}
      {!isCollapsed && isSuperadmin && onToggleAppMode && appMode === 'superadmin' && (
        <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: 'auto' }}>
          <button
            type="button"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: '600',
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: 'rgba(255, 255, 255, 0.85)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={onToggleAppMode}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
            }}
          >
            <IconTiendas size={14} />
            <span>Vista Tienda</span>
          </button>
        </div>
      )}
    </nav>
  );
}
