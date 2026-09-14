import { redirect } from "next/navigation";

interface InvoiceSubpageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceSubpageProps) {
  const { id } = await params;
  redirect(`/billing/invoices?invoice_id=${id}`);
}
