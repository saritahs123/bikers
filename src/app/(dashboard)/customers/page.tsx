import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const clientes = await query(`
    SELECT 
      cliente_id, 
      nombre_completo, 
      correo, 
      tipo_cliente, 
      cantidad_bicicletas, 
      ultima_visita, 
      total_gastado_taller, 
      total_gastado_tienda 
    FROM admin.clientes 
    ORDER BY ultima_visita DESC NULLS LAST
    LIMIT 50
  `);

  const getInitials = (name: string) => {
    if (!name) return "XX";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const getNivelBadge = (nivel: string) => {
    switch (nivel?.toUpperCase()) {
      case 'GOLD':
        return <span className="inline-block px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 text-[12px] tracking-[0.1em] font-bold rounded">GOLD</span>;
      case 'SILVER':
        return <span className="inline-block px-3 py-1 bg-slate-300/10 text-slate-300 border border-slate-300/30 text-[12px] tracking-[0.1em] font-bold rounded">SILVER</span>;
      case 'BRONZE':
        return <span className="inline-block px-3 py-1 bg-orange-700/10 text-orange-700 border border-orange-700/30 text-[12px] tracking-[0.1em] font-bold rounded">BRONZE</span>;
      default:
        return <span className="inline-block px-3 py-1 bg-gray-500/10 text-gray-500 border border-gray-500/30 text-[12px] tracking-[0.1em] font-bold rounded">{nivel || 'ESTÁNDAR'}</span>;
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      {/* Page Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-1">
          <h2 className="font-headline-md text-[32px] font-bold text-on-surface">Directorio de Clientes</h2>
          <p className="text-on-surface-variant text-[14px]">Gestión integral de la base de datos de usuarios y activos.</p>
        </div>
        <button className="bg-[#89974f] text-[#252d00] px-6 py-3 font-bold rounded flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:opacity-90 transition-all cursor-pointer">
          <span className="material-symbols-outlined">person_add</span>
          Añadir Cliente
        </button>
      </div>

      {/* Dashboard Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 border border-[#2d3748] bg-[#161a21] p-6 shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input className="w-full bg-[#0a0c10] border border-outline-variant rounded px-10 py-3 text-[16px] focus:border-primary outline-none" placeholder="Buscar por nombre, email o activo..." type="text"/>
            </div>
            <div className="flex gap-2">
              <select className="bg-[#0a0c10] border border-outline-variant rounded px-4 py-3 text-[14px] focus:border-primary outline-none text-on-surface">
                <option>Todos los niveles</option>
                <option>Gold</option>
                <option>Silver</option>
                <option>Bronze</option>
              </select>
              <button className="border border-[#2d3748] bg-[#1c2129] px-4 hover:bg-[#2d3748] transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-on-surface-variant">filter_list</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border border-[#2d3748] bg-primary/5 p-6 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] border-primary/20 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-primary">TOTAL CLIENTES</span>
            <span className="material-symbols-outlined text-primary">groups</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-black text-on-surface">{clientes.length}</span>
          </div>
        </div>
      </div>

      {/* Client Directory Table */}
      <div className="border border-[#2d3748] bg-[#0a0c10] overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,0.5)] mb-20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2a2a24] border-b border-outline-variant">
                <th className="px-6 py-4 font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant">CLIENTE</th>
                <th className="px-6 py-4 font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant text-center">NIVEL</th>
                <th className="px-6 py-4 font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant text-center">ACTIVOS</th>
                <th className="px-6 py-4 font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant">ÚLTIMA VISITA</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c: any) => (
                <tr key={c.cliente_id} className="hover:bg-[#35352f]/20 transition-colors cursor-pointer group">
                  <td className="px-6 py-4 border-b border-[#2d3748]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-[#2d3748] flex items-center justify-center font-bold text-primary border border-[#2d3748]">
                        {getInitials(c.nombre_completo)}
                      </div>
                      <div>
                        <div className="font-bold text-on-surface group-hover:text-primary transition-colors">{c.nombre_completo}</div>
                        <div className="text-[12px] text-on-surface-variant">{c.correo || "N/A"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center border-b border-[#2d3748]">
                    {getNivelBadge(c.tipo_cliente)}
                  </td>
                  <td className="px-6 py-4 text-center border-b border-[#2d3748]">
                    <span className="font-bold text-on-surface">{c.cantidad_bicicletas || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant text-[14px] border-b border-[#2d3748]">
                    {c.ultima_visita ? new Date(c.ultima_visita).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right border-b border-[#2d3748]">
                    <button className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer">more_vert</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
