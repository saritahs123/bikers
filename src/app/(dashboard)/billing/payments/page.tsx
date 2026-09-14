import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";

export const metadata = {
  title: "Pagos | Ride Lab",
  description: "Gestión y conciliación de pagos de facturación.",
};

export default function PaymentsPlaceholderPage() {
  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-16 font-sans">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1 font-mono">
            <Link href="/billing" className="hover:text-primary transition-colors">
              Facturación
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Pagos</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            <span>Pagos</span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Registro y trazabilidad de cobranza y abonos
          </p>
        </div>

        <Link
          href="/billing/new"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Factura</span>
        </Link>
      </div>

      {/* Placeholder State */}
      <div className="bg-card border border-border rounded-xl p-12 text-center max-w-xl mx-auto shadow-sm space-y-4 my-10">
        <div className="w-14 h-14 rounded-full bg-surface-subtle border border-border flex items-center justify-center mx-auto text-primary">
          <CreditCard className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            Gestión de Pagos
          </h2>
          <p className="text-xs text-foreground-muted">
            Gestión de pagos disponible en la siguiente fase.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/billing/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover border border-border text-foreground transition-colors"
          >
            <span>Registrar Factura y Pagos</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
