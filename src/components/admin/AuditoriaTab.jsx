import React, { useState, useEffect } from 'react';
import { getSaaSAuditLogs, fetchSaaSAuditLogs } from '../../services/saasService';
import { IconAuditoria, IconShield, IconDownload } from '../common/Icons';
import { fd } from '../../constants/palettes';
import { getPeruDateIso } from '../../utils/dateUtils';
import Pagination from '../common/Pagination';

const ITEMS_PER_PAGE = 10;

export default function AuditoriaTab() {
  const [logs, setLogs] = useState(() => getSaaSAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    fetchSaaSAuditLogs()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setLogs(data);
        }
      })
      .catch((e) => console.warn('Aviso sincronizando auditoria:', e));
    return () => {
      isMounted = false;
    };
  }, []);

  // Al cambiar filtros o búsqueda, volver a la página 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const filteredLogs = logs.filter((item) => {
    const textMatch =
      (item.accion + ' ' + item.detalle + ' ' + item.tienda + ' ' + item.usuario).toLowerCase().includes(searchTerm.toLowerCase());
    const catMatch = categoryFilter === 'todos' || item.tipo === categoryFilter;
    return textMatch && catMatch;
  });

  // Cálculos de Paginación
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  const getCategoryBadge = (tipo) => {
    switch (tipo) {
      case 'modulo':
        return { label: 'MÓDULO', bg: 'rgba(0, 229, 255, 0.15)', color: '#0284c7' };
      case 'pago':
        return { label: 'PAGO', bg: 'rgba(0, 200, 83, 0.12)', color: '#059669' };
      case 'usuario':
        return { label: 'USUARIO', bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' };
      case 'comunicado':
        return { label: 'COMUNICADO', bg: 'rgba(6, 182, 212, 0.12)', color: '#0891b2' };
      case 'seguridad':
        return { label: 'SEGURIDAD', bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' };
      default:
        return { label: 'TIENDA', bg: 'rgba(13, 21, 39, 0.08)', color: '#0d1527' };
    }
  };

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Accion', 'Detalle', 'Tienda', 'Usuario'];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.fecha).toLocaleString()}"`,
      `"${l.tipo}"`,
      `"${l.accion.replace(/"/g, '""')}"`,
      `"${l.detalle.replace(/"/g, '""')}"`,
      `"${l.tienda.replace(/"/g, '""')}"`,
      `"${l.usuario.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Auditoria_SaaS_${getPeruDateIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Cabecera */}
      <div className="bar">
        <div>
          <h1>Historial de Auditoría & Seguridad</h1>
          <p className="lead">Trazabilidad completa de acciones críticas, pagos, cambios de módulos y accesos.</p>
        </div>
        <button
          type="button"
          className="btn o s"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '5px 12px' }}
          onClick={handleExportCSV}
        >
          <IconDownload size={13} />
          <span>Exportar CSV</span>
        </button>
      </div>

      {/* Filtros */}
      <div
        className="sec"
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
          <input
            type="search"
            placeholder="Buscar por acción, tienda, usuario o detalle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', minHeight: '34px', fontSize: '11.5px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 600 }}>Categoría:</span>
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'modulo', label: 'Módulos' },
            { id: 'pago', label: 'Pagos' },
            { id: 'tienda', label: 'Tiendas' },
            { id: 'usuario', label: 'Usuarios' },
            { id: 'comunicado', label: 'Comunicados' },
            { id: 'seguridad', label: 'Seguridad' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`btn s ${categoryFilter === cat.id ? 'p' : 'o'}`}
              style={{ padding: '2px 9px', minHeight: '28px', fontSize: '10px' }}
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Registros de Auditoría */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '15px' }}>Registros de Actividad ({totalItems})</h2>
          {totalItems > 0 && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Mostrando {startIndex + 1} - {endIndex} de {totalItems}
            </span>
          )}
        </div>

        {totalItems > 0 ? (
          <div>
            <div style={{ minWidth: '660px', overflowX: 'auto' }}>
              {paginatedLogs.map((item) => {
                const badge = getCategoryBadge(item.tipo);
                const dateObj = new Date(item.fecha);
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = fd(item.fecha);

                return (
                  <div
                    key={item.id}
                    className="li"
                    style={{
                      padding: '12px 20px',
                      display: 'grid',
                      gridTemplateColumns: '110px 105px minmax(240px, 1fr) 140px',
                      alignItems: 'center',
                      gap: '12px',
                      borderBottom: '1px solid #f1f5f9'
                    }}
                  >
                    {/* Fecha y hora */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '11.5px', color: '#0f172a' }}>{dateStr}</div>
                      <small style={{ color: '#64748b', fontSize: '10px' }}>{timeStr}</small>
                    </div>

                    {/* Badge de Categoría */}
                    <div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: badge.bg,
                          color: badge.color
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Acción y detalle */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '2px', color: '#0f172a' }}>
                        {item.accion}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: '1.4' }}>
                        {item.detalle}
                      </div>
                    </div>

                    {/* Tienda y Usuario */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: '11.5px', color: '#0f172a' }}>
                        {item.tienda}
                      </div>
                      <small style={{ color: '#64748b', fontSize: '10px' }}>Por: {item.usuario}</small>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pie de Paginación Reutilizable */}
            <Pagination
              currentPage={validPage}
              totalItems={totalItems}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              noun="registros"
            />
          </div>
        ) : (
          <div className="pad empty" style={{ textAlign: 'center', padding: '36px' }}>
            No se encontraron registros de auditoría con los filtros actuales.
          </div>
        )}
      </div>
    </div>
  );
}
