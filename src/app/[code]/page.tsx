import { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicTrackingView from "@/components/tracking/PublicTrackingView";

const RESERVED_PREFIXES = new Set([
  "api",
  "login",
  "change-password",
  "billing",
  "crm",
  "customers",
  "inventory",
  "security",
  "settings",
  "work-orders",
  "workshop",
  "seguimiento",
  "s",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

// Base62 tracking codes are 6 to 12 alphanumeric characters
const SHORT_CODE_REGEX = /^[A-Za-z0-9]{6,12}$/;

export const metadata: Metadata = {
  title: "Ride Lab | Seguimiento de Reparación",
  description: "Portal oficial de seguimiento en vivo de tu orden de trabajo en Ride Lab.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DirectTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (
    !code ||
    RESERVED_PREFIXES.has(code.toLowerCase()) ||
    !SHORT_CODE_REGEX.test(code)
  ) {
    notFound();
  }

  return (
    <PublicTrackingView
      params={params as unknown as Promise<Record<string, string>>}
      paramKey="code"
    />
  );
}
