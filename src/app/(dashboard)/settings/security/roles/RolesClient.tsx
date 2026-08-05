"use client";

import { useState, useMemo, useEffect } from "react";
import { FullRoleData, saveRoleMatrix, MatrixRowUpdate, createRole } from "./actions";

type MatrizRow = {
  modulo_sistema_id: number;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_inactivar: boolean;
  puede_exportar: boolean;
  puede_importar: boolean;
  puede_aprobar: boolean;
  puede_asignar: boolean;
  puede_mover: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
  puede_eliminar: boolean;
};

const DEFAULT_ROW: Omit<MatrizRow, "modulo_sistema_id"> = {
  puede_ver: false, puede_crear: false, puede_editar: false, puede_inactivar: false,
  puede_exportar: false, puede_importar: false, puede_aprobar: false, puede_asignar: false,
  puede_mover: false, puede_cerrar: false, puede_reabrir: false, puede_eliminar: false
};

const COLUMNS: { key: keyof MatrizRow; label: string }[] = [
  { key: "puede_ver", label: "VER" },
  { key: "puede_crear", label: "CREAR" },
  { key: "puede_editar", label: "EDITAR" },
  { key: "puede_inactivar", label: "INACTIVAR" },
  { key: "puede_exportar", label: "EXPORTAR" },
  { key: "puede_importar", label: "IMPORTAR" },
  { key: "puede_aprobar", label: "APROBAR" },
  { key: "puede_asignar", label: "ASIGNAR" },
  { key: "puede_mover", label: "MOVER" },
  { key: "puede_cerrar", label: "CERRAR" },
  { key: "puede_reabrir", label: "REABRIR" },
  { key: "puede_eliminar", label: "ELIMINAR" }
];

