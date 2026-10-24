import React, { useState, useEffect } from 'react';
import { getSaaSUsers, updateSaaSUserStatus, logSaaSAuditEvent } from '../../services/saasService';
import { IconUsers, IconShield, IconFilter } from '../common/Icons';
import { fd } from '../../constants/palettes';
import Pagination from '../common/Pagination';

const ITEMS_PER_PAGE = 10;

export default function UsuariosTab({ stores = [] }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Formulario nuevo usuario
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('dueno');
  const [newUserStore, setNewUserStore] = useState(stores[0]?.id || '');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getSaaSUsers();
      setUsers(data);
    } catch (e) {
      console.error('Error cargando usuarios:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (user) => {
    const nextStatus = !user.activo;
    try {
      await updateSaaSUserStatus(user.id, user.memberId, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, activo: nextStatus } : u))
      );
      logSaaSAuditEvent({
        tipo: 'usuario',
        accion: nextStatus ? 'Usuario reactivado' : 'Usuario suspendido',
        detalle: `Se cambió el estado del usuario ${user.nombre} (${user.correo}) a ${nextStatus ? 'Activo' : 'Suspendido'}.`,
        tienda: user.tiendaNombre
      });
    } catch (err) {
      alert('Error al actualizar estado del usuario: ' + err.message);
    }
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      alert('Por favor completa el nombre y correo del usuario.');
      return;
    }

    const selectedStoreObj = stores.find((s) => s.id === newUserStore);

    const newUser = {
      id: 'usr_' + Date.now(),
      nombre: newUserName.trim(),
      correo: newUserEmail.trim().toLowerCase(),
      es_superadmin: newUserRole === 'superadmin',
      rol: newUserRole,
      activo: true,
      tiendaNombre: selectedStoreObj ? selectedStoreObj.nombre : (newUserRole === 'superadmin' ? 'Administración Global' : 'Sin asignar'),
      tiendaId: newUserStore || null,
      creado_en: new Date().toISOString()
    };

    setUsers([newUser, ...users]);
    logSaaSAuditEvent({
      tipo: 'usuario',
      accion: 'Usuario registrado',
      detalle: `Nuevo usuario registrado: ${newUser.nombre} con rol ${newUser.rol} en ${newUser.tiendaNombre}.`,
      tienda: newUser.tiendaNombre
    });

    setNewUserName('');
    setNewUserEmail('');
    setIsInviteModalOpen(false);
    alert(`Usuario ${newUser.nombre} agregado exitosamente.`);
  };

  // Filtrado de usuarios
  const filteredUsers = users.filter((u) => {
    const textMatch =
      (u.nombre + ' ' + u.correo + ' ' + (u.tiendaNombre || '')).toLowerCase().includes(searchTerm.toLowerCase());
    
    let roleMatch = true;
    if (roleFilter !== 'todos') {
      roleMatch = u.rol === roleFilter;
    }

    let statusMatch = true;
    if (statusFilter === 'activos') statusMatch = u.activo === true;
    if (statusFilter === 'inactivos') statusMatch = u.activo === false;

    return textMatch && roleMatch && statusMatch;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const countSuperadmins = users.filter((u) => u.es_superadmin || u.rol === 'superadmin').length;
  const countDuenos = users.filter((u) => u.rol === 'dueno').length;
  const countEmpleados = users.filter((u) => u.rol === 'empleado').length;

  return (
    <div>
      {/* Cabecera */}
      <div className="bar">
        <div>
          <h1>Usuarios y Cuentas</h1>
          <p className="lead">Directorio global de dueños, cajeros y administradores del sistema.</p>
        </div>
        <button
          type="button"
          className="btn p s"
          style={{ fontSize: '11px', padding: '5px 12px' }}
          onClick={() => setIsInviteModalOpen(true)}
        >
          + Registrar Usuario
        </button>
      </div>

      {/* Contadores */}
      <div className="sec stats vendia-kpi-grid">
        <div className="stat kpi-emerald">
          <b>{users.length}</b>
          <span>Usuarios Totales</span>
        </div>
        <div className="stat kpi-cyan">
          <b>{countDuenos}</b>
          <span>Dueños de Tienda</span>
        </div>
        <div className="stat kpi-navy">
          <b>{countEmpleados}</b>
          <span>Cajeros / Empleados</span>
        </div>
        <div className="stat kpi-light">
          <b>{countSuperadmins}</b>
          <span>Superadministradores</span>
        </div>
      </div>

      {/* Filtros y Buscador */}
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
            placeholder="Buscar por nombre, correo o tienda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', minHeight: '34px', fontSize: '11.5px' }}
          />
        </div>

        {/* Filtros de Rol */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 600 }}>Rol:</span>
          {['todos', 'dueno', 'empleado', 'superadmin'].map((r) => (
            <button
              key={r}
              type="button"
              className={`btn s ${roleFilter === r ? 'p' : 'o'}`}
              style={{ padding: '2px 9px', minHeight: '28px', fontSize: '10px', textTransform: 'capitalize' }}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'todos' ? 'Todos' : r === 'dueno' ? 'Dueños' : r === 'empleado' ? 'Cajeros' : 'Superadmin'}
            </button>
          ))}
        </div>

        {/* Filtros de Estado */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 600 }}>Estado:</span>
          {['todos', 'activos', 'inactivos'].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn s ${statusFilter === st ? 'p' : 'o'}`}
              style={{ padding: '2px 9px', minHeight: '28px', fontSize: '10px', textTransform: 'capitalize' }}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '15px' }}>Directorio ({totalItems})</h2>
          {totalItems > 0 && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Mostrando {startIndex + 1} - {endIndex} de {totalItems}
            </span>
          )}
        </div>
        {paginatedUsers.length > 0 ? (
          <div>
            {paginatedUsers.map((u) => {
              const initials = (u.nombre || 'U')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={u.id}
                  className="li"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 1.5fr) minmax(140px, 1fr) 120px 95px 85px',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 18px',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  {/* Nombre y Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: u.es_superadmin
                          ? 'linear-gradient(135deg, #00C853 0%, #00E5FF 100%)'
                          : u.rol === 'dueno'
                          ? '#0d1527'
                          : '#f1f5f9',
                        color: u.es_superadmin || u.rol === 'dueno' ? '#ffffff' : '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        flexShrink: 0
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.nombre}
                      </div>
                      <small style={{ color: '#64748b', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '10px' }}>
                        {u.correo}
                      </small>
                    </div>
                  </div>

                  {/* Tienda */}
                  <div style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: 500 }}>
                    {u.tiendaNombre}
                  </div>

                  {/* Rol Badge */}
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          u.rol === 'superadmin'
                            ? 'rgba(0, 200, 83, 0.12)'
                            : u.rol === 'dueno'
                            ? 'rgba(0, 229, 255, 0.15)'
                            : '#f1f5f9',
                        color:
                          u.rol === 'superadmin'
                            ? '#059669'
                            : u.rol === 'dueno'
                            ? '#0284c7'
                            : '#64748b'
                      }}
                    >
                      {u.rol === 'dueno' ? 'Dueño' : u.rol === 'empleado' ? 'Cajero' : u.rol}
                    </span>
                  </div>

                  {/* Estado Badge */}
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: u.activo ? '#10b981' : '#e53935',
                        marginRight: '5px'
                      }}
                    />
                    <span style={{ fontSize: '10.5px', fontWeight: 500 }}>
                      {u.activo ? 'Activo' : 'Suspendido'}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div style={{ textAlign: 'right' }}>
                    {u.rol !== 'superadmin' && (
                      <button
                        type="button"
                        className="btn o s"
                        style={{
                          fontSize: '9.5px',
                          padding: '2px 7px',
                          color: u.activo ? '#e53935' : '#10b981',
                          borderColor: u.activo ? 'rgba(229, 57, 53, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                        }}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.activo ? 'Suspender' : 'Activar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <Pagination
              currentPage={validPage}
              totalItems={totalItems}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              noun="usuarios"
            />
          </div>
        ) : (
          <div className="pad empty" style={{ textAlign: 'center', padding: '36px' }}>
            No se encontraron usuarios con los filtros seleccionados.
          </div>
        )}
      </div>

      {/* Modal Registrar Usuario */}
      {isInviteModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsInviteModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '18px' }}>Registrar Nuevo Usuario</h2>
              <button type="button" className="btn g s" onClick={() => setIsInviteModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Nombre completo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Carlos Mendoza"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="carlos@gmail.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Rol en el sistema
                </label>
                <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                  <option value="dueno">Dueño de Tienda</option>
                  <option value="empleado">Cajero / Empleado</option>
                  <option value="superadmin">Superadmin (Acceso Total)</option>
                </select>
              </div>

              {newUserRole !== 'superadmin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Asignar a Tienda
                  </label>
                  <select value={newUserStore} onChange={(e) => setNewUserStore(e.target.value)}>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} ({s.estado})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn o" onClick={() => setIsInviteModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn p">
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
