import { Metadata } from "next";
import PublicTrackingView from "@/components/tracking/PublicTrackingView";

export const metadata: Metadata = {
  title: "Ride Lab | Seguimiento de Reparación",
  description: "Portal oficial de seguimiento en vivo de tu orden de trabajo en Ride Lab.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LongTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PublicTrackingView params={params as unknown as Promise<Record<string, string>>} paramKey="token" />;
}