export default function RolesClient({ data }: { data: FullRoleData }) {
  const [roles, setRoles] = useState(data.roles);
  const [activeRoleId, setActiveRoleId] = useState<number | null>(roles.length > 0 ? roles[0].rol_funcional_id : null);
  
  const [matrixState, setMatrixState] = useState<Record<string, Record<number, MatrizRow>>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Initialize state from server data
  useEffect(() => {
    const initialState: Record<string, Record<number, MatrizRow>> = {};
    
    data.roles.forEach(role => {
      initialState[role.rol_funcional_id] = {};
      data.modulos.forEach(mod => {
        initialState[role.rol_funcional_id][mod.modulo_sistema_id] = {
          modulo_sistema_id: mod.modulo_sistema_id,
          ...DEFAULT_ROW
        };
      });
    });

    data.matriz.forEach(item => {
      if (initialState[item.rol_funcional_id] && initialState[item.rol_funcional_id][item.modulo_sistema_id]) {
        initialState[item.rol_funcional_id][item.modulo_sistema_id] = {
          modulo_sistema_id: item.modulo_sistema_id,
          puede_ver: item.puede_ver,
          puede_crear: item.puede_crear,
          puede_editar: item.puede_editar,
          puede_inactivar: item.puede_inactivar || false,
          puede_exportar: item.puede_exportar || false,
          puede_importar: item.puede_importar || false,
          puede_aprobar: item.puede_aprobar || false,
          puede_asignar: item.puede_asignar || false,
          puede_mover: item.puede_mover || false,
          puede_cerrar: item.puede_cerrar || false,
          puede_reabrir: item.puede_reabrir || false,
          puede_eliminar: item.puede_eliminar
        };
      }
    });

    setMatrixState(initialState);
    setRoles(data.roles);
    setHasChanges(false);
  }, [data]);

  const activeRole = roles.find(r => r.rol_funcional_id === activeRoleId);
  const activeRoleMatrix = activeRoleId ? matrixState[activeRoleId] : null;

  // Stats
  const activeRulesCount = useMemo(() => {
    if (!activeRoleMatrix) return 0;
    let count = 0;
    Object.values(activeRoleMatrix).forEach(row => {
      COLUMNS.forEach(col => {
        if (row[col.key as keyof typeof row]) count++;
      });
    });
    return count;
  }, [activeRoleMatrix]);

  const modulesIntervenedCount = useMemo(() => {
    if (!activeRoleMatrix) return 0;
    let count = 0;
    Object.values(activeRoleMatrix).forEach(row => {
      const hasAny = COLUMNS.some(col => row[col.key as keyof typeof row]);
      if (hasAny) count++;
    });
    return count;
  }, [activeRoleMatrix]);

  // Handlers
  const togglePermission = (modId: number, field: keyof MatrizRow) => {
    if (!activeRoleId) return;
    setMatrixState(prev => ({
      ...prev,
      [activeRoleId]: {
        ...prev[activeRoleId],
        [modId]: {
          ...prev[activeRoleId][modId],
          [field]: !prev[activeRoleId][modId][field]
        }
      }
    }));
    setHasChanges(true);
  };

  const toggleFullRow = (modId: number) => {
    if (!activeRoleId || !activeRoleMatrix) return;
    const row = activeRoleMatrix[modId];
    const isAllChecked = COLUMNS.every(c => row[c.key as keyof typeof row]);
    
    setMatrixState(prev => ({
      ...prev,
      [activeRoleId]: {
        ...prev[activeRoleId],
        [modId]: {
          modulo_sistema_id: modId,
          puede_ver: !isAllChecked, puede_crear: !isAllChecked, puede_editar: !isAllChecked,
          puede_inactivar: !isAllChecked, puede_exportar: !isAllChecked, puede_importar: !isAllChecked,
          puede_aprobar: !isAllChecked, puede_asignar: !isAllChecked, puede_mover: !isAllChecked,
          puede_cerrar: !isAllChecked, puede_reabrir: !isAllChecked, puede_eliminar: !isAllChecked
        }
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!activeRoleId || !activeRoleMatrix) return;
    setIsSaving(true);
    const updates = Object.values(activeRoleMatrix);
    const res = await saveRoleMatrix(activeRoleId, updates);
    setIsSaving(false);
    
    if (res.error) {
      alert("Error: " + res.error);
    } else {
      setHasChanges(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingRole(true);
    const formData = new FormData(e.currentTarget);
    const res = await createRole(formData);
    setIsSubmittingRole(false);
    if (res.error) {
      alert("Error: " + res.error);
    } else {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-outline-variant pb-6">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant font-label-caps text-[10px] tracking-widest mb-2">
            <span className="material-symbols-outlined text-[14px]">shield_person</span>
            GOBERNANZA Y AUTENTICACIÓN
          </div>
          <h1 className="text-3xl font-extrabold text-on-surface">Matriz de Roles</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Configura los permisos predeterminados heredados por los usuarios según su rol funcional asignado.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="bg-primary text-on-primary font-bold px-6 py-2 rounded flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(187,207,124,0.15)]"
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
          {!isSaving && <span className="material-symbols-outlined text-[18px]">save</span>}
        </button>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-low border border-outline-variant p-4 flex items-center gap-4 rounded-lg">
          <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center rounded-lg text-primary">
            <span className="material-symbols-outlined">badge</span>
          </div>
          <div>
            <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant">ROL ACTIVO</span>
            <p className="font-bold text-on-surface text-lg">{activeRole?.nombre || "Ninguno"}</p>
          </div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant p-4 flex items-center gap-4 rounded-lg">
          <div className="w-12 h-12 bg-[#8791a5]/10 border border-[#8791a5]/30 flex items-center justify-center rounded-lg text-[#8791a5]">
            <span className="material-symbols-outlined">key</span>
          </div>
          <div>
            <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant">PERMISOS CONCEDIDOS</span>
            <p className="font-bold text-on-surface text-lg">{activeRulesCount} reglas activas</p>
          </div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant p-4 flex items-center gap-4 rounded-lg">
          <div className="w-12 h-12 bg-[#c8c6c5]/10 border border-[#c8c6c5]/30 flex items-center justify-center rounded-lg text-[#c8c6c5]">
            <span className="material-symbols-outlined">data_object</span>
          </div>
          <div>
            <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant">MÓDULOS INTERVENIDOS</span>
            <p className="font-bold text-on-surface text-lg">{modulesIntervenedCount} de {data.modulos.length} módulos</p>
          </div>
        </div>
      </div>

      {/* Master Detail Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start h-full">
        
        {/* Left Sidebar: Roles List */}
        <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
          <div className="flex justify-between items-center bg-surface-container-low border border-outline-variant p-4 rounded-t-lg">
            <div className="flex items-center gap-2 text-on-surface font-label-caps text-xs tracking-widest font-bold">
              <span className="material-symbols-outlined text-[16px]">group</span>
              ROLES FUNCIONALES
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-6 h-6 bg-primary text-on-primary rounded flex items-center justify-center hover:brightness-110"
              title="Agregar Rol"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
          <div className="flex flex-col gap-1 bg-surface-container-lowest border-x border-b border-outline-variant rounded-b-lg p-2 h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar">
            {roles.map(role => {
              const isActive = activeRoleId === role.rol_funcional_id;
              return (
                <button
                  key={role.rol_funcional_id}
                  onClick={() => {
                    if (hasChanges) {
                      if(!confirm("Tienes cambios sin guardar. ¿Deseas descartarlos y cambiar de rol?")) return;
                    }
                    setActiveRoleId(role.rol_funcional_id);
                    setHasChanges(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded text-left transition-colors ${
                    isActive 
                      ? 'bg-primary text-on-primary shadow-[0_0_10px_rgba(187,207,124,0.15)]' 
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className="font-bold text-sm truncate pr-2">{role.nombre}</span>
                  <div className="flex items-center gap-2 opacity-60">
                    <span className="text-[10px] font-mono">{role.rol_funcional_id.toString().padStart(2, '0')}</span>
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content: Matrix */}
        <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col w-full overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <div>
              <h3 className="font-bold text-on-surface">Matriz de Acceso</h3>
              <p className="text-xs text-on-surface-variant">Controla qué acciones específicas puede realizar el rol sobre cada módulo.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined text-[18px]">search</span>
                <input 
                  type="text" 
                  placeholder="Buscar módulo..."
                  className="bg-surface-container border border-outline-variant rounded text-sm px-9 py-1.5 focus:border-primary focus:outline-none text-on-surface w-48"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar h-[calc(100vh-450px)] relative">
            <table className="w-full text-left border-collapse text-sm min-w-max">
              <thead className="bg-surface-container-highest sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="py-3 px-4 font-label-caps text-[10px] tracking-widest text-on-surface-variant border-b border-r border-outline-variant w-48 sticky left-0 bg-surface-container-highest z-30">
                    MÓDULO / SECCIÓN
                  </th>
                  <th className="py-3 px-2 font-label-caps text-[10px] tracking-widest text-primary border-b border-outline-variant text-center">
                    FULL
                  </th>
                  {COLUMNS.map(col => (
                    <th key={col.key} className="py-3 px-2 font-label-caps text-[10px] tracking-widest text-on-surface-variant border-b border-outline-variant text-center">
                      {col.label}
                    </th>
                  ))}
                  <th className="py-3 px-4 font-label-caps text-[10px] tracking-widest text-on-surface-variant border-b border-l border-outline-variant text-center sticky right-0 bg-surface-container-highest z-20">
                    OPCIONES
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {data.modulos.map((modulo, idx) => {
                  const row = activeRoleMatrix ? activeRoleMatrix[modulo.modulo_sistema_id] : DEFAULT_ROW;
                  const isAllChecked = COLUMNS.every(c => row[c.key as keyof typeof row]);
                  
                  return (
                    <tr key={modulo.modulo_sistema_id} className={`hover:bg-surface-container-high transition-colors ${idx % 2 === 0 ? 'bg-[#0e0f0a]' : 'bg-[#131313]'}`}>
                      <td className={`py-3 px-4 font-bold text-on-surface border-r border-outline-variant sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-[#0e0f0a]' : 'bg-[#131313]'}`}>
                        {modulo.nombre}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button 
                          onClick={() => toggleFullRow(modulo.modulo_sistema_id)}
                          className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors mx-auto ${isAllChecked ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant hover:border-primary'}`}
                        >
                          {isAllChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                        </button>
                      </td>
                      {COLUMNS.map(col => {
                        const isChecked = row[col.key as keyof typeof row];
                        return (
                          <td key={col.key} className="py-3 px-2 text-center">
                            <button 
                              onClick={() => togglePermission(modulo.modulo_sistema_id, col.key as keyof MatrizRow)}
                              className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors mx-auto ${isChecked ? 'bg-primary border-primary text-on-primary shadow-[0_0_5px_rgba(187,207,124,0.3)]' : 'border-outline-variant text-transparent hover:border-on-surface-variant'}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">{isChecked ? 'check' : ''}</span>
                            </button>
                          </td>
                        );
                      })}
                      <td className={`py-3 px-4 border-l border-outline-variant text-center sticky right-0 z-10 ${idx % 2 === 0 ? 'bg-[#0e0f0a]' : 'bg-[#131313]'}`}>
                        <div className="flex justify-center gap-2 text-on-surface-variant">
                          <button className="hover:text-primary transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                          <button className="hover:text-error transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-surface-container-low border-t border-outline-variant flex items-start gap-2 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-[16px] text-primary">info</span>
            <p>Nota: Los cambios realizados en esta matriz modificarán el comportamiento heredado predeterminado de los usuarios. Las cuentas que tengan configurados "Permisos Personalizados" en su perfil no se verán afectadas por este cambio.</p>
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-surface-container border border-outline-variant rounded-lg w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="h-1 w-full bg-primary absolute top-0 left-0"></div>
            <div className="px-6 py-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-highest">
              <h2 className="text-lg font-bold text-on-surface uppercase tracking-wide">Crear Nuevo Rol</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateRole} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-label-caps tracking-widest text-primary mb-2">NOMBRE DEL ROL *</label>
                <input 
                  name="nombre"
                  required
                  type="text" 
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-3 text-on-surface focus:outline-none focus:border-primary transition-colors"
                  placeholder="Ej. Técnico Especialista"
                />
              </div>
              <div>
                <label className="block text-xs font-label-caps tracking-widest text-primary mb-2">DESCRIPCIÓN</label>
                <textarea 
                  name="descripcion"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-3 text-on-surface focus:outline-none focus:border-primary transition-colors h-24 resize-none"
                  placeholder="Describe las responsabilidades principales..."
                ></textarea>
              </div>
              
              <div className="pt-4 flex gap-3 justify-end border-t border-outline-variant/50 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 font-label-caps text-xs tracking-widest font-semibold text-on-surface-variant hover:text-on-surface transition-colors uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingRole}
                  className="px-6 py-2 font-label-caps text-xs tracking-widest font-semibold bg-primary text-on-primary rounded hover:brightness-110 transition-all disabled:opacity-50 uppercase flex items-center gap-2"
                >
                  {isSubmittingRole ? 'Guardando...' : 'Guardar Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
