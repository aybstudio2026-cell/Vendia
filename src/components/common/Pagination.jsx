import React from 'react';
import { IconChevronLeft, IconChevronRight } from './Icons';

/**
 * Componente de paginación reutilizable para tablas y listas de administración.
 */
export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  noun = 'registros'
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  if (totalItems === 0) return null;

  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const getPageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: '#fafbfc',
        borderTop: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: '12px'
      }}
    >
      <div style={{ fontSize: '12px', color: '#64748b' }}>
        Mostrando <b style={{ color: '#0f172a' }}>{startIndex + 1}</b> - <b style={{ color: '#0f172a' }}>{endIndex}</b> de <b style={{ color: '#0f172a' }}>{totalItems}</b> {noun}
        {totalPages > 1 && (
          <span style={{ marginLeft: '6px', color: '#94a3b8' }}>
            (Página {validPage} de {totalPages} · {itemsPerPage} por pág.)
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, validPage - 1))}
            disabled={validPage <= 1}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: validPage <= 1 ? '#f8fafc' : '#ffffff',
              color: validPage <= 1 ? '#94a3b8' : '#334155',
              fontSize: '11.5px',
              fontWeight: 500,
              cursor: validPage <= 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Página anterior"
          >
            <IconChevronLeft size={14} />
            <span>Anterior</span>
          </button>

          {getPageNumbers(validPage, totalPages).map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px' }}>
                  …
                </span>
              );
            }
            const isActive = p === validPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '28px',
                  height: '28px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #0f172a' : '1px solid #cbd5e1',
                  background: isActive ? '#0f172a' : '#ffffff',
                  color: isActive ? '#ffffff' : '#334155',
                  fontSize: '11.5px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, validPage + 1))}
            disabled={validPage >= totalPages}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: validPage >= totalPages ? '#f8fafc' : '#ffffff',
              color: validPage >= totalPages ? '#94a3b8' : '#334155',
              fontSize: '11.5px',
              fontWeight: 500,
              cursor: validPage >= totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Página siguiente"
          >
            <span>Siguiente</span>
            <IconChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
