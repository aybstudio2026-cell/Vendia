import React, { useState, useEffect, useRef } from 'react';
import { money, normalizeSearch } from '../../constants/palettes';
import {
  IconSearch,
  IconTag,
  IconReceipt,
  IconVender,
  IconInventario,
  IconVentas,
  IconReportes,
  IconNegocio,
  IconResumen,
  IconPalette,
  IconSun,
  IconMoon
} from './Icons';

export default function GlobalSearchModal({
  isOpen,
  onClose,
  products = [],
  sales = [],
  onSelectTab,
  onSelectSale,
  onOpenPalette,
  toggleTheme,
  theme = 'light'
}) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('todos'); // 'todos' | 'productos' | 'ventas' | 'acciones'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lista de acciones del sistema
  const systemActions = [
    {
      id: 'act-vender',
      type: 'action',
      title: 'Punto de Venta (Caja)',
      subtitle: 'Registrar una nueva venta o cobrar',
      icon: IconVender,
      action: () => {
        if (onSelectTab) onSelectTab('ven');
        onClose();
      }
    },
    {
      id: 'act-inventario',
      type: 'action',
      title: 'Inventario de Productos',
      subtitle: 'Gestionar catálogo, stock y precios',
      icon: IconInventario,
      action: () => {
        if (onSelectTab) onSelectTab('inv');
        onClose();
      }
    },
    {
      id: 'act-ventas',
      type: 'action',
      title: 'Historial de Ventas',
      subtitle: 'Ver tickets, comprobantes y anulaciones',
      icon: IconVentas,
      action: () => {
        if (onSelectTab) onSelectTab('vta');
        onClose();
      }
    },
    {
      id: 'act-resumen',
      type: 'action',
      title: 'Resumen General',
      subtitle: 'Dashboard y estadísticas de hoy',
      icon: IconResumen,
      action: () => {
        if (onSelectTab) onSelectTab('res');
        onClose();
      }
    },
    {
      id: 'act-reportes',
      type: 'action',
      title: 'Reportes y Métricas',
      subtitle: 'Análisis financiero y rentabilidad',
      icon: IconReportes,
      action: () => {
        if (onSelectTab) onSelectTab('rep');
        onClose();
      }
    },
    {
      id: 'act-negocio',
      type: 'action',
      title: 'Configuración del Negocio',
      subtitle: 'Datos de tienda, comprobantes y empleados',
      icon: IconNegocio,
      action: () => {
        if (onSelectTab) onSelectTab('neg');
        onClose();
      }
    },
    {
      id: 'act-palette',
      type: 'action',
      title: 'Personalizar Colores',
      subtitle: 'Cambiar paleta visual de la tienda',
      icon: IconPalette,
      action: () => {
        if (onOpenPalette) onOpenPalette();
        onClose();
      }
    },
    {
      id: 'act-theme',
      type: 'action',
      title: theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
      subtitle: 'Alternar tema visual de la pantalla',
      icon: theme === 'dark' ? IconSun : IconMoon,
      action: () => {
        if (toggleTheme) toggleTheme();
        onClose();
      }
    }
  ];

  const term = normalizeSearch(query.trim());

  // Filtrado de productos
  const matchedProducts = products.filter((p) => {
    if (!term) return false;
    const nameMatch = normalizeSearch(p.nombre).includes(term);
    const barcodeMatch = p.codigo_barras && String(p.codigo_barras).toLowerCase().includes(term);
    const catMatch = normalizeSearch(p.categoria || '').includes(term);
    return nameMatch || barcodeMatch || catMatch;
  }).slice(0, 5);

  // Filtrado de ventas / tickets
  const matchedSales = sales.filter((s) => {
    if (!term) return false;
    const folioStr = String(s.folio || s.id || '').toLowerCase();
    const cleanTerm = term.replace(/^#/, '');
    const folioMatch = folioStr.includes(cleanTerm);
    const clientMatch = normalizeSearch(s.cliente_nombre || '').includes(term);
    const metodoMatch = normalizeSearch(s.metodo_pago || '').includes(term);
    return folioMatch || clientMatch || metodoMatch;
  }).slice(0, 4);

  // Filtrado de acciones
  const matchedActions = systemActions.filter((a) => {
    if (!term) return true;
    return (
      normalizeSearch(a.title).includes(term) ||
      normalizeSearch(a.subtitle).includes(term)
    );
  }).slice(0, term ? 4 : 6);

  // Agrupación de resultados según filtro
  const filteredItems = [];

  if (activeFilter === 'todos' || activeFilter === 'productos') {
    matchedProducts.forEach((p) => {
      filteredItems.push({
        type: 'product',
        id: `p-${p.id}`,
        raw: p,
        title: p.nombre,
        subtitle: `${p.categoria || 'General'} · Stock: ${p.stock ?? 0}`,
        meta: money(p.precio_venta || 0),
        isOut: (p.stock || 0) <= 0,
        action: () => {
          if (onSelectTab) onSelectTab('inv');
          onClose();
        }
      });
    });
  }

  if (activeFilter === 'todos' || activeFilter === 'ventas') {
    matchedSales.forEach((s) => {
      filteredItems.push({
        type: 'sale',
        id: `s-${s.id}`,
        raw: s,
        title: `Ticket #${s.folio || String(s.id).slice(0, 6)}`,
        subtitle: `${s.metodo_pago ? s.metodo_pago.toUpperCase() : 'VENTA'} · ${s.fecha ? new Date(s.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Hoy'}`,
        meta: money(s.total || 0),
        action: () => {
          if (onSelectSale) onSelectSale(s);
          onClose();
        }
      });
    });
  }

  if (activeFilter === 'todos' || activeFilter === 'acciones') {
    matchedActions.forEach((a) => {
      filteredItems.push(a);
    });
  }

  // Manejo de teclado (flechas y Enter)
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '60px 16px 20px',
        animation: 'fadeIn 0.15s ease-out',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--paper)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px color-mix(in srgb, var(--ember) 12%, transparent)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Búsqueda Superior */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderBottom: '1px solid var(--mist)',
            background: 'var(--paper)'
          }}
        >
          <IconSearch size={20} style={{ color: 'var(--ember)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar producto, ticket, venta o acción..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--ink)',
              padding: 0,
              minHeight: 'auto',
              outline: 'none',
              boxShadow: 'none'
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                if (inputRef.current) inputRef.current.focus();
              }}
              style={{
                background: 'var(--fog)',
                border: '1px solid var(--mist)',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: 'var(--graphite)',
                cursor: 'pointer',
                padding: 0
              }}
              title="Borrar"
            >
              ✕
            </button>
          ) : (
            <kbd
              style={{
                background: 'var(--fog)',
                border: '1px solid var(--mist)',
                padding: '2px 6px',
                borderRadius: '5px',
                fontSize: '11px',
                color: 'var(--graphite)',
                fontFamily: 'monospace'
              }}
            >
              ESC
            </kbd>
          )}
        </div>

        {/* Filtros de Categoría */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 18px',
            background: 'var(--fog)',
            borderBottom: '1px solid var(--mist)'
          }}
        >
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'productos', label: `Productos (${matchedProducts.length})` },
            { id: 'ventas', label: `Ventas (${matchedSales.length})` },
            { id: 'acciones', label: 'Acciones' }
          ].map((f) => {
            const isSelected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFilter(f.id);
                  setSelectedIndex(0);
                }}
                style={{
                  fontSize: '11.5px',
                  fontWeight: isSelected ? '700' : '500',
                  padding: '4px 10px',
                  borderRadius: '14px',
                  background: isSelected ? 'var(--ember)' : 'transparent',
                  color: isSelected ? 'var(--onacc)' : 'var(--graphite)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Lista de Resultados */}
        <div
          style={{
            maxHeight: '340px',
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--graphite)'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
              <b style={{ color: 'var(--ink)', fontSize: '13.5px', display: 'block', marginBottom: '4px' }}>
                No se encontraron resultados
              </b>
              <span style={{ fontSize: '12px' }}>
                Prueba buscando por nombre de producto, código de barras o folio de ticket.
              </span>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--ember) 10%, var(--paper))'
                      : 'transparent',
                    border: isSelected
                      ? '1px solid color-mix(in srgb, var(--ember) 35%, transparent)'
                      : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    textAlign: 'left',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Icono del tipo */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background:
                        item.type === 'product'
                          ? 'rgba(59, 130, 246, 0.12)'
                          : item.type === 'sale'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'color-mix(in srgb, var(--ember) 14%, transparent)',
                      color:
                        item.type === 'product'
                          ? '#2563eb'
                          : item.type === 'sale'
                          ? '#059669'
                          : 'var(--ember)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {item.type === 'product' ? (
                      <IconTag size={16} />
                    ) : item.type === 'sale' ? (
                      <IconReceipt size={16} />
                    ) : item.icon ? (
                      <item.icon size={16} />
                    ) : (
                      <IconSearch size={16} />
                    )}
                  </div>

                  {/* Textos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--graphite)',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.subtitle}
                    </div>
                  </div>

                  {/* Meta (Precio / Folio / Badge) */}
                  {item.meta && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <b style={{ fontSize: '12.5px', color: 'var(--ink)' }}>
                        {item.meta}
                      </b>
                      {item.isOut && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: '10px',
                            fontWeight: '700',
                            color: '#ef4444',
                            marginTop: '1px'
                          }}
                        >
                          Agotado
                        </span>
                      )}
                    </div>
                  )}

                  {/* Flechita o Enter */}
                  {isSelected && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--ember)',
                        fontWeight: '700',
                        flexShrink: 0,
                        marginLeft: '4px'
                      }}
                    >
                      ↵
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer con Atajos */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--mist)',
            background: 'var(--fog)',
            fontSize: '11px',
            color: 'var(--graphite)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>
              <kbd style={{ background: 'var(--paper)', border: '1px solid var(--mist)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>↑</kbd>{' '}
              <kbd style={{ background: 'var(--paper)', border: '1px solid var(--mist)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>↓</kbd> navegar
            </span>
            <span>
              <kbd style={{ background: 'var(--paper)', border: '1px solid var(--mist)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>↵</kbd> abrir
            </span>
            <span>
              <kbd style={{ background: 'var(--paper)', border: '1px solid var(--mist)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>esc</kbd> cerrar
            </span>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: '600', color: 'var(--pewter)' }}>
            Vendia Smart Search
          </span>
        </div>
      </div>
    </div>
  );
}
