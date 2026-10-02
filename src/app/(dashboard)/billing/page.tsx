import { query } from "@/lib/db";
import { getWorkshopSession } from "@/lib/workshop-session";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface BillingInvoiceItem {
  factura_id: number;
  numero_factura: string;
  fecha_factura: string | Date | null;
  total_factura: number | string;
  estado: string;
  cliente_nombre: string | null;
}

export default async function BillingPage() {
  const session = await getWorkshopSession();
  const empresaId = session?.empresa_id;

  const facturasRaw = empresaId ? await query(`
    SELECT 
      f.factura_id,
      f.numero_factura,
      f.fecha_factura,
      f.total_factura,
      f.estado,
      c.nombre_completo as cliente_nombre
    FROM admin.facturas f
    LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
    WHERE f.empresa_id = $1
    ORDER BY f.fecha_factura DESC
    LIMIT 50
  `, [empresaId]) : [];
  const facturas = (facturasRaw || []) as unknown as BillingInvoiceItem[];

  const formatMoney = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  const totalFacturado = facturas.reduce((acc: number, f: BillingInvoiceItem) => acc + Number(f.total_factura || 0), 0);
  const cuentasCobrar = facturas.filter((f: BillingInvoiceItem) => f.estado !== 'PAGADA' && f.estado !== 'PAGADO').reduce((acc: number, f: BillingInvoiceItem) => acc + Number(f.total_factura || 0), 0);
  const pagosRecibidos = facturas.filter((f: BillingInvoiceItem) => f.estado === 'PAGADA' || f.estado === 'PAGADO').reduce((acc: number, f: BillingInvoiceItem) => acc + Number(f.total_factura || 0), 0);

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
        <div className="bg-card border border-border rounded-lg p-6 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-foreground-secondary uppercase">Total Facturado</span>
            <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
          </div>
          <div className="text-[32px] font-bold text-foreground mb-2">{formatMoney(totalFacturado)}</div>
          <div className="flex items-center gap-2 text-[14px] text-primary">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span>+12.5% vs mes anterior</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-foreground-secondary uppercase">Cuentas por Cobrar</span>
            <span className="material-symbols-outlined text-error">priority_high</span>
          </div>
          <div className="text-[32px] font-bold text-foreground mb-2">{formatMoney(cuentasCobrar)}</div>
          <div className="flex items-center gap-2 text-[14px] text-error">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>Facturas pendientes</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-caps text-[12px] tracking-[0.1em] font-bold text-foreground-secondary uppercase">Pagos Recibidos</span>
            <span className="material-symbols-outlined text-primary">check_circle</span>
          </div>
          <div className="text-[32px] font-bold text-foreground mb-2">{formatMoney(pagosRecibidos)}</div>
          <div className="flex items-center gap-2 text-[14px] text-foreground-muted">
            <span className="material-symbols-outlined text-sm">payments</span>
            <span>Cobrado este mes</span>
          </div>
        </div>
      </div>

      {/* Table Actions */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div className="flex gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-[10px] text-foreground-secondary uppercase tracking-widest font-bold">Filtrar por Estado</label>
            <select className="bg-input border border-border text-[14px] text-foreground py-2 px-4 focus:border-primary outline-none min-w-[160px] rounded">
              <option>Todos los Estados</option>
              <option>Pagado</option>
              <option>Pendiente</option>
              <option>Vencido</option>
            </select>
          </div>
        </div>
        <Link
          href="/billing/new"
          className="bg-primary text-primary-foreground px-6 py-3 font-label-caps text-[12px] tracking-[0.1em] font-bold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm rounded cursor-pointer uppercase"
        >
          <span className="material-symbols-outlined">add</span>
          Nueva Factura
        </Link>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border overflow-hidden shadow-sm flex-grow flex flex-col rounded-lg">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-subtle border-b border-border">
              <tr>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-foreground-secondary uppercase">Factura #</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-foreground-secondary uppercase">Cliente</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-foreground-secondary uppercase">Fecha</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-foreground-secondary uppercase text-right">Monto</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-foreground-secondary uppercase text-center">Estado</th>
                <th className="p-4 font-label-caps text-[11px] tracking-[0.1em] font-bold text-foreground-secondary uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-[14px]">
              {facturas.map((f: BillingInvoiceItem) => (
                <tr key={f.factura_id} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="p-4 font-label-caps text-[12px] font-bold text-foreground tracking-wider">{f.numero_factura}</td>
                  <td className="p-4 text-foreground">{f.cliente_nombre || 'Desconocido'}</td>
                  <td className="p-4 text-foreground-secondary">
                    {f.fecha_factura ? new Date(f.fecha_factura).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-4 text-right font-bold text-foreground text-[16px]">{formatMoney(Number(f.total_factura))}</td>
                  <td className="p-4 text-center">
                    {getStatusBadge(f.estado)}
                  </td>
                  <td className="p-4 text-right">
                    <button className="p-1 text-foreground-secondary hover:text-primary transition-colors cursor-pointer"><span className="material-symbols-outlined">more_vert</span></button>
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
