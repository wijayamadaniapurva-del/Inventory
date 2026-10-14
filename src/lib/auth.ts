import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { canAccess, homePathFor } from "@/lib/roles";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, role, created_at")
    .eq("id", user.id)
    .single<Profile>();

  if (profile) return profile;

  // Fallback if the profiles row hasn't been created yet for this user
  // (e.g. a brief delay right after the auth trigger fires).
  return {
    id: user.id,
    full_name: null,
    username: null,
    role: "warehouse_staff",
    created_at: new Date().toISOString(),
  };
}

/**
 * Page guard. Call at the top of every page under (app) with that page's
 * own path: a hidden menu item is not access control, the URL still
 * works without this.
 */
export async function requireAccess(path: string): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccess(profile.role, path)) redirect(homePathFor(profile.role));
  return profile;
}
