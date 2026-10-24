import React, { useState, useEffect } from 'react';

/**
 * Indicador de estado de conexión a internet
 * Alerta sutilmente si el navegador pierde conexión.
 */
export default function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        padding: '10px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: '500',
        transition: 'all 0.3s ease',
        background: isOnline ? '#10b981' : '#f59e0b',
        color: '#ffffff'
      }}
    >
      <span>
        {isOnline ? '✓ Conexión a internet restaurada' : '⚠️ Sin conexión a internet (modo lectura local)'}
      </span>
    </div>
  );
}
