import React, { useState, useEffect } from 'react';
import {
  getSaaSComunicados,
  fetchSaaSComunicados,
  saveSaaSComunicado,
  deleteSaaSComunicado,
  resetDismissedComunicados,
  logSaaSAuditEvent
} from '../../services/saasService';
import { IconMegaphone, IconCheck, IconAlertTriangle } from '../common/Icons';
import { fd } from '../../constants/palettes';
import ConfirmCornerModal from '../common/ConfirmCornerModal';

export default function ComunicadosTab() {
  const [comunicados, setComunicados] = useState(() => {
    const initial = getSaaSComunicados();
    return Array.isArray(initial) ? initial : [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCom, setEditingCom] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, titulo }

  useEffect(() => {
    let isMounted = true;
    fetchSaaSComunicados()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setComunicados(data);
        }
      })
      .catch((e) => console.warn('Aviso sincronizando comunicados:', e));
    return () => {
      isMounted = false;
    };
  }, []);

  // Formulario
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState('novedad'); // 'novedad' | 'aviso' | 'alerta' | 'urgente'

  const handleOpenCreate = () => {
    setEditingCom(null);
    setTitulo('');
    setMensaje('');
    setTipo('novedad');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (com) => {
    setEditingCom(com);
    setTitulo(com.titulo);
    setMensaje(com.mensaje);
    setTipo(com.tipo || 'aviso');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!titulo.trim() || !mensaje.trim()) {
      alert('Por favor ingresa un título y mensaje para el comunicado.');
      return;
    }

    const payload = {
      ...(editingCom ? { id: editingCom.id } : {}),
      titulo: titulo.trim(),
      mensaje: mensaje.trim(),
      tipo,
      activo: true
    };

    const updated = await saveSaaSComunicado(payload);
    setComunicados(Array.isArray(updated) ? updated : getSaaSComunicados());

    logSaaSAuditEvent({
      tipo: 'comunicado',
      accion: editingCom ? 'Comunicado actualizado' : 'Comunicado publicado',
      detalle: `Anuncio global: "${payload.titulo}" (${payload.tipo}).`,
      tienda: 'Todas las tiendas'
    });

    setIsModalOpen(false);
  };

  const handleToggleActivo = async (com) => {
    const nextActivo = !com.activo;
    const updated = await saveSaaSComunicado({ ...com, activo: nextActivo });
    setComunicados(Array.isArray(updated) ? updated : getSaaSComunicados());

    logSaaSAuditEvent({
      tipo: 'comunicado',
      accion: nextActivo ? 'Comunicado activado' : 'Comunicado pausado',
      detalle: `El anuncio "${com.titulo}" ahora está ${nextActivo ? 'visible' : 'oculto'}.`,
      tienda: 'Todas las tiendas'
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, titulo } = deleteConfirm;
    const updated = await deleteSaaSComunicado(id);
    setComunicados(Array.isArray(updated) ? updated : getSaaSComunicados());

    logSaaSAuditEvent({
      tipo: 'comunicado',
      accion: 'Comunicado eliminado',
      detalle: `Se eliminó el comunicado "${titulo}".`,
      tienda: 'Todas las tiendas'
    });
  };

  const getTipoBadge = (t) => {
    switch (t) {
      case 'novedad':
        return { label: 'Novedad / Lanzamiento', bg: 'rgba(0, 200, 83, 0.12)', color: '#059669' };
      case 'alerta':
        return { label: 'Advertencia', bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706' };
      case 'urgente':
        return { label: 'Mantenimiento / Urgente', bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' };
      default:
        return { label: 'Aviso General', bg: 'rgba(0, 229, 255, 0.15)', color: '#0284c7' };
    }
  };

  const handleResetDismissed = () => {
    resetDismissedComunicados();
    setFeedbackMsg('¡Listo! Se ha restablecido el historial de avisos cerrados. Si vas a la vista de tienda, podrás ver los comunicados activos de nuevo.');
    setTimeout(() => setFeedbackMsg(''), 5000);
  };

  return (
    <div>
      {/* Cabecera */}
      <div className="bar">
        <div>
          <h1>Comunicados Globales</h1>
          <p className="lead">Publica avisos y anuncios en la barra superior de todas las tiendas suscritas.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn s"
            style={{ fontSize: '11px', padding: '5px 12px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
            onClick={handleResetDismissed}
            title="Si cerraste un aviso con la 'X' en este navegador, haz clic aquí para volver a verlo en la vista tienda"
          >
            👁️ Restablecer avisos cerrados
          </button>
          <button type="button" className="btn p s" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={handleOpenCreate}>
            + Publicar Comunicado
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{ padding: '10px 14px', marginBottom: '14px', borderRadius: '6px', background: '#ecfdf5', color: '#065f46', fontSize: '12px', border: '1px solid #a7f3d0' }}>
          {feedbackMsg}
        </div>
      )}

      {/* Lista de Comunicados */}
      <div className="card sec">
        <h2>Anuncios Publicados ({Array.isArray(comunicados) ? comunicados.length : 0})</h2>
        {(Array.isArray(comunicados) && comunicados.length > 0) ? (
          <div>
            {comunicados.map((com) => {
              const badge = getTipoBadge(com.tipo);
              return (
                <div
                  key={com.id}
                  className="li"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    borderBottom: '1px solid #f1f5f9',
                    background: com.activo ? 'transparent' : '#f8fafc',
                    opacity: com.activo ? 1 : 0.75
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '2px 8px',
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

                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: com.activo ? '#00C853' : '#64748b',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ● {com.activo ? 'Activo en tiendas' : 'En pausa'}
                      </span>

                      <small style={{ color: '#64748b', fontSize: '10px' }}>
                        Publicado: {fd(com.fecha)}
                      </small>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn o s"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        onClick={() => handleToggleActivo(com)}
                      >
                        {com.activo ? 'Pausar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="btn o s"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        onClick={() => handleOpenEdit(com)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn o s"
                        style={{ padding: '2px 8px', fontSize: '10px', color: '#e53935' }}
                        onClick={() => setDeleteConfirm({ id: com.id, titulo: com.titulo })}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{com.titulo}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                      {com.mensaje}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pad empty" style={{ textAlign: 'center', padding: '36px' }}>
            No hay comunicados registrados aún.
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Comunicado */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                {editingCom ? 'Editar Comunicado' : 'Publicar Nuevo Comunicado'}
              </h2>
              <button type="button" className="btn g s" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Tipo de anuncio
                </label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="novedad">🚀 Novedad / Nueva Función</option>
                  <option value="aviso">ℹ️ Aviso General / Recordatorio</option>
                  <option value="alerta">⚠️ Advertencia / Cambio Importante</option>
                  <option value="urgente">🛑 Mantenimiento / Urgente</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Título del comunicado
                </label>
                <input
                  type="text"
                  placeholder="Ej: ¡Nuevo módulo de Escáner y Pistola disponible!"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Mensaje para los dueños de tienda
                </label>
                <textarea
                  rows="4"
                  placeholder="Detalla la novedad o aviso..."
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--mist)',
                    background: 'var(--paper)',
                    fontFamily: 'inherit',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              {/* Vista Previa en tiempo real */}
              <div
                style={{
                  background: 'var(--fog)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px dashed var(--mist)'
                }}
              >
                <small style={{ fontWeight: 600, color: 'var(--graphite)', display: 'block', marginBottom: '6px' }}>
                  Vista previa en la barra superior de las tiendas:
                </small>
                <div
                  style={{
                    background: 'var(--carbon)',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <b>{titulo || 'Título del anuncio'}</b> — {mensaje || 'Mensaje del anuncio...'}
                  </div>
                  <span style={{ opacity: 0.6, fontSize: '11px' }}>✕</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn o" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn p">
                  {editingCom ? 'Guardar Cambios' : 'Publicar Ahora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal flotante en esquina inferior derecha para confirmar eliminación */}
      <ConfirmCornerModal
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar comunicado?"
        itemName={deleteConfirm?.titulo || ''}
        itemType="comunicado"
        description="Este anuncio se retirará de la barra superior de todas las tiendas suscritas de forma inmediata."
        confirmText="Eliminar comunicado"
      />
    </div>
  );
}
