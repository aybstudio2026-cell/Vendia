import { money } from '../constants/palettes';
import { formatPeruDate, getPeruTime } from './dateUtils';

/**
 * Cargar imagen de forma asíncrona para dibujar en Canvas
 */
function loadLogoImage(src) {
  return new Promise((resolve) => {
    if (!src || typeof src !== 'string') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Formatea un identificador de venta en un correlativo limpio y profesional tipo ticket/boleta consecutivo:
 * Ejemplo: B001-000001, B001-000042, B001-000150
 * @param {string|number|object} saleIdOrSale
 * @param {string} [serie='B001']
 * @param {number|string} [correlativo=null]
 * @returns {string}
 */
export function formatTicketCode(saleIdOrSale, serie = 'B001', correlativo = null) {
  let saleId = saleIdOrSale;
  let finalSerie = serie;
  let finalCorrelativo = correlativo;

  if (typeof saleIdOrSale === 'object' && saleIdOrSale !== null) {
    saleId = saleIdOrSale.id;
    finalSerie = saleIdOrSale.serie || serie || 'B001';
    finalCorrelativo = saleIdOrSale.correlativo || saleIdOrSale.numero || correlativo;
  }

  // Si se dispone del correlativo consecutivo exacto
  if (finalCorrelativo !== null && finalCorrelativo !== undefined) {
    const num = parseInt(finalCorrelativo, 10);
    if (!isNaN(num) && num >= 0) {
      return `${finalSerie}-${String(num).padStart(6, '0')}`;
    }
  }

  if (!saleId) return `${finalSerie}-000001`;

  // Si ya tiene formato tipo B001-000012 o V000-0001
  if (typeof saleId === 'string' && /^[a-zA-Z0-9]{3,4}-[a-zA-Z0-9]{4,8}$/.test(saleId.trim())) {
    return saleId.trim().toUpperCase();
  }

  const str = String(saleId).trim();

  // Si es un número entero secuencial pequeño (< 1,000,000)
  const num = parseInt(str, 10);
  if (!isNaN(num) && num > 0 && num < 1000000 && /^\d+$/.test(str)) {
    return `${finalSerie}-${String(num).padStart(6, '0')}`;
  }

  // Si es un timestamp numérico (como Date.now() ~ 13 dígitos)
  if (/^\d{7,}$/.test(str)) {
    const lastDigits = str.slice(-6);
    return `${finalSerie}-${lastDigits}`;
  }

  // Si es un UUID (ej: "4e82df4b-6d60-492a-8c83-cb8442fae968")
  const alphanumeric = str.replace(/[^a-zA-Z0-9]/g, '');
  if (alphanumeric.length >= 6) {
    return `${finalSerie}-${alphanumeric.slice(-6).toUpperCase()}`;
  }

  return `${finalSerie}-${str.slice(0, 6).toUpperCase()}`;
}

/**
 * Generar un Blob de imagen PNG de la boleta de venta usando HTML5 Canvas (100% gratis en el navegador)
 */
export async function generateTicketImageBlob({ sale, storeName, products = [], storeLogo = null }) {
  if (!sale) return null;

  const ticketCode = formatTicketCode(sale.id, sale.serie || 'B001');
  const total = sale.total || (sale.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0);
  const dateFormatted = formatPeruDate(sale.creado_en || sale.fecha || new Date(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeFormatted = sale.hora || getPeruTime(sale.creado_en || new Date());

  // Cargar imagen del logotipo si existe
  const logoImg = await loadLogoImage(storeLogo);

  // Configuración de canvas con alta resolución (retina 2x)
  const scale = 2;
  const baseWidth = 360;
  
  // Calcular altura dinámica según la cantidad de productos y logo
  const itemsCount = (sale.items || []).length;
  const logoExtra = logoImg ? 54 : 0;
  const baseHeight = 370 + itemsCount * 28 + (sale.monto_recibido ? 40 : 0) + logoExtra;

  const canvas = document.createElement('canvas');
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Fondo blanco con borde decorativo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // Borde sutil
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, baseWidth, baseHeight);

  let currentY = 22;
  if (logoImg) {
    const maxW = 130;
    const maxH = 46;
    let w = logoImg.width;
    let h = logoImg.height;
    const ratio = Math.min(maxW / w, maxH / h, 1);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);

    ctx.drawImage(logoImg, (baseWidth - w) / 2, currentY, w, h);
    currentY += h + 10;
  }

  // Encabezado
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "Courier New", Courier, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(storeName.toUpperCase(), baseWidth / 2, currentY + 8);
  currentY += 24;

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px "Courier New", Courier, monospace';
  ctx.fillText('BOLETA DE VENTA ELECTRÓNICA', baseWidth / 2, currentY + 6);
  currentY += 18;

  // Código formateado del ticket (ej: B001-000042)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px "Courier New", Courier, monospace';
  ctx.fillText(ticketCode, baseWidth / 2, currentY + 4);
  currentY += 16;

  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Courier New", Courier, monospace';
  ctx.fillText(`${dateFormatted} · ${timeFormatted}`, baseWidth / 2, currentY + 4);
  currentY += 16;
  if (sale.usuario) {
    ctx.fillText(`Cajero: ${sale.usuario}`, baseWidth / 2, currentY + 4);
    currentY += 18;
  } else {
    currentY += 6;
  }


  // Línea punteada divisoria
  const drawDashedLine = (y) => {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(baseWidth - 16, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashedLine(currentY);
  currentY += 16;


  // Encabezados de ítems
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px "Courier New", Courier, monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText('DESCRIPCIÓN', 20, currentY);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL', baseWidth - 20, currentY);
  currentY += 12;

  drawDashedLine(currentY);
  currentY += 18;

  // Lista de Ítems
  (sale.items || []).forEach((it) => {
    const prod = products.find((p) => String(p.id) === String(it.producto_id));
    const nom = prod ? prod.nombre : (it.nombre || 'Producto');
    const sub = (it.precio * it.cantidad).toFixed(2);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px "Courier New", Courier, monospace';

    // Cortar nombre si es muy largo
    const maxChars = 22;
    const cleanNom = nom.length > maxChars ? nom.slice(0, maxChars) + '…' : nom;
    ctx.fillText(`${it.cantidad}x ${cleanNom}`, 20, currentY);

    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "Courier New", Courier, monospace';
    ctx.fillText(`S/. ${sub}`, baseWidth - 20, currentY);

    currentY += 24;
  });

  currentY += 6;
  drawDashedLine(currentY);
  currentY += 24;

  // Total en grande
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px "Courier New", Courier, monospace';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('TOTAL A PAGAR:', 20, currentY);

  ctx.textAlign = 'right';
  ctx.font = 'bold 18px "Courier New", Courier, monospace';
  ctx.fillText(money(total), baseWidth - 20, currentY);
  currentY += 22;

  // Detalle de pago
  ctx.font = '11px "Courier New", Courier, monospace';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(`Método de pago: ${sale.metodo_pago || 'Efectivo'}`, 20, currentY);
  currentY += 16;

  if (sale.monto_recibido) {
    ctx.fillText(`Monto recibido: ${money(sale.monto_recibido)}`, 20, currentY);
    currentY += 16;
    const vuelto = Number(sale.monto_recibido) - Number(total);
    if (vuelto >= 0) {
      ctx.fillText(`Vuelto: ${money(vuelto)}`, 20, currentY);
      currentY += 16;
    }
  }

  currentY += 8;
  drawDashedLine(currentY);
  currentY += 22;

  // Pie de página de agradecimiento
  ctx.textAlign = 'center';
  ctx.font = 'italic 11px "Courier New", Courier, monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('¡Muchas gracias por su compra!', baseWidth / 2, currentY);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Descargar directamente la boleta como archivo PNG
 */
export async function downloadTicketImage(params) {
  const blob = await generateTicketImageBlob(params);
  if (!blob) return;

  const ticketCode = formatTicketCode(params.sale.id, params.sale.serie || 'B001');
  const cleanStore = (params.storeName || 'Tienda').replace(/\s+/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Boleta_${cleanStore}_${ticketCode}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Imprimir comprobante aislando el contenido en un iframe para garantizar exactamente 1 página
 */
export function printThermalTicket(elementId, saleId) {
  const elem = document.getElementById(elementId);
  if (!elem) {
    window.print();
    return;
  }

  const ticketCode = formatTicketCode(saleId);

  let iframe = document.getElementById('thermal-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'thermal-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket ${ticketCode}</title>
        <style>
          @page {
            size: auto;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: "Courier New", Courier, monospace;
            font-size: 12px;
            line-height: 1.35;
          }
          .ticket-wrap {
            width: 76mm;
            max-width: 100%;
            margin: 0 auto;
            padding: 4mm 2mm;
            box-sizing: border-box;
          }
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div class="ticket-wrap">
          ${elem.innerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 250);
}
