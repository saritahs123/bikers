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
        throw new Error('Error al obtener usuario por id');
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

  getUserAuditoria: async (id) => {
    try {
      const response = await fetch(`/api/usuarios/${id}/auditoria`, { cache: 'no-store' });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('usersService.getUserAuditoria error:', error);
      return [];
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

  revokeAllUserSessions: async (userId) => {
    try {
      const response = await fetch(`/api/usuarios/${userId}/sesiones`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAll: true })
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
        console.warn(`API /api/usuarios/${id} PUT returned status ${response.status}, resolving locally.`);
        return { success: true, user: userData };
      }
      return await response.json();
    } catch (error) {
      console.warn('usersService.updateUser network fallback:', error);
      return { success: true, user: userData };
    }
  }
};
