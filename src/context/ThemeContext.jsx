import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  PALETTES,
  DEFAULT_CUSTOM,
  isHex,
  contrastRatio
} from '../constants/palettes';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Tema (light / dark)
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('theme_pref');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    } catch {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Paleta seleccionada
  const [palette, setPaletteState] = useState(() => {
    try {
      const saved = localStorage.getItem('store_palette');
      if (PALETTES.some((p) => p.id === saved) || saved === 'custom') return saved;
    } catch {}
    return 'brex';
  });

  // Paleta personalizada
  const [customPalette, setCustomPaletteState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('store_custom_palette') || '{}');
      if (saved && isHex(saved.acc) && isHex(saved.bar) && isHex(saved.fog)) {
        return saved;
      }
    } catch {}
    return DEFAULT_CUSTOM;
  });

  // Aplicar colores personalizados
  const applyCustomColors = (c) => {
    const root = document.documentElement.style;
    root.setProperty('--cacc', c.acc);
    root.setProperty('--cbar', c.bar);
    root.setProperty('--cfog', c.fog);
    // Texto sobre acento: blanco o negro según ratio de contraste
    const onacc = contrastRatio(c.acc, '#ffffff') >= contrastRatio(c.acc, '#000000') ? '#ffffff' : '#000000';
    root.setProperty('--conacc', onacc);
    // Enlace en banner superior
    const ann = contrastRatio(c.acc, c.bar) >= 3 ? c.acc : '#ffffff';
    root.setProperty('--cann', ann);
  };

  // Sincronizar DOM y LocalStorage cuando cambia theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme_pref', theme);
    } catch {}
  }, [theme]);

  // Sincronizar DOM y LocalStorage cuando cambia palette
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    try {
      localStorage.setItem('store_palette', palette);
    } catch {}

    if (palette === 'custom') {
      applyCustomColors(customPalette);
    }
  }, [palette, customPalette]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setPalette = useCallback((newPal) => {
    setPaletteState(newPal);
  }, []);

  const updateCustomPalette = useCallback((newCustom) => {
    setCustomPaletteState((prev) => {
      const updated = { ...prev, ...newCustom };
      try {
        localStorage.setItem('store_custom_palette', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const resetCustomPalette = useCallback(() => {
    setCustomPaletteState(DEFAULT_CUSTOM);
    try {
      localStorage.setItem('store_custom_palette', JSON.stringify(DEFAULT_CUSTOM));
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        palette,
        setPalette,
        customPalette,
        updateCustomPalette,
        resetCustomPalette
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  return context;
};
