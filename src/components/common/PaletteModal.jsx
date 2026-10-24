import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { useTheme } from '../../context/ThemeContext';
import { PALETTES, getCustomSwatches } from '../../constants/palettes';

export default function PaletteModal({ isOpen, onClose, onSave }) {
  const {
    palette,
    setPalette,
    customPalette,
    updateCustomPalette,
    resetCustomPalette
  } = useTheme();

  // Guardar la selección actual del modal y recordar la paleta previa
  const [selectedPal, setSelectedPal] = useState(palette);
  const initialPaletteRef = useRef(palette);

  // Al abrir el modal, sincronizar la selección con la paleta actual
  useEffect(() => {
    if (isOpen) {
      setSelectedPal(palette);
      initialPaletteRef.current = palette;
    }
  }, [isOpen]);

  const handleSelect = (palId) => {
    setSelectedPal(palId);
    // Previsualización instantánea en vivo
    setPalette(palId);
  };

  const handleConfirm = () => {
    if (onSave) {
      onSave(selectedPal);
    } else if (onClose) {
      onClose(selectedPal);
    }
  };

  const handleCancel = () => {
    // Si cancela o cierra sin guardar, restablecer la paleta original
    setPalette(initialPaletteRef.current);
    if (onClose) onClose();
  };

  const allPalettes = [
    ...PALETTES,
    {
      id: "custom",
      name: "Personalizada",
      description: "Elige tus propios colores.",
      swatches: getCustomSwatches(customPalette)
    }
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Paleta de colores">
      <p className="hint" style={{ marginBottom: 16 }}>
        Es la paleta de tu tienda: la ven también tus empleados. Cambia al instante y se recuerda en este navegador.
      </p>

      {/* Contenedor desplazable para que los botones de acción nunca queden ocultos */}
      <div
        style={{
          maxHeight: 'min(52vh, 440px)',
          overflowY: 'auto',
          paddingRight: 6,
          margin: '0 -6px'
        }}
      >
        <div className="pals">
          {allPalettes.map((p) => {
            const isSelected = p.id === selectedPal;
            return (
              <button
                key={p.id}
                type="button"
                className="pal"
                onClick={() => handleSelect(p.id)}
                aria-pressed={isSelected}
              >
                <span className="sw">
                  {p.swatches.map((c, idx) => (
                    <i key={idx} style={{ background: c }} />
                  ))}
                </span>
                <b>{p.name}</b>
                <small>{p.description}</small>
                {isSelected && <span className="chip">En uso</span>}
              </button>
            );
          })}
        </div>

        {selectedPal === 'custom' && (() => {
          // Validar ratio de contraste WCAG 2.1 entre el acento y el fondo blanco / suave
          const getLuminance = (hex) => {
            if (!hex || typeof hex !== 'string') return 1;
            let c = hex.replace('#', '');
            if (c.length === 3) c = c.split('').map((x) => x + x).join('');
            if (c.length !== 6) return 1;
            const r = parseInt(c.substring(0, 2), 16) / 255;
            const g = parseInt(c.substring(2, 4), 16) / 255;
            const b = parseInt(c.substring(4, 6), 16) / 255;
            const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
            return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
          };

          const getContrastRatio = (hex1, hex2) => {
            const l1 = getLuminance(hex1);
            const l2 = getLuminance(hex2);
            const max = Math.max(l1, l2);
            const min = Math.min(l1, l2);
            return (max + 0.05) / (min + 0.05);
          };

          const contrastWithWhite = getContrastRatio(customPalette.acc || '#ff5900', '#ffffff');
          const isContrastLow = contrastWithWhite < 3.0;
          const isContrastGood = contrastWithWhite >= 4.5;

          return (
            <div className="ed" style={{ marginTop: 16 }}>
              <div className="f">
                <label>
                  <span>Color principal (botones y acentos)</span>
                  <input
                    type="color"
                    value={customPalette.acc}
                    onChange={(e) => updateCustomPalette({ acc: e.target.value })}
                  />
                </label>
                <label>
                  <span>Barra superior de avisos</span>
                  <input
                    type="color"
                    value={customPalette.bar}
                    onChange={(e) => updateCustomPalette({ bar: e.target.value })}
                  />
                </label>
                <label>
                  <span>Fondos suaves y contraste</span>
                  <input
                    type="color"
                    value={customPalette.fog}
                    onChange={(e) => updateCustomPalette({ fog: e.target.value })}
                  />
                </label>
              </div>

              {/* Indicador de Validación de Contraste WCAG contra el fondo */}
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: 1.4,
                  background: isContrastLow
                    ? 'rgba(239, 68, 68, 0.1)'
                    : isContrastGood
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${
                    isContrastLow ? '#ef4444' : isContrastGood ? '#10b981' : '#f59e0b'
                  }`,
                  color: isContrastLow ? '#dc2626' : isContrastGood ? '#059669' : '#d97706'
                }}
              >
                <b>
                  {isContrastLow
                    ? '⚠️ Contraste insuficiente contra el fondo'
                    : isContrastGood
                    ? '✓ Contraste óptimo (Cumple WCAG AA)'
                    : 'ℹ️ Contraste aceptable'}
                </b>
                <div style={{ marginTop: 2 }}>
                  Ratio de contraste: <b>{contrastWithWhite.toFixed(2)}:1</b> contra el fondo blanco de la pantalla.
                  {isContrastLow
                    ? ' El color seleccionado es demasiado claro y costará distinguirlo en botones o bordes. Te sugerimos oscurecerlo un poco.'
                    : ' Este color garantiza excelente visibilidad tanto en celular como en computadora.'}
                </div>
              </div>

              <p className="hint" style={{ marginTop: 12 }}>
                El texto de los botones se ajusta automáticamente a blanco o negro para garantizar máxima legibilidad.
              </p>
              <button
                type="button"
                className="btn o s"
                style={{ marginTop: 8 }}
                onClick={resetCustomPalette}
              >
                Restablecer colores por defecto
              </button>
            </div>
          );
        })()}
      </div>

      {/* Barra de acciones fija y siempre visible */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--mist)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          bottom: 0,
          background: 'var(--paper)',
          zIndex: 10
        }}
      >
        <button
          type="button"
          className="btn o"
          onClick={handleCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn p"
          onClick={handleConfirm}
          style={{ minWidth: 110, fontWeight: 600 }}
        >
          Listo
        </button>
      </div>
    </Modal>
  );
}
