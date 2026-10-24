/**
 * Utilidades de Seguridad, Validación y Sanitización de Datos
 * Protección contra inyecciones XSS, desbordamiento y manipulación de datos en el cliente.
 */

/**
 * Sanitiza una cadena de texto eliminando etiquetas HTML y scripts maliciosos,
 * sin escapar entidades HTML para evitar el doble-escapado en el DOM de React.
 * @param {string} str - Texto de entrada
 * @param {number} maxLength - Longitud máxima permitida
 * @returns {string} - Texto sanitizado
 */
export function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  
  // 1. Quitar etiquetas HTML completas <tag ...> y </tag>
  let clean = str.replace(/<[^>]*>?/gm, '');

  // 2. Quitar caracteres de control invisibles (excepto saltos de línea estándar)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. Recortar espacios en blanco y limitar longitud sin alterar &, /, " o '
  clean = clean.trim();
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }

  return clean;
}

/**
 * Sanitiza y valida una cantidad o stock, permitiendo decimales para productos por peso o fracción.
 * @param {any} val - Valor de cantidad
 * @param {object} options - Opciones de validación
 * @returns {number} - Cantidad numérica segura
 */
export function validateQuantity(val, { min = 0.001, max = 1000000, defaultVal = 1, isDecimal = true } = {}) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return defaultVal;
  if (num < min) return min;
  if (num > max) return max;
  return isDecimal ? Math.round(num * 1000) / 1000 : Math.floor(num);
}

/**
 * Genera una clave de idempotencia única para prevenir ventas duplicadas por doble tap o reintentos
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

/**
 * Sanitiza y valida un número flotante (ej. precios o subtotales)
 * @param {any} val - Valor a validar
 * @param {object} options - Opciones de rango
 * @returns {number} - Número seguro redondeado a 2 decimales
 */
export function validatePrice(val, { min = 0, max = 999999.99, defaultVal = 0 } = {}) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return defaultVal;
  if (num < min) return min;
  if (num > max) return max;
  return Math.round(num * 100) / 100;
}

/**
 * Sanitiza y valida un número para stock (admite enteros o decimales)
 */
export function validateStockInt(val, { min = 0, max = 1000000, defaultVal = 0, isDecimal = false } = {}) {
  return validateQuantity(val, { min, max, defaultVal, isDecimal });
}

/**
 * Valida un correo electrónico con estándar RFC 5322
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return regex.test(email.trim()) && email.length <= 120;
}

/**
 * Sanitiza un número telefónico eliminando caracteres extraños excepto dígitos y '+'
 * @param {string} phone
 * @returns {string}
 */
export function sanitizePhone(phone) {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[^\d+]/g, '').slice(0, 20);
}

/**
 * Validación y sanitización integral para la creación/edición de productos
 * @param {object} prod
 * @returns {{ isValid: boolean, errors: string[], data: object }}
 */
export function validateProductInput(prod) {
  const errors = [];
  const nombre = sanitizeString(prod.nombre || '', 120);
  const categoria = sanitizeString(prod.categoria || 'General', 50) || 'General';
  const unidadMedida = sanitizeString(prod.unidad_medida || 'und', 20).toLowerCase();
  const isDecimal = ['kg', 'g', 'l', 'ml'].includes(unidadMedida);

  const precio = validatePrice(prod.precio_venta, { min: 0.01, max: 999999.99, defaultVal: 0 });
  const costoUnitario = validatePrice(prod.costo_unitario || 0, { min: 0, max: 999999.99, defaultVal: 0 });
  const stockMinimo = validateQuantity(prod.stock_minimo, { min: 0, max: 10000, defaultVal: isDecimal ? 1 : 5, isDecimal });
  const delta = prod.delta !== undefined ? validateQuantity(prod.delta, { min: -100000, max: 100000, defaultVal: 0, isDecimal }) : 0;
  const stockInicial = validateQuantity(prod.stock_inicial || 0, { min: 0, max: 100000, defaultVal: 0, isDecimal });
  const codigoBarras = prod.codigo_barras ? sanitizeString(String(prod.codigo_barras).trim(), 50) : '';
  const activo = prod.activo !== false; // Por defecto activo (true), permite archivar con false

  if (!nombre || nombre.length < 2) {
    errors.push('El nombre del producto debe tener al menos 2 caracteres.');
  }

  if (precio <= 0) {
    errors.push('El precio de venta debe ser un número positivo mayor a S/. 0.00.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      ...prod,
      nombre,
      categoria,
      unidad_medida: unidadMedida || 'und',
      precio_venta: precio,
      costo_unitario: costoUnitario,
      stock_minimo: stockMinimo,
      delta,
      stock_inicial: stockInicial,
      codigo_barras: codigoBarras,
      activo
    }
  };
}

/**
 * Validación y verificación de seguridad para el checkout / venta
 * Previene manipulación maliciosa de precios o cálculo en el cliente.
 * Admite pagos mixtos (ej: Efectivo + Yape), cantidades decimales y clave de idempotencia.
 * @param {object} params
 * @returns {{ isValid: boolean, errors: string[], calculatedTotal: number, verifiedItems: array, idempotencyKey: string }}
 */
