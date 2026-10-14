import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { homePathFor } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  // CS has no dashboard, so landing there would bounce them straight back.
  redirect(profile ? homePathFor(profile.role) : "/login");
}
