import React, { useState, useEffect } from 'react';
import {
  getActiveStoreComunicado,
  dismissStoreComunicado,
  fetchSaaSComunicados
} from '../../services/saasService';

export default function BroadcastBanner() {
  const [comunicado, setComunicado] = useState(() => getActiveStoreComunicado());

  const refreshComunicado = () => {
    const active = getActiveStoreComunicado();
    setComunicado(active);
  };

  useEffect(() => {
    // 1. Mostrar de inmediato según la caché local
    refreshComunicado();

    // 2. Traer los comunicados actualizados de Supabase
    fetchSaaSComunicados()
      .then(() => {
        refreshComunicado();
      })
      .catch((e) => console.warn('Aviso sincronizando comunicados en tienda:', e));

    // 3. Escuchar cambios de almacenamiento (por si el admin edita o restablece avisos)
    const handleStorageChange = () => {
      refreshComunicado();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  if (!comunicado) return null;

  const handleDismiss = () => {
    dismissStoreComunicado(comunicado.id);
    refreshComunicado();
  };

  const getEmoji = (t) => {
    switch (t) {
      case 'novedad': return '🚀';
      case 'alerta': return '⚠️';
      case 'urgente': return '🛑';
      default: return '📢';
    }
  };

  const getBannerStyle = (tipo) => {
    switch (tipo) {
      case 'novedad':
        return {
          background: 'linear-gradient(90deg, #065f46 0%, #047857 100%)',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.15)'
        };
      case 'alerta':
        return {
          background: 'linear-gradient(90deg, #92400e 0%, #b45309 100%)',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.15)'
        };
      case 'urgente':
        return {
          background: 'linear-gradient(90deg, #991b1b 0%, #dc2626 100%)',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.15)'
        };
      default:
        return {
          background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        };
    }
  };

  const bannerTheme = getBannerStyle(comunicado.tipo);

  return (
    <div
      className="ann"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        position: 'relative',
        padding: '9px 44px 9px 16px',
        zIndex: 50,
        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        fontSize: '12.5px',
        fontWeight: 500,
        letterSpacing: '0.01em',
        ...bannerTheme
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: '14px' }}>{getEmoji(comunicado.tipo)}</span>
        <strong style={{ fontWeight: 700 }}>{comunicado.titulo}:</strong>
        <span>{comunicado.mensaje}</span>
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar aviso"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255, 255, 255, 0.15)',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          padding: '4px 7px',
          borderRadius: '4px',
          fontSize: '11px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease'
        }}
        title="Entendido / Cerrar este aviso"
      >
        ✕
      </button>
    </div>
  );
}
