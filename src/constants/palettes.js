// =====================================================================
// DEFINICIONES DE PALETAS Y UTILIDADES DE COLOR
// Compatible con el prototipo y con el esquema SQL v2
// =====================================================================

export const PALETTES = [
  {
    id: "brex",
    name: "Brex",
    description: "Blanco y naranja. La paleta original.",
    swatches: ["#ff5900", "#000000", "#f2eee8", "#b9bbc6", "#15191e"]
  },
  {
    id: "oceano",
    name: "Océano",
    description: "Azul sereno, aire de banco.",
    swatches: ["#0b5fff", "#0a1628", "#e8eff8", "#b8c4d6", "#0a1e3f"]
  },
  {
    id: "bosque",
    name: "Bosque",
    description: "Verde profundo, tranquilo.",
    swatches: ["#1f7a4d", "#0d1a12", "#e8efe8", "#b7c4b9", "#12261a"]
  },
  {
    id: "uva",
    name: "Uva",
    description: "Violeta moderno y nítido.",
    swatches: ["#6d3df2", "#120d22", "#eeeaf6", "#c5bfd6", "#1d1537"]
  },
  {
    id: "rubi",
    name: "Rubí",
    description: "Rojo intenso con fondos cálidos.",
    swatches: ["#d6204b", "#1c0d11", "#f6e8ea", "#d6bfc4", "#2a1218"]
  },
  {
    id: "grafito",
    name: "Grafito",
    description: "Neutra, sin color de acento.",
    swatches: ["#2b2f38", "#0b0b0d", "#e8e8ec", "#c4c4c8", "#18181b"]
  },
  {
    id: "turquesa",
    name: "Turquesa",
    description: "Verde azulado fresco.",
    swatches: ["#0e7c86", "#0a1a1c", "#e2f0f0", "#b5c8c9", "#0c2a2e"]
  },
  {
    id: "ambar",
    name: "Ámbar",
    description: "Amarillo cálido con texto oscuro.",
    swatches: ["#f5a000", "#1b1405", "#f6eee0", "#d8cdb5", "#2a2008"]
  },
  {
    id: "fucsia",
    name: "Fucsia",
    description: "Magenta vivo y juvenil.",
    swatches: ["#c2187a", "#1f0c18", "#f8e8f2", "#dbc2d2", "#2e1124"]
  },
  {
    id: "arena",
    name: "Arena",
    description: "Marrón tierra, sobrio y cálido.",
    swatches: ["#8a5a2b", "#1c150c", "#eee5d8", "#d3c8b4", "#2a1f12"]
  }
];

export const PERIODICIDAD = {
  1: 'mes',
  3: 'trimestre',
  12: 'año'
};

export const MODULOS_DEF = {
  inventario: 'Inventario',
  ventas: 'Ventas',
  reportes: 'Reportes',
  escaner: 'Escáner & Código de Barras'
};

// Métodos de pago estándar para tiendas en Perú
export const DEFAULT_PAYMENT_METHODS = [
  'Efectivo',
  'Yape / Plin',
  'Tarjeta',
  'Transferencia'
];

// Luminancia relativa WCAG
export const lum = (hexStr) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hexStr.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

// Ratio de contraste WCAG
export const contrastRatio = (hexA, hexB) => {
  const x = lum(hexA);
  const y = lum(hexB);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

export const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

export const DEFAULT_CUSTOM = {
  acc: "#ff5900",
  bar: "#15191e",
  fog: "#f3f3f7"
};

export const getCustomSwatches = (custom) => [
  custom.acc || DEFAULT_CUSTOM.acc,
  "#000000",
  custom.fog || DEFAULT_CUSTOM.fog,
  "#b9bbc6",
  custom.bar || DEFAULT_CUSTOM.bar
];

// Formateador de moneda oficial (Soles peruanos S/.) con Intl.NumberFormat
const penFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const money = (num) => {
  const val = Number(num) || 0;
  return penFormatter.format(val);
};

// Unidades de medida soportadas para venta unitaria y por peso/volumen/fracción
export const UNIDADES_MEDIDA = [
  { id: 'und', label: 'Unidad (und)', short: 'und', decimal: false, step: 1 },
  { id: 'kg', label: 'Kilogramo (kg)', short: 'kg', decimal: true, step: 0.005 },
  { id: 'g', label: 'Gramo (g)', short: 'g', decimal: true, step: 1 },
  { id: 'l', label: 'Litro (L)', short: 'L', decimal: true, step: 0.05 },
  { id: 'ml', label: 'Mililitro (ml)', short: 'ml', decimal: true, step: 10 },
  { id: 'docena', label: 'Docena (doc)', short: 'doc', decimal: false, step: 1 },
  { id: 'pqte', label: 'Paquete (pqte)', short: 'pqte', decimal: false, step: 1 }
];

export const getUnidadMedida = (id) => {
  return UNIDADES_MEDIDA.find((u) => u.id === id) || UNIDADES_MEDIDA[0];
};

// Tipos de ajuste de inventario (Conteo físico, Mermas, Ingresos, etc.)
export const TIPOS_AJUSTE_INVENTARIO = [
  { id: 'ingreso', label: 'Ingreso de mercadería (+)', esSuma: true },
  { id: 'conteo_fisico', label: 'Conteo físico / Cuadre', esSuma: null },
  { id: 'merma', label: 'Merma / Producto dañado / Vencido (-)', esSuma: false },
  { id: 'devolucion_cliente', label: 'Devolución de cliente (+)', esSuma: true },
  { id: 'correccion', label: 'Corrección manual de stock', esSuma: null }
];

// Helper de búsqueda que ignora tildes, mayúsculas y diacríticos
export const normalizeSearch = (str) => {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

import { formatPeruDate, diffDaysPeru, getPeruDateIso } from '../utils/dateUtils';

// Formateador de fechas en America/Lima
export const fd = (dateVal) => {
  return formatPeruDate(dateVal);
};

// Diferencia en días con respecto a hoy en America/Lima
export const diffDays = (dateVal) => {
  return diffDaysPeru(dateVal);
};


