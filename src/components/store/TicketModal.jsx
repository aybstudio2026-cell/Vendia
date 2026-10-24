import React, { useState } from 'react';
import Modal from '../common/Modal';
import { money } from '../../constants/palettes';
import { IconPrinter, IconWhatsApp, IconDownload, IconAlertTriangle } from '../common/Icons';
import {
  printThermalTicket,
  generateTicketImageBlob,
  downloadTicketImage,
  formatTicketCode
} from '../../utils/ticketGenerator';
import { formatPeruDate, getPeruTime } from '../../utils/dateUtils';

export default function TicketModal({
  isOpen,
  onClose,
  sale,
  products = [],
  storeName = "Minimarket La Esquina",
  storeLogo = null,
  isReceipt = false,
  onVoidSale = null,
  canVoid = true
}) {
  const [customerPhone, setCustomerPhone] = useState('');
  const [sharingStatus, setSharingStatus] = useState(null); // 'generating' | 'copied' | 'shared' | 'error'
  const [isVoidPromptOpen, setIsVoidPromptOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('Error en digitación');
  const [voidCustomReason, setVoidCustomReason] = useState('');

  if (!isOpen || !sale) return null;

  const ticketCode = formatTicketCode(sale);
  const total = sale.total || (sale.items || []).reduce((a, x) => a + x.precio * x.cantidad, 0);
  const isAnulada = sale.estado === 'anulada' || sale.estado === 'devuelta';
  const dateFormatted = formatPeruDate(sale.creado_en || sale.fecha || new Date(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeFormatted = sale.hora || getPeruTime(sale.creado_en || new Date());

  // 1. Imprimir comprobante limpio en 1 sola hoja vía iframe aislado
  const handlePrint = () => {
    printThermalTicket('thermal-receipt', ticketCode);
  };

  // 2. Descargar boleta como archivo de imagen PNG
  const handleDownloadImage = async () => {
    try {
      setSharingStatus('generating');
      await downloadTicketImage({ sale, storeName, products, storeLogo });
      setSharingStatus(null);
    } catch (err) {
      console.error('Error al descargar boleta:', err);
      setSharingStatus('error');
    }
  };

  // 3. Enviar / Compartir archivo de la boleta
  const handleShareFile = async () => {
    try {
      setSharingStatus('generating');
      const blob = await generateTicketImageBlob({ sale, storeName, products, storeLogo });
      if (!blob) {
        setSharingStatus('error');
        return;
      }

      const cleanStore = storeName.replace(/\s+/g, '_');
      const fileName = `Boleta_${cleanStore}_${ticketCode}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Boleta ${ticketCode} - ${storeName}`,
          text: `Hola, le adjuntamos su boleta de compra de ${storeName}.`
        });
        setSharingStatus('shared');
        setTimeout(() => setSharingStatus(null), 3000);
        return;
      }

      let copied = false;
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          copied = true;
        } catch (copyErr) {
          console.warn('No se pudo copiar directo al portapapeles, descargando archivo...', copyErr);
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
      const finalPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
      const targetUrl = finalPhone
        ? `https://wa.me/${finalPhone}?text=${encodeURIComponent(`Hola, le compartimos su boleta ${ticketCode} de ${storeName}.`)}`
        : `https://web.whatsapp.com/`;

      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      setSharingStatus(copied ? 'copied' : 'downloaded');
      setTimeout(() => setSharingStatus(null), 5000);
    } catch (err) {
      console.error('Error al compartir boleta:', err);
      setSharingStatus('error');
      setTimeout(() => setSharingStatus(null), 4000);
    }
  };

  // 4. Enviar resumen en texto formateado por WhatsApp
  const handleSendWhatsAppText = () => {
    let msg = `🧾 *COMPROBANTE DE PAGO*\n`;
    msg += `🏪 *${storeName}*\n`;
    msg += `📅 *Fecha:* ${dateFormatted} ${timeFormatted}\n`;
    msg += `🔢 *Ticket:* ${ticketCode}\n`;
    if (isAnulada) msg += `⚠️ *ESTADO:* ANULADA / DEVUELTA\n`;
    if (sale.usuario) msg += `👤 *Atendido por:* ${sale.usuario}\n`;
    msg += `--------------------------------\n`;
    msg += `*DETALLE DE PRODUCTOS:*\n`;

    (sale.items || []).forEach((it) => {
      const prod = products.find((p) => String(p.id) === String(it.producto_id));
      const nom = prod ? prod.nombre : (it.nombre || 'Producto');
      const sub = (it.precio * it.cantidad).toFixed(2);
      msg += `• ${it.cantidad}x ${nom} (S/. ${sub})\n`;
    });

    msg += `--------------------------------\n`;
    msg += `*TOTAL: S/. ${Number(total).toFixed(2)}*\n`;
    msg += `*Forma de pago:* ${sale.metodo_pago || 'Efectivo'}\n`;
    if (sale.pagos_mixtos && Array.isArray(sale.pagos_mixtos)) {
      sale.pagos_mixtos.forEach((pm) => {
        msg += `  - ${pm.metodo}: S/. ${Number(pm.monto).toFixed(2)}\n`;
      });
    }
    if (sale.monto_recibido) {
      msg += `*Recibido:* S/. ${Number(sale.monto_recibido).toFixed(2)}\n`;
      const vuelto = Number(sale.monto_recibido) - Number(total);
      if (vuelto >= 0) msg += `*Vuelto:* S/. ${vuelto.toFixed(2)}\n`;
    }
    msg += `--------------------------------\n`;
    msg += `_¡Muchas gracias por su preferencia!_\n`;

    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    let url = '';
    if (cleanPhone) {
      const finalPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
      url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmVoid = () => {
    if (!onVoidSale) return;
    const finalReason = voidReason === 'Otro' ? (voidCustomReason || 'Otro motivo') : voidReason;
    onVoidSale(sale, finalReason);
    setIsVoidPromptOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReceipt ? "¡Venta completada con éxito!" : `Comprobante de Venta ${ticketCode}`}
      maxWidth={460}
      centerTitle={true}
    >
      {/* Alerta de Venta Anulada */}
      {isAnulada && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#dc2626',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '14px',
            fontSize: '13px'
          }}
        >
          ⛔ ESTA VENTA HA SIDO ANULADA / DEVUELTA
          {sale.motivo_anulacion && (
            <div style={{ fontSize: '11px', fontWeight: 'normal', marginTop: '2px' }}>
              Motivo: {sale.motivo_anulacion}
            </div>
          )}
        </div>
      )}

      {/* Vista previa física del Ticket Térmico */}
      <div
        id="thermal-receipt"
        className="thermal-receipt-box"
        style={{
          background: '#ffffff',
          color: '#111111',
          border: isAnulada ? '2px dashed #ef4444' : '1px dashed var(--mist)',
          borderRadius: '8px',
          padding: '20px 16px',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '13px',
          lineHeight: '1.4',
          margin: '0 auto 16px',
          maxWidth: '320px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          position: 'relative'
        }}
      >
        {isAnulada && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-25deg)',
              border: '3px solid #dc2626',
              color: '#dc2626',
              padding: '6px 16px',
              fontSize: '20px',
              fontWeight: '900',
              letterSpacing: '2px',
              opacity: 0.85,
              pointerEvents: 'none',
              zIndex: 2
            }}
          >
            ANULADA
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          {storeLogo && (
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <img
                src={storeLogo}
                alt={storeName}
                style={{
                  maxHeight: '46px',
                  maxWidth: '140px',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            </div>
          )}
          <b style={{ fontSize: '16px', display: 'block', textTransform: 'uppercase' }}>
            {storeName}
          </b>

          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.5px' }}>BOLETA DE VENTA</span>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', letterSpacing: '1px', color: '#111' }}>
            {ticketCode}
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
            {dateFormatted} · {timeFormatted}
          </div>
          {sale.usuario && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
              Cajero: {sale.usuario}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px dashed #333', margin: '8px 0' }} />

        {/* Lista de Ítems */}
        <div style={{ display: 'grid', gap: '6px' }}>
          {(sale.items || []).map((it, idx) => {
            const p = products.find((pr) => String(pr.id) === String(it.producto_id));
            const nombre = p ? p.nombre : (it.nombre || 'Producto');
            const subtotal = it.precio * it.cantidad;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  fontSize: '12px'
                }}
              >
                <div style={{ paddingRight: '8px' }}>
                  <span>{it.cantidad}x </span>
                  <b>{nombre}</b>
                </div>
                <div style={{ whiteSpace: 'nowrap' }}>
                  {money(subtotal)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />

        {/* Totales */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold' }}>
          <span>TOTAL:</span>
          <span>{money(total)}</span>
        </div>

        <div style={{ fontSize: '11px', marginTop: '6px', color: '#444' }}>
          <div>Método: {sale.metodo_pago || 'Efectivo'}</div>
          {sale.pagos_mixtos && Array.isArray(sale.pagos_mixtos) && (
            <div style={{ paddingLeft: '8px', color: '#555' }}>
              {sale.pagos_mixtos.map((pm, i) => (
                <div key={i}>• {pm.metodo}: {money(pm.monto)}</div>
              ))}
            </div>
          )}
          {sale.monto_recibido && (
            <>
              <div>Recibido: {money(sale.monto_recibido)}</div>
              <div>Vuelto: {money(sale.monto_recibido - total)}</div>
            </>
          )}
        </div>

        <div style={{ borderTop: '1px dashed #333', margin: '10px 0' }} />

        <div style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}>
          ¡Gracias por su preferencia!
          <br />
          Conserve este comprobante
        </div>
      </div>

      {/* Envío al cliente por WhatsApp */}
      <div style={{ background: 'var(--fog)', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink)' }}>
            Enviar boleta al cliente por WhatsApp:
          </label>
          <span style={{ fontSize: '11px', color: 'var(--graphite)' }}>100% gratuito</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="tel"
            placeholder="Nº Celular (Ej: 987654321)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{ flex: 1, minHeight: '38px', fontSize: '13px' }}
          />

          <button
            type="button"
            className="btn s"
            style={{
              background: '#25D366',
              color: '#ffffff',
              border: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              minHeight: '38px'
            }}
            onClick={handleShareFile}
            title="Enviar imagen de la boleta por WhatsApp"
            disabled={sharingStatus === 'generating'}
          >
            <IconWhatsApp size={15} color="#fff" />
            <span>{sharingStatus === 'generating' ? 'Generando...' : 'Enviar Archivo'}</span>
          </button>
        </div>

        {/* Acciones secundarias digitales */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn g s"
            style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={handleSendWhatsAppText}
            title="Enviar como mensaje de texto en WhatsApp"
          >
            <IconWhatsApp size={13} />
            <span>Enviar como texto</span>
          </button>

          <button
            type="button"
            className="btn g s"
            style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={handleDownloadImage}
            title="Descargar imagen PNG de la boleta"
            disabled={sharingStatus === 'generating'}
          >
            <IconDownload size={13} />
            <span>Descargar PNG</span>
          </button>
        </div>
      </div>

      {/* Formulario de Anulación de Venta */}
      {isVoidPromptOpen && (
        <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <b style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
            ¿Estás seguro de anular esta venta?
          </b>
          <p className="hint" style={{ fontSize: '12px', margin: '0 0 10px 0' }}>
            Los productos volverán a ingresar automáticamente al inventario y se registrará la auditoría.
          </p>

          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
            <span>Motivo de la anulación / devolución:</span>
            <select
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              style={{ width: '100%', marginTop: '4px', minHeight: '38px', fontSize: '13px' }}
            >
              <option value="Error en digitación / cobro">Error en digitación / cobro</option>
              <option value="Devolución de cliente">Devolución de cliente</option>
              <option value="Cambio de producto">Cambio de producto</option>
              <option value="Producto en mal estado">Producto en mal estado</option>
              <option value="Otro">Otro motivo</option>
            </select>
          </label>

          {voidReason === 'Otro' && (
            <input
              type="text"
              placeholder="Especifica el motivo..."
              value={voidCustomReason}
              onChange={(e) => setVoidCustomReason(e.target.value)}
              style={{ width: '100%', marginBottom: '10px', minHeight: '36px' }}
            />
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn s"
              style={{ background: '#dc2626', color: '#ffffff', border: 'none', flex: 1, minHeight: '38px' }}
              onClick={handleConfirmVoid}
            >
              Confirmar Anulación
            </button>
            <button
              type="button"
              className="btn o s"
              style={{ minHeight: '38px' }}
              onClick={() => setIsVoidPromptOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botones de Acción Principales */}
      <div className="acts" style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn o"
          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '44px' }}
          onClick={handlePrint}
          title="Imprimir comprobante en impresora térmica o estándar"
        >
          <IconPrinter size={16} />
          <span>Imprimir Ticket</span>
        </button>

        {onVoidSale && canVoid && !isAnulada && !isVoidPromptOpen && (
          <button
            type="button"
            className="btn o"
            style={{ color: '#dc2626', borderColor: '#fca5a5', minHeight: '44px' }}
            onClick={() => setIsVoidPromptOpen(true)}
            title="Anular venta y reingresar existencias al stock"
          >
            Anular / Devolver
          </button>
        )}

        <button
          type="button"
          className="btn p"
          style={{ flex: 1, minHeight: '44px' }}
          onClick={onClose}
        >
          {isReceipt ? 'Nueva venta' : 'Cerrar'}
        </button>
      </div>
    </Modal>
  );
}
