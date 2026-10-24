/**
 * Constantes y utilidades para Identificación Visual por Categorías y Logotipos de Tienda
 */

// Paleta de acentos y tonos para categorías
export const CATEGORY_PALETTE = {
  Abarrotes: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    text: '#b45309',
    dot: '#f59e0b',
    icon: '🌾'
  },
  Bebidas: {
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.35)',
    text: '#1d4ed8',
    dot: '#3b82f6',
    icon: '🥤'
  },
  Lácteos: {
    bg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.35)',
    text: '#6d28d9',
    dot: '#8b5cf6',
    icon: '🧀'
  },
  Limpieza: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    text: '#047857',
    dot: '#10b981',
    icon: '🧼'
  },
  Panadería: {
    bg: 'rgba(234, 88, 12, 0.12)',
    border: 'rgba(234, 88, 12, 0.35)',
    text: '#c2410c',
    dot: '#ea580c',
    icon: '🥖'
  },
  Snacks: {
    bg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.35)',
    text: '#be185d',
    dot: '#ec4899',
    icon: '🍿'
  },
  Carnes: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
    text: '#b91c1c',
    dot: '#ef4444',
    icon: '🥩'
  },
  Farmacia: {
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.35)',
    text: '#0e7490',
    dot: '#06b6d4',
    icon: '💊'
  },
  Ferretería: {
    bg: 'rgba(107, 114, 128, 0.14)',
    border: 'rgba(107, 114, 128, 0.35)',
    text: '#374151',
    dot: '#6b7280',
    icon: '🔧'
  },
  General: {
    bg: 'rgba(100, 116, 139, 0.10)',
    border: 'rgba(100, 116, 139, 0.25)',
    text: '#475569',
    dot: '#64748b',
    icon: '📦'
  }
};

/**
 * Obtener estilo visual de categoría con fallback para categorías arbitrarias
 */
export function getCategoryStyle(catName = 'General') {
  if (CATEGORY_PALETTE[catName]) {
    return CATEGORY_PALETTE[catName];
  }

  // Generador de color pseudo-aleatorio pero determinista para categorías creadas por el usuario
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [210, 145, 270, 35, 330, 180, 20];
  const hue = hues[Math.abs(hash) % hues.length];

  return {
    bg: `hsla(${hue}, 80%, 50%, 0.12)`,
    border: `hsla(${hue}, 80%, 50%, 0.35)`,
    text: `hsl(${hue}, 85%, 32%)`,
    dot: `hsl(${hue}, 80%, 45%)`,
    icon: '🏷️'
  };
}

/**
 * Obtener URL de imagen de logotipo de tienda guardado
 */
export function getStoreLogoStorage(storeId = 'default') {
  try {
    const saved = localStorage.getItem(`store_logo_${storeId}`);
    if (saved && typeof saved === 'string') {
      if (saved.startsWith('{')) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.url) return parsed.url;
          if (parsed.value && (parsed.value.startsWith('http') || parsed.value.startsWith('data:'))) {
            return parsed.value;
          }
          return null;
        } catch {
          return null;
        }
      }
      return saved.trim() || null;
    }
  } catch (e) {
    console.warn('Error reading store logo:', e);
  }
  return null;
}

/**
 * Guardar URL de logotipo de tienda
 */
export function setStoreLogoStorage(storeId = 'default', logoUrl) {
  try {
    if (logoUrl && typeof logoUrl === 'string') {
      localStorage.setItem(`store_logo_${storeId}`, logoUrl.trim());
    } else {
      localStorage.removeItem(`store_logo_${storeId}`);
    }
  } catch (e) {
    console.warn('Error saving store logo:', e);
  }
}

