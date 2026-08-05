import { query } from "@/lib/db";
import Link from "next/link";

export default async function InventoryPage() {
  const productos = await query(`
    SELECT 
      p.producto_id,
      p.nombre,
      p.codigo_producto as sku,
      p.precio_venta,
      c.nombre as categoria,
      COALESCE((SELECT SUM(cantidad_actual) FROM admin.existencias_producto e WHERE e.producto_id = p.producto_id), 0) as stock
    FROM admin.productos p
    LEFT JOIN admin.categoria_producto c ON p.categoria_producto_id = c.categoria_producto_id
    LIMIT 100
  `);

  const formatMoney = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  return (
    <div className="max-w-[1440px] mx-auto space-y-8 h-full flex flex-col">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1f201a] border border-[#2d3748] rounded-lg p-6 flex items-center justify-between shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
          <div>
            <p className="font-label-caps text-on-surface-variant text-[11px] tracking-[0.1em] font-bold mb-1">ALERTAS DE STOCK BAJO</p>
            <h2 className="text-[32px] font-bold text-error">
              {productos.filter((p: any) => p.stock < 10).length}
            </h2>
            <p className="font-body-sm text-on-surface-variant/60">Artículos bajo el umbral</p>
          </div>
          <div className="w-12 h-12 rounded bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
        </div>

        <div className="bg-[#1f201a] border border-[#2d3748] rounded-lg p-6 flex items-center justify-between shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
          <div>
            <p className="font-label-caps text-on-surface-variant text-[11px] tracking-[0.1em] font-bold mb-1">PRODUCTOS TOTALES</p>
            <h2 className="text-[32px] font-bold text-primary">{productos.length}</h2>
            <p className="font-body-sm text-on-surface-variant/60">En inventario</p>
          </div>
          <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">inventory_2</span>
          </div>
        </div>

        <div className="bg-[#1f201a] border border-[#2d3748] rounded-lg p-6 flex items-center justify-between shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
          <div>
            <p className="font-label-caps text-on-surface-variant text-[11px] tracking-[0.1em] font-bold mb-1">VALOR TOTAL DEL INVENTARIO</p>
            <h2 className="text-[32px] font-bold text-on-surface">
              {formatMoney(productos.reduce((acc: number, p: any) => acc + (Number(p.precio_venta) * Number(p.stock)), 0))}
            </h2>
            <p className="font-body-sm text-on-surface-variant/60">Valuación de activos</p>
          </div>
          <div className="w-12 h-12 rounded bg-[#35352f] flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant">account_balance_wallet</span>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-[#13140f] border border-[#2d3748] rounded-lg overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,0.5)] flex-grow flex flex-col">
        <div className="p-6 border-b border-[#2d3748] flex justify-between items-center bg-[#1b1c17]">
          <h3 className="font-bold text-[24px] text-on-surface">Catálogo Principal de Inventario</h3>
          <div className="flex gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input className="bg-[#0e0f0a] border border-[#2d3748] rounded pl-9 pr-4 py-2 text-[14px] text-on-surface focus:border-primary outline-none" placeholder="Buscar..." type="text"/>
            </div>
            <button className="bg-[#2a2a24] hover:bg-[#35352f] px-4 py-2 font-label-caps text-[11px] border border-[#2d3748] transition-all text-on-surface font-bold tracking-widest cursor-pointer">FILTRAR</button>
          </div>
        </div>
        
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1b1c17] font-label-caps text-[11px] tracking-[0.1em] font-bold text-on-surface-variant border-b border-[#2d3748]">
                <th className="px-6 py-4">PRODUCTO</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">CATEGORÍA</th>
                <th className="px-6 py-4">STOCK</th>
                <th className="px-6 py-4 text-right">PRECIO</th>
                <th className="px-6 py-4 text-center">ACCIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]">
              {productos.map((p: any) => (
                <tr key={p.producto_id} className="hover:bg-[#35352f]/40 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-[16px] text-on-surface">{p.nombre}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-label-caps text-[12px]">{p.sku}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded bg-[#2a2a24] text-on-surface-variant text-[11px] border border-[#2d3748]">{p.categoria || 'Sin Categoría'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className={`text-[12px] font-bold ${Number(p.stock) < 10 ? 'text-error' : 'text-primary'}`}>
                      {p.stock} en stock {Number(p.stock) < 10 && '(BAJO)'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[16px]">
                    {formatMoney(Number(p.precio_venta))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 px-4 py-2 text-[11px] font-label-caps font-bold rounded transition-all cursor-pointer tracking-widest">
                      AJUSTAR
                    </button>
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
