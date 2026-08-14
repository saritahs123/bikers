import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  const [ordenesResult, estadosResult] = await Promise.all([
    query(`
      SELECT 
        ot.orden_trabajo_id, 
        ot.codigo_orden, 
        ot.estado_orden_id,
        ot.diagnostico_inicial,
        ot.fecha_recepcion,
        c.nombre_completo as cliente_nombre,
        b.marca, b.modelo
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
      WHERE ot.estado_orden_id NOT IN (7, 8) -- Excluir finalizadas
    `),
    query(`SELECT * FROM admin.estado_orden_trabajo WHERE estado_orden_id NOT IN (7, 8) ORDER BY orden_visual`)
  ]);

  const ordenes = ordenesResult || [];
  const estados = estadosResult || [];

  // Group by estado_orden_id
  const board = estados.map((estado: any) => ({
    ...estado,
    ordenes: ordenes.filter((o: any) => o.estado_orden_id === estado.estado_orden_id)
  }));

  return (
    <div className="max-w-[1440px] mx-auto h-full flex flex-col overflow-hidden">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-headline-lg text-[48px] font-bold text-on-surface leading-tight">Órdenes de Trabajo</h2>
          <p className="text-on-surface-variant text-[18px]">Gestiona el flujo técnico del taller en tiempo real.</p>
        </div>
        <button className="bg-primary text-on-primary font-bold px-6 py-3 rounded-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[0_0_15px_rgba(187,207,124,0.15)] cursor-pointer">
          <span className="material-symbols-outlined">add</span>
          <span>Crear Orden</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#1b1c17] border border-[#2d3748] rounded-xl p-4 mb-8 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-outline uppercase">Filtrar por:</span>
        </div>
        <div className="flex items-center gap-4">
          <select className="bg-[#0e0f0a] border border-[#2d3748] rounded px-3 py-2 text-[14px] text-on-surface-variant focus:border-primary outline-none">
            <option>Mecánico: Todos</option>
          </select>
          <select className="bg-[#0e0f0a] border border-[#2d3748] rounded px-3 py-2 text-[14px] text-on-surface-variant focus:border-primary outline-none">
            <option>Prioridad: Todas</option>
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-6 flex-grow items-start custom-scrollbar">
        {board.map((col: any) => (
          <div key={col.estado_orden_id} className="flex-shrink-0 w-80">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color_estado || '#919282' }}></span>
                {col.nombre} ({col.ordenes.length})
              </h3>
            </div>
            
            <div className="flex flex-col gap-4">
              {col.ordenes.map((orden: any) => (
                <div key={orden.orden_trabajo_id} className="bg-[#1f201a] border border-[#2d3748] p-4 rounded-lg hover:bg-[#35352f] transition-colors cursor-pointer group shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-label-caps text-[10px] text-outline">{orden.codigo_orden}</span>
                  </div>
                  <h4 className="font-bold text-[18px] text-on-surface mb-1 truncate">{orden.diagnostico_inicial || "Sin diagnóstico"}</h4>
                  <p className="text-[14px] text-on-surface-variant mb-4 truncate">{orden.marca} {orden.modelo} • {orden.cliente_nombre}</p>
                  
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#35352f] flex items-center justify-center border border-[#46483b]">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                      </div>
                      <span className="text-[14px]">Sin asignar</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
