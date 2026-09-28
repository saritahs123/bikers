import { redirect } from "next/navigation";

export default async function LegacyShortTrackingRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!code) {
    redirect("/");
  }
  redirect(`/${encodeURIComponent(code)}`);
}
