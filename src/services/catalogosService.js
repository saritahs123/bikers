export const catalogosService = {
  getEmpresas: async () => {
    try {
      const res = await fetch('/api/empresas', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map(e => ({
        id: e.id || e.empresa_id,
        empresa_id: e.empresa_id || e.id,
        name: e.nombre_comercial || e.nombre || e.codigo || `Empresa ${e.id}`,
        nombre: e.nombre_comercial || e.nombre,
        ...e
      }));
    } catch (err) {
      console.error('catalogosService.getEmpresas error:', err);
      return [];
    }
  },

  getDepartamentos: async () => {
    try {
      const res = await fetch('/api/departamentos', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map(d => ({
        id: d.id || d.departamento_id,
        departamento_id: d.departamento_id || d.id,
        name: d.nombre || `Departamento ${d.id}`,
        nombre: d.nombre,
        ...d
      }));
    } catch (err) {
      console.error('catalogosService.getDepartamentos error:', err);
      return [];
    }
  },

  getAreas: async () => {
    try {
      const res = await fetch('/api/areas', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map(a => ({
        id: a.id || a.area_id,
        area_id: a.area_id || a.id,
        department_id: a.departamento_id || a.department_id,
        departamento_id: a.departamento_id || a.department_id,
        name: a.nombre || `Área ${a.id}`,
        nombre: a.nombre,
        ...a
      }));
    } catch (err) {
      console.error('catalogosService.getAreas error:', err);
      return [];
    }
  },

  getCargos: async () => {
    try {
      const res = await fetch('/api/cargos', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map(c => ({
        id: c.id || c.cargo_id,
        cargo_id: c.cargo_id || c.id,
        name: c.nombre || `Cargo ${c.id}`,
        nombre: c.nombre,
        ...c
      }));
    } catch (err) {
      console.error('catalogosService.getCargos error:', err);
      return [];
    }
  },

  getTiposUsuario: async () => {
    try {
      const res = await fetch('/api/tipos-usuario', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map(t => ({
        id: t.id || t.tipo_usuario_id,
        tipo_usuario_id: t.tipo_usuario_id || t.id,
        name: t.nombre || `Tipo ${t.id}`,
        nombre: t.nombre,
        ...t
      }));
    } catch (err) {
      console.error('catalogosService.getTiposUsuario error:', err);
      return [];
    }
  },

  getRolesFuncionales: async () => {
    try {
      const res = await fetch('/api/matriz-acceso-rol', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.roles || []).map(r => ({
        id: r.numericId || r.id || r.rol_funcional_id,
        numericId: r.numericId || r.id || r.rol_funcional_id,
        name: r.nombre || r.name,
        nombre: r.nombre || r.name,
        ...r
      }));
    } catch (err) {
      console.error('catalogosService.getRolesFuncionales error:', err);
      return [];
    }
  },

  getModulos: async () => {
    try {
      const res = await fetch('/api/matriz-acceso-rol', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.modules || []).map(m => ({
        id: m.id || m.modulo_sistema_id,
        name: m.label || m.nombre || m.name,
        label: m.label || m.nombre || m.name,
        ...m
      }));
    } catch (err) {
      console.error('catalogosService.getModulos error:', err);
      return [];
    }
  },

  getMatrizAccesoRol: async () => {
    try {
      const res = await fetch('/api/matriz-acceso-rol', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.rawMatrix || data?.matrix || [];
    } catch (err) {
      console.error('catalogosService.getMatrizAccesoRol error:', err);
      return [];
    }
  },

  getAgrupaciones: async () => [],
  getAgencias: async () => [],
  getPaises: async () => [],
  getRegiones: async () => [],
  getProvincias: async () => [],
  getMunicipios: async () => [],
  getDistritosMunicipales: async () => [],
  getSectores: async () => [],
};
