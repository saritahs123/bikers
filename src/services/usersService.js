export const usersService = {
  getAllUsers: async () => {
    try {
      const response = await fetch('/api/usuarios', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Error al obtener usuarios');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('usersService.getAllUsers error:', error);
      return [];
    }
  },
  
  getUserById: async (id) => {
    try {
      const response = await fetch(`/api/usuarios/${id}`, { cache: 'no-store' });
      if (!response.ok) {
        console.warn(`usersService.getUserById: /api/usuarios/${id} returned status ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('usersService.getUserById error:', error);
      return null;
    }
  },

  getUserSessions: async (id) => {
    try {
      const response = await fetch(`/api/usuarios/${id}/sesiones`, { cache: 'no-store' });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('usersService.getUserSessions error:', error);
      return [];
    }
  },

  getUserActivity: async (id) => {
    try {
      const response = await fetch(`/api/usuarios/${id}/actividad`, { cache: 'no-store' });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('usersService.getUserActivity error:', error);
      return [];
    }
  },

  addUserActivity: async (id, activityData) => {
    try {
      const response = await fetch(`/api/usuarios/${id}/actividad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData)
      });
      return await response.json();
    } catch (error) {
      console.error('usersService.addUserActivity error:', error);
      return { success: false };
    }
  },

  getUserAuditoria: async (id, params = {}) => {
    try {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params.fechaDesde) searchParams.set('fechaDesde', params.fechaDesde);
      if (params.fechaHasta) searchParams.set('fechaHasta', params.fechaHasta);
      if (params.accion && params.accion !== 'Todos') searchParams.set('accion', params.accion);
      if (params.adminId && params.adminId !== 'Todos') searchParams.set('adminId', String(params.adminId));
      if (params.resultado && params.resultado !== 'Todos') searchParams.set('resultado', params.resultado);
      if (params.search) searchParams.set('search', params.search);
      if (params.all) searchParams.set('all', 'true');

      const queryString = searchParams.toString();
      const url = `/api/usuarios/${id}/auditoria${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return { items: [], total: 0 };
      return await response.json();
    } catch (error) {
      console.error('usersService.getUserAuditoria error:', error);
      return { items: [], total: 0 };
    }
  },

  addUserAuditoria: async (id, auditData) => {
    try {
      const response = await fetch(`/api/usuarios/${id}/auditoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData)
      });
      return await response.json();
    } catch (error) {
      console.error('usersService.addUserAuditoria error:', error);
      return { success: false };
    }
  },

  revokeUserSession: async (userId, sessionId) => {
    try {
      const response = await fetch(`/api/usuarios/${userId}/sesiones`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      return await response.json();
    } catch (error) {
      console.error('usersService.revokeUserSession error:', error);
      return { success: false };
    }
  },

  revokeAllUserSessions: async (userId, keepCurrent = true) => {
    try {
      const response = await fetch(`/api/usuarios/${userId}/sesiones`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAll: true, keepCurrent })
      });
      return await response.json();
    } catch (error) {
      console.error('usersService.revokeAllUserSessions error:', error);
      return { success: false };
    }
  },

  updateUser: async (id, userData) => {
    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status} al actualizar usuario`);
      }
      return await response.json();
    } catch (error) {
      console.error('usersService.updateUser error:', error);
      throw error;
    }
  },

  createUser: async (userData) => {
    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status} al crear usuario`);
      }
      return data;
    } catch (error) {
      console.error('usersService.createUser error:', error);
      throw error;
    }
  },

  resetPassword: async (id) => {
    try {
      const response = await fetch(`/api/usuarios/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al restablecer la contraseña');
      }
      return data;
    } catch (error) {
      console.error('usersService.resetPassword error:', error);
      throw error;
    }
  },

  deleteUser: async (id) => {
    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status} al eliminar usuario`);
      }
      return data;
    } catch (error) {
      console.error('usersService.deleteUser error:', error);
      throw error;
    }
  }
};
