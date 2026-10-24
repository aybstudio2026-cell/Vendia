import React, { useState, useEffect } from 'react';
import {
  money,
  fd,
  diffDays,
  PERIODICIDAD,
  MODULOS_DEF
} from '../../constants/palettes';
import { IconWhatsApp, IconTrending, IconEye } from '../common/Icons';
import { resolveStorePlan } from '../../services/saasService';
import Pagination from '../common/Pagination';

const ITEMS_PER_PAGE = 10;

const PLAN_META = {
  basico: { color: '#3b82f6', label: 'Plan Emprendedor', short: 'Emprendedor' },
  pro: { color: '#10b981', label: 'Plan Negocio Pro', short: 'Negocio Pro' },
  full: { color: '#8b5cf6', label: 'Plan Full Suite / Multi-Tienda', short: 'Full Suite' }
};

function getPlanInfo(planCode) {
  if (planCode === 'full' || planCode === 'plan_full') return PLAN_META.full;
  if (planCode === 'pro' || planCode === 'plan_pro') return PLAN_META.pro;
  return PLAN_META.basico;
}

export default function TiendasTab({
  stores = [],
  onOpenStore,
  onOpenNewStore,
  onImpersonateStore
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const getStoreStatus = (s) => {
    if (s.estado === 'suspendida') return { cls: 'sus', label: 'Suspendida', key: 'susp' };
    const days = diffDays(s.proximo_pago || s.proximo);
    if (days < 0) return { cls: 'out', label: 'Vencida', key: 'vencida' };
    if (days <= 3) return { cls: 'low', label: 'Vence pronto', key: 'warn' };
    return { cls: 'ok', label: 'Al día', key: 'ok' };
  };

  const activeStores = stores.filter((s) => s.estado === 'activa');
  // MRR: Ingreso Mensual Recurrente
  const mrr = activeStores.reduce(
    (sum, s) => sum + (s.monto / (s.periodicidad_meses || s.per || 1)),
    0
  );
  // ARR: Ingreso Anual Proyectado
  const arr = mrr * 12;

  const pagosProximos7Dias = activeStores.filter((s) => {
    const d = diffDays(s.proximo_pago || s.proximo);
    return d >= 0 && d <= 7;
  });
  const pagosVencidos = stores.filter((s) => {
    return diffDays(s.proximo_pago || s.proximo) < 0;
  });
  const porCobrarMonto = [...pagosProximos7Dias, ...pagosVencidos].reduce((sum, s) => sum + (s.monto || 0), 0);
  const retentionRate = stores.length > 0 ? Math.round((activeStores.length / stores.length) * 100) : 100;

  const filteredStores = stores.filter((s) => {
    const textMatch =
      (s.nombre + ' ' + (s.dueno || '')).toLowerCase().includes(searchTerm.toLowerCase());
    const status = getStoreStatus(s);
    const statusMatch = statusFilter === 'todas' || status.key === statusFilter;
    return textMatch && statusMatch;
  });

  const totalItems = filteredStores.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedStores = filteredStores.slice(startIndex, endIndex);

  const handleSendReminder = (e, store) => {
    e.stopPropagation();
    const prox = fd(store.proximo_pago || store.proximo);
    const montoFmt = money(store.monto);
    let msg = `Hola ${store.dueno || 'estimado cliente'}, te saludamos del equipo de Vendia (by A&B Studio).\n\n`;
    msg += `Te recordamos cordialmente que la suscripción de tu tienda *${store.nombre}* por el monto de *${montoFmt}* vence el *${prox}*.\n\n`;
    msg += `Agradecemos enviar tu comprobante de pago por este medio para mantener tu servicio 100% activo. ¡Muchas gracias!`;

    const phone = (store.dueno_telefono || store.telefono || '').replace(/[^\d+]/g, '');
    const url = phone
      ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <div className="bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1>Tiendas y Suscripciones</h1>
            <span className="chip" style={{ background: 'rgba(0, 229, 255, 0.12)', color: '#0284c7', borderColor: 'rgba(0, 229, 255, 0.35)', fontWeight: 700, fontSize: '9.5px', padding: '2px 8px' }}>
              Vendia Cloud
            </span>
          </div>
          <p className="lead">{stores.length} tiendas registradas en la plataforma.</p>
        </div>
        <button type="button" className="btn p s" style={{ fontSize: '11.5px', padding: '6px 14px' }} onClick={onOpenNewStore}>
          Agregar tienda
        </button>
      </div>

      {/* Métricas Financieras del SaaS (MRR, ARR, Cartera y Retención) */}
      <div className="sec stats vendia-kpi-grid">
        <div className="stat kpi-emerald">
          <b>{money(mrr)}</b>
          <span>MRR (Ingreso Mensual)</span>
        </div>
        <div className="stat kpi-cyan">
          <b>{money(arr)}</b>
          <span>ARR Proyectado Anual</span>
        </div>
        <div className="stat kpi-navy">
          <b>{money(porCobrarMonto)}</b>
          <span>Por Cobrar / Vencido ({pagosProximos7Dias.length + pagosVencidos.length})</span>
        </div>
        <div className="stat kpi-light">
          <b>{retentionRate}%</b>
          <span>Salud ({activeStores.length} de {stores.length} activas)</span>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <input
        type="search"
        placeholder="Buscar por tienda o dueño"
        aria-label="Buscar"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 14, fontSize: '11.5px' }}
      />

      <div className="pills">
        {[
          ['todas', 'Todas'],
          ['ok', 'Al día'],
          ['warn', 'Vence pronto'],
          ['vencida', 'Vencidas'],
          ['susp', 'Suspendidas']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="pill"
            aria-pressed={statusFilter === key}
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Barra de estado y leyenda visual de planes */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '10px',
        padding: '0 2px'
      }}>
        <span style={{ fontSize: '9.5px', color: 'var(--graphite)', fontWeight: 500 }}>
          {filteredStores.length} {filteredStores.length === 1 ? 'tienda registrada' : 'tiendas registradas'}
        </span>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--fog)',
          padding: '2px 8px',
          borderRadius: '20px',
          border: '1px solid var(--mist)',
          fontSize: '9.5px',
          color: 'var(--ink)'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--graphite)' }}>Planes:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            Emprendedor
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Negocio Pro
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
            Full Suite
          </span>
        </div>
      </div>

      {/* Tabla de Tiendas */}
      <div className="card">
        <div className="head t-tiendas">
          <div style={{ textAlign: 'center' }}>Plan</div>
          <div>Tienda</div>
          <div>Estado</div>
          <div>Contrato desde</div>
          <div>Pago</div>
          <div>Próximo pago</div>
        </div>

        {paginatedStores.length > 0 ? (
          paginatedStores.map((s) => {
            const st = getStoreStatus(s);
            const resolvedPlan = resolveStorePlan(s.plan, s.monto, s.modulos);
            const planInfo = getPlanInfo(resolvedPlan.codigo || s.plan);

            return (
              <button
                key={s.id}
                type="button"
                className="row t-tiendas"
                onClick={() => onOpenStore(s)}
              >
                {/* Columna pequeña de Plan con color asociado */}
                <div data-l="Plan" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span
                    title={`Plan: ${resolvedPlan.nombre}`}
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: planInfo.color,
                      boxShadow: `0 0 0 3px ${planInfo.color}28`,
                      display: 'inline-block',
                      cursor: 'help'
                    }}
                  />
                </div>

                <div className="n">
                  <b style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{s.nombre}</b>
                  <span className="hint" style={{ fontSize: '10.5px', marginTop: '2px', display: 'block' }}>
                    {s.dueno}
                  </span>
                </div>

                <div data-l="Estado">
                  <span className={`chip ${st.cls}`} style={{ fontSize: '10.5px', padding: '2px 7px' }}>
                    {st.label}
                  </span>
                </div>

                <div data-l="Contrato desde" style={{ fontSize: '11.5px', color: 'var(--ink)' }}>
                  {fd(s.fecha_inicio || s.inicio)}
                </div>

                <div data-l="Pago" style={{ fontSize: '11.5px', color: 'var(--ink)' }}>
                  {money(s.monto)} /{' '}
                  {PERIODICIDAD[s.periodicidad_meses || s.per] || 'mes'}
                </div>

                <div data-l="Próximo pago" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {fd(s.proximo_pago || s.proximo)}
                  </span>
                  <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                    <span
                      role="button"
                      tabIndex={0}
                      className="btn o s"
                      style={{
                        padding: '2px 7px',
                        minHeight: '24px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        borderRadius: '5px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onImpersonateStore) onImpersonateStore(s);
                      }}
                      title="Ver como tienda en modo solo lectura (Superadmin)"
                    >
                      <IconEye size={12} color="currentColor" />
                      <span>Ver</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="btn o s"
                      style={{
                        borderColor: '#25D366',
                        color: '#128C7E',
                        background: 'rgba(37, 211, 102, 0.08)',
                        padding: '2px 7px',
                        minHeight: '24px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        borderRadius: '5px'
                      }}
                      onClick={(e) => handleSendReminder(e, s)}
                      title="Enviar recordatorio de cobro por WhatsApp"
                    >
                      <IconWhatsApp size={12} color="#25D366" />
                      <span>Cobrar</span>
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="empty" style={{ fontSize: '12px' }}>No hay tiendas con esos filtros.</div>
        )}

        <Pagination
          currentPage={validPage}
          totalItems={totalItems}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          noun="tiendas"
        />
      </div>
    </div>
  );
}
