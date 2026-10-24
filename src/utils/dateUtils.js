/**
 * dateUtils.js - Manejo centralizado y robusto de Zona Horaria (America/Lima / UTC-5)
 * Garantiza que en todo el sistema las fechas, días de la semana y horas correspondan
 * estrictamente a la hora peruana, independientemente de la zona horaria del servidor o navegador.
 */

export const PERU_TIMEZONE = 'America/Lima';

/**
 * Obtiene las partes de fecha y hora desglosadas en America/Lima
 * @param {Date|string|number} dateVal
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
export function getPeruDateParts(dateVal = new Date()) {
  const d = typeof dateVal === 'string'
    ? (dateVal.length === 10 ? new Date(`${dateVal}T12:00:00-05:00`) : new Date(dateVal))
    : new Date(dateVal);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PERU_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(d).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour === '24' ? '0' : parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10)
  };
}

/**
 * Obtiene la fecha actual (o dada) en formato ISO local "YYYY-MM-DD" en America/Lima
 * @param {Date|string|number} dateVal
 * @returns {string} Ej: "2026-10-23"
 */
export function getPeruDateIso(dateVal = new Date()) {
  if (!dateVal) {
    dateVal = new Date();
  }
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    return dateVal;
  }
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PERU_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Obtiene la hora en formato "HH:mm" en America/Lima (24h)
 * @param {Date|string|number} dateVal
 * @returns {string} Ej: "19:28"
 */
export function getPeruTime(dateVal = new Date()) {
  if (!dateVal) dateVal = new Date();
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: PERU_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

/**
 * Formatea una fecha en español de Perú usando America/Lima
 * @param {Date|string|number} dateVal
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {string}
 */
export function formatPeruDate(dateVal, options = {}) {
  if (!dateVal) return '-';
  const d = typeof dateVal === 'string'
    ? (dateVal.length === 10 ? new Date(`${dateVal}T12:00:00-05:00`) : new Date(dateVal))
    : new Date(dateVal);

  const defaultOptions = Object.keys(options).length === 0
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : options;

  return d.toLocaleDateString('es-PE', {
    timeZone: PERU_TIMEZONE,
    ...defaultOptions
  });
}

/**
 * Convierte cualquier fecha o ISO timestamp a "YYYY-MM-DD" en hora de Perú
 * @param {Date|string|number} input
 * @returns {string} "YYYY-MM-DD"
 */
export function parseToPeruDateIso(input) {
  if (!input) return getPeruDateIso();
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    if (input.includes('/')) {
      const parts = input.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return getPeruDateIso(input);
}

/**
 * Verifica si una fecha dada corresponde al día de HOY en Perú
 * @param {Date|string|number} input
 * @returns {boolean}
 */
export function isPeruToday(input) {
  return parseToPeruDateIso(input) === getPeruDateIso();
}

/**
 * Genera el arreglo de los últimos 7 días terminando ESTRICTAMENTE en hoy en Perú.
 * Garantiza que el último día sea el día actual (ej. viernes) y nunca el día siguiente.
 * @returns {Array<{ iso: string, date: Date, label: string, fullLabel: string, isToday: boolean }>}
 */
export function getLast7DaysPeru() {
  const todayParts = getPeruDateParts(new Date());
  // Usamos medianoche UTC con las partes locales para evitar saltos de horario de verano/invariable
  const todayUtcMidnight = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const dayMs = todayUtcMidnight - (i * 86400000);
    const dayDate = new Date(dayMs);
    const y = dayDate.getUTCFullYear();
    const m = String(dayDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dayDate.getUTCDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    const dateObj = new Date(`${iso}T12:00:00-05:00`);

    const isToday = i === 0;
    const label = formatPeruDate(dateObj, { weekday: 'short' });
    const fullLabel = formatPeruDate(dateObj, { weekday: 'long', day: 'numeric', month: 'short' });

    result.push({
      iso,
      date: dateObj,
      label,
      fullLabel,
      isToday
    });
  }

  return result;
}

/**
 * Calcula la diferencia en días con respecto a hoy en Perú
 * @param {Date|string|number} dateVal
 * @returns {number}
 */
export function diffDaysPeru(dateVal) {
  if (!dateVal) return 0;
  const targetIso = parseToPeruDateIso(dateVal);
  const todayIso = getPeruDateIso();
  const [ty, tm, td] = targetIso.split('-').map(Number);
  const [cy, cm, cd] = todayIso.split('-').map(Number);
  const targetUtc = Date.UTC(ty, tm - 1, td);
  const currentUtc = Date.UTC(cy, cm - 1, cd);
  return Math.round((targetUtc - currentUtc) / 86400000);
}
