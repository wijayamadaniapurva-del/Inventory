import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Scalev's webhook URL should be set to:
//   https://<your-domain>/api/webhooks/scalev?secret=<SCALEV_WEBHOOK_SECRET>
// (configured in Scalev dashboard: Settings -> Developers -> Webhook URL).
// The secret is just a shared password so random people can't post fake
// events here — it's not Scalev's own signing mechanism (we don't yet
// know if Scalev signs its webhook payloads; if their docs specify a
// signature header, add that check here too before going live).
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SCALEV_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Everything gets logged raw for now, status 'pending'. Once we know
  // the exact event/field names Scalev sends for a return (RTS), this
  // is the place to add: parse payload -> find the matching master_item
  // via scalev_product_id -> insert a stock_movements row (masuk, to
  // gudang_l1, note 'RTS dari Scalev') -> mark this row 'success'.
  const { error } = await supabase.from("scalev_sync_log").insert({
    direction: "receive_rts",
    payload: payload as Record<string, unknown>,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
