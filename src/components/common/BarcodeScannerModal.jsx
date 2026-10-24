import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBeepSuccess } from '../../utils/audio';
import { IconBarcode } from './Icons';

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Escanear Código de Barras",
  continuousDefault = false
}) {
  const [isContinuous, setIsContinuous] = useState(continuousDefault);
  const [cameraError, setCameraError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState(null);
  const [recentScanFlash, setRecentScanFlash] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  const scannerRef = useRef(null);
  const isContinuousRef = useRef(isContinuous);
  const lastScannedTimeRef = useRef(0);
  const lastScannedCodeRef = useRef('');
  const scannerContainerId = "html5-barcode-scanner-viewport";

  // Mantener isContinuousRef actualizado sin necesidad de reiniciar la cámara
  useEffect(() => {
    isContinuousRef.current = isContinuous;
  }, [isContinuous]);

  // Al abrir el modal, sincronizar el modo continuo con el valor por defecto
  useEffect(() => {
    if (isOpen) {
      setIsContinuous(continuousDefault);
      setManualCode('');
      setLastScanned(null);
      setRecentScanFlash(false);
    }
  }, [isOpen, continuousDefault]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsInitializing(true);
    setCameraError(null);

    const timer = setTimeout(async () => {
      try {
        const container = document.getElementById(scannerContainerId);
        if (!container) return;

        // Detectar cámaras disponibles en el dispositivo
        try {
          const devices = await Html5Qrcode.getCameras();
          if (isMounted && devices && devices.length > 0) {
            setCameras(devices);
          }
        } catch (e) {
          // getCameras puede fallar si no hay permisos previos; continuará con facingMode
        }

        // Formatos estándar de retail y bodegas
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport,
          verbose: false
        });
        scannerRef.current = html5QrCode;

        // Omitimos qrbox para escanear en todo el marco y evitar que html5-qrcode
        // dibuje sus propios bordes y zonas oscurecidas (#qr-shaded-region)
        const config = {
          fps: 15,
          aspectRatio: 1.333
        };

        const cameraTarget = cameras.length > 0 && cameras[currentCameraIndex]
          ? cameras[currentCameraIndex].id
          : { facingMode: 'environment' };

        await html5QrCode.start(
          cameraTarget,
          config,
          (decodedText) => {
            if (!isMounted) return;
            const cleanCode = decodedText.trim();
            if (!cleanCode) return;

            const now = Date.now();
            // Prevención de lecturas repetitivas en modo continuo:
            // - Mismo código: requiere al menos 1.8 segundos antes de registrarse nuevamente
            // - Código distinto: requiere al menos 0.7 segundos entre lecturas consecutivas
            if (isContinuousRef.current) {
              if (cleanCode === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 1800) {
                return;
              }
              if (cleanCode !== lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 700) {
                return;
              }
            }

            lastScannedTimeRef.current = now;
            lastScannedCodeRef.current = cleanCode;

            playBeepSuccess();
            setLastScanned(cleanCode);
            setRecentScanFlash(true);

            setTimeout(() => {
              if (isMounted) setRecentScanFlash(false);
            }, 500);

            if (onScan) {
              onScan(cleanCode);
            }

            if (!isContinuousRef.current) {
              setTimeout(() => {
                if (isMounted) onClose();
              }, 350);
            }
          },
          () => {
            // Error por frame no detectado (comportamiento normal mientras busca código)
          }
        );

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('Error al iniciar la cámara para el escáner:', err);
        if (isMounted) {
          setIsInitializing(false);
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Permiso de cámara denegado. Permite el acceso a la cámara en tu navegador para escanear.'
              : 'No se pudo iniciar la cámara en este dispositivo. Puedes ingresar el código manualmente abajo.'
          );
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
            }).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch (e) {}
      }
    };
  }, [isOpen, currentCameraIndex]);

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      setCurrentCameraIndex((prev) => (prev + 1) % cameras.length);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    playBeepSuccess();
    setLastScanned(clean);
    if (onScan) {
      onScan(clean);
    }
    setManualCode('');
    if (!isContinuous) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={440}>
      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        <p className="hint" style={{ margin: 0, fontSize: '13px' }}>
          Apunta la cámara al código de barras o QR del producto.
        </p>
      </div>

      {/* Contenedor del Visor de Cámara */}
      <div
        style={{
          position: 'relative',
          background: '#07090e',
          borderRadius: '14px',
          overflow: 'hidden',
          minHeight: '250px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.08)'
        }}
      >
        <div id={scannerContainerId} style={{ width: '100%', height: '100%' }} />

        {/* Indicador de inicialización */}
        {isInitializing && (
          <div
            style={{
              position: 'absolute',
              color: '#ffffff',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              zIndex: 10
            }}
          >
            <div style={{ animation: 'spin 1s linear infinite', fontSize: '22px' }}>⏳</div>
            <span style={{ fontWeight: 500 }}>Iniciando cámara...</span>
          </div>
        )}

        {/* Botón para alternar cámaras si hay más de una */}
        {cameras.length > 1 && !isInitializing && !cameraError && (
          <button
            type="button"
            onClick={handleSwitchCamera}
            title="Cambiar de cámara"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 20,
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)'
            }}
          >
            🔄 Cambiar cámara
          </button>
        )}

        {/* Retícula visual guía de escaneo única y nítida */}
        {!isInitializing && !cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
          >
            {/* Marco enfocado con efecto viñeta alrededor */}
            <div
              style={{
                position: 'relative',
                width: '84%',
                maxWidth: '280px',
                height: '110px',
                borderRadius: '12px',
                boxShadow: '0 0 0 9999px rgba(5, 7, 13, 0.58)',
                border: recentScanFlash
                  ? '2px solid #10b981'
                  : '1px solid rgba(255, 255, 255, 0.25)',
                transition: 'border 0.2s ease, box-shadow 0.2s ease',
                overflow: 'hidden'
              }}
            >
              {/* 4 esquinas de alta tecnología */}
              <span style={{
                position: 'absolute',
                top: -2,
                left: -2,
                width: '20px',
                height: '20px',
                borderTop: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderLeft: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderTopLeftRadius: '10px'
              }} />
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: '20px',
                height: '20px',
                borderTop: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderRight: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderTopRightRadius: '10px'
              }} />
              <span style={{
                position: 'absolute',
                bottom: -2,
                left: -2,
                width: '20px',
                height: '20px',
                borderBottom: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderLeft: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderBottomLeftRadius: '10px'
              }} />
              <span style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: '20px',
                height: '20px',
                borderBottom: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderRight: `3px solid ${recentScanFlash ? '#10b981' : 'var(--ember)'}`,
                borderBottomRightRadius: '10px'
              }} />

              {/* Láser escáner rojo animado que recorre el marco */}
              {!recentScanFlash && (
                <div
                  style={{
                    position: 'absolute',
                    left: '4%',
                    width: '92%',
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #ef4444 20%, #ff6b6b 50%, #ef4444 80%, transparent)',
                    boxShadow: '0 0 10px #ef4444, 0 0 18px rgba(239, 68, 68, 0.7)',
                    animation: 'scannerLaserMove 2s ease-in-out infinite'
                  }}
                />
              )}

              {/* Destello de confirmación de captura exitosa */}
              {recentScanFlash && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '0.5px'
                  }}
                >
                  ✓ CÓDIGO LEÍDO
                </div>
              )}

              {/* Guía textual en la base del retículo */}
              {!recentScanFlash && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.8)',
                    background: 'rgba(0, 0, 0, 0.55)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Centra el código de barras
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notificación de último código escaneado */}
        {lastScanned && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              zIndex: 20,
              background: 'rgba(16, 185, 129, 0.95)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(4px)',
              animation: 'popIn 0.2s ease'
            }}
          >
            <span>✓ Detectado:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lastScanned}</span>
          </div>
        )}
      </div>

      {/* Alerta de error de cámara */}
      {cameraError && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            color: '#dc2626',
            fontSize: '12px',
            lineHeight: '1.4'
          }}
        >
          {cameraError}
        </div>
      )}

      {/* Tarjeta de Modo Continuo Rediseñada (Sleek Switch Card) */}
      <div
        onClick={() => setIsContinuous(!isContinuous)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setIsContinuous(!isContinuous);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '14px',
          padding: '11px 14px',
          background: isContinuous ? 'rgba(239, 68, 68, 0.08)' : 'var(--fog)',
          border: isContinuous ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--mist)',
          borderRadius: '12px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0, paddingRight: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Modo escaneo continuo
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                padding: '2px 7px',
                borderRadius: '6px',
                background: isContinuous ? 'var(--ember)' : 'var(--mist)',
                color: isContinuous ? '#ffffff' : 'var(--steel)',
                textTransform: 'uppercase'
              }}
            >
              {isContinuous ? 'Activo' : 'Pausado'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--steel)', lineHeight: 1.3 }}>
            {isContinuous
              ? 'La cámara permanece abierta para registrar varios productos'
              : 'Cierra automáticamente tras detectar el primer código'}
          </span>
        </div>

        {/* Switch Moderno animado */}
        <div
          style={{
            position: 'relative',
            width: '44px',
            height: '24px',
            flexShrink: 0,
            background: isContinuous ? 'var(--ember)' : 'var(--mist)',
            borderRadius: '24px',
            transition: 'background-color 0.2s ease'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '3px',
              left: isContinuous ? '23px' : '3px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
              transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
      </div>

      {/* Fallback de ingreso manual de código */}
      <form onSubmit={handleManualSubmit} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder="O escribe / pega el código aquí"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            style={{
              width: '100%',
              height: '42px',
              fontSize: '13px',
              paddingLeft: '36px',
              borderRadius: '10px'
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--steel)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none'
            }}
          >
            <IconBarcode size={16} />
          </div>
        </div>
        <button
          type="submit"
          className="btn p"
          disabled={!manualCode.trim()}
          style={{
            height: '42px',
            padding: '0 18px',
            whiteSpace: 'nowrap',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '10px',
            opacity: manualCode.trim() ? 1 : 0.6
          }}
        >
          Ingresar
        </button>
      </form>

      {/* Botón de cierre */}
      <div style={{ marginTop: '16px' }}>
        <button
          type="button"
          className="btn o"
          style={{
            width: '100%',
            minHeight: '42px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '10px'
          }}
          onClick={onClose}
        >
          Cerrar escáner
        </button>
      </div>
    </Modal>
  );
}
