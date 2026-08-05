"use client";

import { useState } from "react";
import { savePermissions, PermissionUpdate } from "./actions";

type Role = { rol_funcional_id: number; nombre: string; };
type Modulo = { modulo_sistema_id: number; nombre: string; orden: number; };
type Matriz = { 
  rol_funcional_id: number; 
  modulo_sistema_id: number; 
  puede_ver: boolean; 
  puede_crear: boolean; 
  puede_editar: boolean; 
  puede_eliminar: boolean; 
};

export default function PermissionsClient({ 
  roles, 
  modulos, 
  matriz 
}: { 
  roles: Role[]; 
  modulos: Modulo[]; 
  matriz: Matriz[]; 
}) {
  const initialMap: Record<string, Matriz> = {};
  
  roles.forEach(r => {
    modulos.forEach(m => {
      initialMap[`${r.rol_funcional_id}-${m.modulo_sistema_id}`] = {
        rol_funcional_id: r.rol_funcional_id,
        modulo_sistema_id: m.modulo_sistema_id,
        puede_ver: false,
        puede_crear: false,
        puede_editar: false,
        puede_eliminar: false
      };
    });
  });

  matriz.forEach(item => {
    const key = `${item.rol_funcional_id}-${item.modulo_sistema_id}`;
    if (initialMap[key]) {
      initialMap[key] = {
        ...initialMap[key],
        puede_ver: item.puede_ver,
        puede_crear: item.puede_crear,
        puede_editar: item.puede_editar,
        puede_eliminar: item.puede_eliminar
      };
    }
  });

  const [permissions, setPermissions] = useState<Record<string, Matriz>>(initialMap);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const togglePermission = (rolId: number, modId: number, field: keyof Matriz) => {
    const key = `${rolId}-${modId}`;
    setPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: !prev[key][field]
      }
    }));
    setHasChanges(true);
  };

  const setAllAccess = (rolId: number, modId: number, value: boolean) => {
    const key = `${rolId}-${modId}`;
    setPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        puede_ver: value,
        puede_crear: value,
        puede_editar: value,
        puede_eliminar: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updates: PermissionUpdate[] = Object.values(permissions);
    const res = await savePermissions(updates);
    setIsSaving(false);
    
    if (res.error) {
      alert("Error: " + res.error);
    } else {
      setHasChanges(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-[80vh]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-headline-lg text-4xl font-extrabold text-on-surface tracking-tight uppercase mb-2">Matriz de Acceso</h2>
          <p className="font-body-lg text-on-surface-variant max-w-2xl">Gestión de privilegios industriales. Cruce de jerarquía técnica por módulos operativos.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            disabled
            className="px-6 py-3 border border-outline-variant text-on-surface-variant font-label-caps text-xs tracking-widest font-semibold hover:bg-[#353534] transition-colors flex-1 sm:flex-none opacity-50 cursor-not-allowed uppercase"
          >
            EXPORTAR PDF
          </button>
          <button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-6 py-3 bg-primary text-on-primary font-label-caps text-xs tracking-widest font-semibold border-t border-white/20 uppercase flex items-center justify-center gap-2 flex-1 sm:flex-none hover:brightness-110 transition-all disabled:opacity-50"
          >
            {isSaving ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
            {!isSaving && <span className="material-symbols-outlined text-[18px]">save</span>}
          </button>
        </div>
      </div>

      {/* Dashboard Stats (Technical Chips) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 border border-outline-variant bg-[#1b1c17] flex flex-col gap-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[48px]">badge</span>
          </div>
          <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant uppercase">ROLES ACTIVOS</span>
          <span className="text-3xl font-extrabold text-primary">{roles.length}</span>
        </div>
        <div className="p-4 border border-outline-variant bg-[#1b1c17] flex flex-col gap-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[48px]">rule</span>
          </div>
          <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant uppercase">MÓDULOS DEL SISTEMA</span>
          <span className="text-3xl font-extrabold text-primary">{modulos.length}</span>
        </div>
        <div className="p-4 border border-outline-variant bg-[#1b1c17] flex flex-col gap-1">
          <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant uppercase">CAMBIOS PENDIENTES</span>
          <span className={`text-3xl font-extrabold ${hasChanges ? 'text-[#ffb4ab]' : 'text-on-surface'}`}>{hasChanges ? 'SÍ' : 'NO'}</span>
        </div>
        <div className="p-4 border border-outline-variant bg-[#1b1c17] flex flex-col gap-1">
          <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant uppercase">ÚLTIMA AUDITORÍA</span>
          <span className="text-3xl font-extrabold text-on-surface">HOY</span>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="border border-outline-variant bg-[#0e0f0a] overflow-hidden flex-grow shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar h-[calc(100vh-350px)] min-h-[400px]">
          <table className="w-full border-collapse text-left min-w-max">
            <thead>
              <tr className="bg-[#353534] border-b border-outline-variant">
                <th className="p-6 sticky left-0 bg-[#353534] z-20 border-r border-outline-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">security</span>
                    <span className="font-label-caps text-xs tracking-widest font-semibold uppercase text-on-surface">MÓDULOS / ROLES</span>
                  </div>
                </th>
                {roles.map(role => (
                  <th key={role.rol_funcional_id} className="p-4 border-r border-outline-variant last:border-r-0 min-w-[160px]">
                    <div className="text-center">
                      <p className="font-label-caps text-xs tracking-widest font-semibold uppercase text-on-surface mb-1">{role.nombre}</p>
                      <span className="text-[10px] text-on-surface-variant font-mono">ID: ROL_{role.rol_funcional_id.toString().padStart(2, '0')}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulos.map((modulo, idx) => (
                <tr key={modulo.modulo_sistema_id} className={`border-b border-outline-variant group hover:bg-[#1b1c17] transition-colors ${idx % 2 === 0 ? 'bg-[#0e0f0a]' : 'bg-[#131313]'}`}>
                  <td className={`p-6 sticky left-0 z-10 border-r border-outline-variant ${idx % 2 === 0 ? 'bg-[#0e0f0a]' : 'bg-[#131313]'} group-hover:bg-[#1b1c17] transition-colors`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#2a2a2a] border border-[#909282] flex items-center justify-center shadow-inner">
                        <span className="material-symbols-outlined text-on-surface">
                          {modulo.nombre.toLowerCase().includes('inventario') ? 'inventory_2' : 
                           modulo.nombre.toLowerCase().includes('taller') ? 'construction' : 
                           modulo.nombre.toLowerCase().includes('ventas') ? 'storefront' : 'apps'}
                        </span>
                      </div>
                      <div>
                        <p className="text-base font-bold text-primary">{modulo.nombre}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">ID MOD: {modulo.modulo_sistema_id}</p>
                      </div>
                    </div>
                  </td>
                  
                  {roles.map(role => {
                    const key = `${role.rol_funcional_id}-${modulo.modulo_sistema_id}`;
                    const perm = permissions[key];
                    const hasAllAccess = perm.puede_ver && perm.puede_crear && perm.puede_editar && perm.puede_eliminar;
                    
                    return (
                      <td key={role.rol_funcional_id} className="p-4 border-r border-outline-variant last:border-r-0">
                        <div className="flex flex-col gap-3 items-center">
                          <div className="flex justify-between items-center w-full max-w-[140px] px-2 py-1 rounded hover:bg-white/5 transition-colors">
                            <span className="text-[10px] font-mono text-on-surface-variant font-bold">READ</span>
                            <div className="relative inline-block w-9 h-4">
                              <input 
                                checked={perm.puede_ver}
                                onChange={() => togglePermission(role.rol_funcional_id, modulo.modulo_sistema_id, 'puede_ver')}
                                className="peer absolute z-10 w-full h-full cursor-pointer opacity-0" 
                                type="checkbox"
                              />
                              <div className="absolute top-0 left-0 right-0 bottom-0 bg-[#2a2a2a] transition-all peer-checked:bg-primary border border-outline-variant peer-checked:border-primary">
                                <div className="absolute h-3 w-3 left-0.5 bottom-0.5 bg-on-surface-variant peer-checked:bg-[#232e00] peer-checked:translate-x-5 transition-all shadow-sm"></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center w-full max-w-[140px] px-2 py-1 rounded hover:bg-white/5 transition-colors">
                            <span className="text-[10px] font-mono text-on-surface-variant font-bold">WRITE</span>
                            <div className="relative inline-block w-9 h-4">
                              <input 
                                checked={perm.puede_crear}
                                onChange={() => togglePermission(role.rol_funcional_id, modulo.modulo_sistema_id, 'puede_crear')}
                                className="peer absolute z-10 w-full h-full cursor-pointer opacity-0" 
                                type="checkbox"
                              />
                              <div className="absolute top-0 left-0 right-0 bottom-0 bg-[#2a2a2a] transition-all peer-checked:bg-primary border border-outline-variant peer-checked:border-primary">
                                <div className="absolute h-3 w-3 left-0.5 bottom-0.5 bg-on-surface-variant peer-checked:bg-[#232e00] peer-checked:translate-x-5 transition-all shadow-sm"></div>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center w-full max-w-[140px] px-2 py-1 rounded hover:bg-white/5 transition-colors">
                            <span className="text-[10px] font-mono text-on-surface-variant font-bold">MODIFY</span>
                            <div className="relative inline-block w-9 h-4">
                              <input 
                                checked={perm.puede_editar}
                                onChange={() => togglePermission(role.rol_funcional_id, modulo.modulo_sistema_id, 'puede_editar')}
                                className="peer absolute z-10 w-full h-full cursor-pointer opacity-0" 
                                type="checkbox"
                              />
                              <div className="absolute top-0 left-0 right-0 bottom-0 bg-[#2a2a2a] transition-all peer-checked:bg-primary border border-outline-variant peer-checked:border-primary">
                                <div className="absolute h-3 w-3 left-0.5 bottom-0.5 bg-on-surface-variant peer-checked:bg-[#232e00] peer-checked:translate-x-5 transition-all shadow-sm"></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center w-full max-w-[140px] px-2 py-1 rounded hover:bg-white/5 transition-colors">
                            <span className="text-[10px] font-mono text-on-surface-variant font-bold">DELETE</span>
                            <div className="relative inline-block w-9 h-4">
                              <input 
                                checked={perm.puede_eliminar}
                                onChange={() => togglePermission(role.rol_funcional_id, modulo.modulo_sistema_id, 'puede_eliminar')}
                                className="peer absolute z-10 w-full h-full cursor-pointer opacity-0" 
                                type="checkbox"
                              />
                              <div className="absolute top-0 left-0 right-0 bottom-0 bg-[#2a2a2a] transition-all peer-checked:bg-error border border-outline-variant peer-checked:border-error">
                                <div className="absolute h-3 w-3 left-0.5 bottom-0.5 bg-on-surface-variant peer-checked:bg-[#690005] peer-checked:translate-x-5 transition-all shadow-sm"></div>
                              </div>
                            </div>
                          </div>

                          <div className="w-full max-w-[140px] border-t border-outline-variant/30 mt-1 pt-2">
                            <button 
                              onClick={() => setAllAccess(role.rol_funcional_id, modulo.modulo_sistema_id, !hasAllAccess)}
                              className={`w-full text-center text-[10px] font-label-caps tracking-widest py-1 border transition-colors ${hasAllAccess ? 'bg-primary/10 text-primary border-primary hover:bg-primary/20' : 'bg-transparent text-on-surface-variant border-outline-variant hover:text-on-surface hover:border-on-surface-variant'}`}
                            >
                              {hasAllAccess ? 'REVOKE ALL' : 'ALL ACCESS'}
                            </button>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {modulos.length === 0 && (
                <tr>
                  <td colSpan={roles.length + 1} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">rule</span>
                    <p>No hay módulos disponibles en la base de datos.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