export function validateSaleCheckout({
  cart = {},
  products = [],
  metodoPago = 'Efectivo',
  pagosMixtos = null, // [{ metodo: 'Efectivo', monto: 15 }, { metodo: 'Yape / Plin', monto: 10 }]
  montoRecibido = null,
  idempotencyKey = null
}) {
  const errors = [];
  const cartEntries = Object.entries(cart);

  if (cartEntries.length === 0) {
    errors.push('El carrito de venta está vacío.');
    return { isValid: false, errors, calculatedTotal: 0, verifiedItems: [], idempotencyKey: null };
  }

  let calculatedTotal = 0;
  const verifiedItems = [];

  for (const [id, qty] of cartEntries) {
    const prod = products.find((p) => String(p.id) === String(id));
    if (!prod) {
      errors.push(`El producto con ID ${id} ya no existe en el catálogo.`);
      continue;
    }

    const isDecimal = ['kg', 'g', 'l', 'ml'].includes(prod.unidad_medida);
    const validQty = validateQuantity(qty, { min: 0.001, max: 10000, defaultVal: 0, isDecimal });

    if (validQty <= 0) {
      errors.push(`Cantidad inválida para "${prod.nombre}".`);
      continue;
    }

    if (prod.stock < validQty) {
      errors.push(`Stock insuficiente para "${prod.nombre}". Solicitado: ${validQty} ${prod.unidad_medida || 'und'}, Disponible: ${prod.stock}.`);
      continue;
    }

    // Precio verificado directamente del registro oficial de productos
    const verifiedPrice = validatePrice(prod.precio_venta);
    const itemSubtotal = Math.round(verifiedPrice * validQty * 100) / 100;
    calculatedTotal += itemSubtotal;

    verifiedItems.push({
      producto_id: prod.id,
      nombre: sanitizeString(prod.nombre, 120),
      unidad_medida: prod.unidad_medida || 'und',
      costo_unitario: validatePrice(prod.costo_unitario || 0),
      precio: verifiedPrice,
      cantidad: validQty,
      subtotal: itemSubtotal
    });
  }

  calculatedTotal = Math.round(calculatedTotal * 100) / 100;

  // Validación de método de pago (Simple o Mixto)
  let verifiedMetodoPago = sanitizeString(metodoPago, 50) || 'Efectivo';
  let verifiedPagosMixtos = null;

  if (metodoPago === 'Mixto' && Array.isArray(pagosMixtos) && pagosMixtos.length > 0) {
    let sumaMixto = 0;
    verifiedPagosMixtos = pagosMixtos.map((p) => {
      const monto = validatePrice(p.monto, { min: 0, max: 999999 });
      sumaMixto += monto;
      return {
        metodo: sanitizeString(p.metodo || 'Efectivo', 40),
        monto
      };
    });

    const diff = Math.abs(Math.round(sumaMixto * 100) - Math.round(calculatedTotal * 100));
    if (diff > 1) { // margen de 1 centavo por redondeo
      errors.push(`La suma de los pagos mixtos (S/. ${sumaMixto.toFixed(2)}) debe coincidir con el total de la venta (S/. ${calculatedTotal.toFixed(2)}).`);
    }
  } else {
    // Si es efectivo y proporcionó monto recibido, validar que cubra el total
    if (metodoPago === 'Efectivo' && montoRecibido !== null && montoRecibido !== '') {
      const validMontoRecibido = parseFloat(montoRecibido);
      if (isNaN(validMontoRecibido) || validMontoRecibido < calculatedTotal) {
        errors.push(`El monto recibido (S/. ${validMontoRecibido?.toFixed(2) || '0.00'}) no cubre el total de la venta (S/. ${calculatedTotal.toFixed(2)}).`);
      }
    }
  }

  const verifiedIdempotencyKey = idempotencyKey || generateIdempotencyKey();

  return {
    isValid: errors.length === 0,
    errors,
    calculatedTotal,
    verifiedItems,
    metodoPago: verifiedMetodoPago,
    pagosMixtos: verifiedPagosMixtos,
    montoRecibido: montoRecibido ? parseFloat(montoRecibido) : null,
    idempotencyKey: verifiedIdempotencyKey
  };
}

/**
 * Sanitización de datos de nueva tienda o actualización
 * @param {object} store
 * @returns {{ isValid: boolean, errors: string[], data: object }}
 */
export function validateStoreInput(store) {
  const errors = [];
  const nombre = sanitizeString(store.nombre || '', 100);
  const dueno = sanitizeString(store.dueno || '', 100);
  const email = (store.email || '').trim().toLowerCase();

  if (!nombre || nombre.length < 3) {
    errors.push('El nombre de la tienda debe tener al menos 3 caracteres.');
  }

  if (!dueno || dueno.length < 2) {
    errors.push('El nombre del dueño debe tener al menos 2 caracteres.');
  }

  if (!validateEmail(email)) {
    errors.push('El correo electrónico ingresado no tiene un formato válido.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      ...store,
      nombre,
      dueno,
      email
    }
  };
}
