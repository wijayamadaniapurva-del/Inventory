import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import type { Profile } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", user.id)
    .single<Profile>();

  // Fallback role if a profile row hasn't been created yet for this user.
  const role = profile?.role ?? "warehouse_staff";

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav role={role} fullName={profile?.full_name ?? null} />
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
