import { query } from "@/lib/db";
import Link from "next/link";

export default async function BillingPage() {
  const facturas = await query(`
    SELECT 
      f.factura_id,
      f.numero_factura,
      f.fecha_factura,
      f.total_factura,
      f.estado,
      c.nombre_completo as cliente_nombre
    FROM admin.facturas f
    LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
    ORDER BY f.fecha_factura DESC
    LIMIT 50
  `);

  const formatMoney = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  const totalFacturado = facturas.reduce((acc: number, f: any) => acc + Number(f.total_factura), 0);
  const cuentasCobrar = facturas.filter((f: any) => f.estado !== 'PAGADA' && f.estado !== 'PAGADO').reduce((acc: number, f: any) => acc + Number(f.total_factura), 0);
  const pagosRecibidos = facturas.filter((f: any) => f.estado === 'PAGADA' || f.estado === 'PAGADO').reduce((acc: number, f: any) => acc + Number(f.total_factura), 0);

  const getStatusBadge = (estado: string) => {
    switch (estado?.toUpperCase()) {
      case 'PAGADA':
      case 'PAGADO':
        return <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/30 text-[11px] font-label-caps uppercase tracking-widest font-bold">Pagado</span>;
      case 'VENCIDA':
      case 'VENCIDO':
        return <span className="px-3 py-1 bg-error/10 text-error border border-error/30 text-[11px] font-label-caps uppercase tracking-widest font-bold">Vencido</span>;
      default:
        return <span className="px-3 py-1 bg-surface-variant text-on-surface-variant border border-outline text-[11px] font-label-caps uppercase tracking-widest font-bold">Pendiente</span>;
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto h-full flex flex-col space-y-8">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1f201a] border border-[#2d3748] rounded-lg p-6 relative overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant uppercase">Total Facturado</span>
            <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
          </div>
          <div className="text-[32px] font-bold text-on-surface mb-2">{formatMoney(totalFacturado)}</div>
          <div className="flex items-center gap-2 text-[14px] text-primary">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span>+12.5% vs mes anterior</span>
          </div>
        </div>

        <div className="bg-[#1f201a] border border-[#2d3748] rounded-lg p-6 relative overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant uppercase">Cuentas por Cobrar</span>
            <span className="material-symbols-outlined text-error">priority_high</span>
          </div>
          <div className="text-[32px] font-bold text-on-surface mb-2">{formatMoney(cuentasCobrar)}</div>
          <div className="flex items-center gap-2 text-[14px] text-error">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>Facturas pendientes</span>
          </div>
        </div>

        <div className="bg-[#1f201a] border border-[#2d3748] rounded-lg p-6 relative overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-on-surface-variant uppercase">Pagos Recibidos</span>
            <span className="material-symbols-outlined text-tertiary text-[#8791a5]">check_circle</span>
          </div>
          <div className="text-[32px] font-bold text-on-surface mb-2">{formatMoney(pagosRecibidos)}</div>
          <div className="flex items-center gap-2 text-[14px] text-[#8791a5]">
            <span className="material-symbols-outlined text-sm">payments</span>
            <span>Cobrado este mes</span>
          </div>
        </div>
      </div>

      {/* Table Actions */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div className="flex gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Filtrar por Estado</label>
            <select className="bg-[#0e0f0a] border border-[#2d3748] text-[14px] text-on-surface py-2 px-4 focus:border-primary outline-none min-w-[160px] rounded">
              <option>Todos los Estados</option>
              <option>Pagado</option>
              <option>Pendiente</option>
              <option>Vencido</option>
            </select>
          </div>
        </div>
        <button className="bg-primary text-[#181e00] px-6 py-3 font-label-caps text-[12px] tracking-[0.1em] font-bold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] rounded cursor-pointer uppercase">
          <span className="material-symbols-outlined">add</span>
          Nueva Factura
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-[#13140f] border border-[#2d3748] overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,0.5)] flex-grow flex flex-col rounded-lg">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1b1c17] border-b border-[#2d3748]">
              <tr>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-on-surface-variant uppercase">Factura #</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-on-surface-variant uppercase">Cliente</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-on-surface-variant uppercase">Fecha</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-on-surface-variant uppercase text-right">Monto</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-on-surface-variant uppercase text-center">Estado</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-on-surface-variant uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-[14px]">
              {facturas.map((f: any) => (
                <tr key={f.factura_id} className="border-b border-[#2d3748] hover:bg-[#35352f]/40 transition-colors">
                  <td className="p-4 font-label-caps text-[12px] font-bold text-on-surface tracking-wider">{f.numero_factura}</td>
                  <td className="p-4 text-on-surface">{f.cliente_nombre || 'Desconocido'}</td>
                  <td className="p-4 text-on-surface-variant">
                    {f.fecha_factura ? new Date(f.fecha_factura).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-4 text-right font-bold text-on-surface text-[16px]">{formatMoney(Number(f.total_factura))}</td>
                  <td className="p-4 text-center">
                    {getStatusBadge(f.estado)}
                  </td>
                  <td className="p-4 text-right">
                    <button className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"><span className="material-symbols-outlined">more_vert</span></button>
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
