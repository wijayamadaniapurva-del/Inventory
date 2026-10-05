import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decideAction, parseScalevPayload, type ParsedLine } from "@/lib/scalev-payload";

export const dynamic = "force-dynamic";

// Scalev webhook URL (Scalev dashboard: Settings -> Developers):
//   https://<domain>/api/webhooks/scalev?secret=<SCALEV_WEBHOOK_SECRET>
// The secret can also be sent as an "x-webhook-secret" header or as
// "Authorization: Bearer <secret>", since not every dashboard lets you
// keep a query string on the URL.
//
// Stock effect: a sale leaves Gudang L1 (FG sits there after QC), a
// return/cancellation comes back into Gudang L1. Which statuses count
// is decided in lib/scalev-payload.ts.
const SALE_LOCATION = "gudang_l1" as const;

function readSecret(request: NextRequest): string | null {
  const fromQuery = request.nextUrl.searchParams.get("secret");
  if (fromQuery) return fromQuery;

  const header = request.headers.get("x-webhook-secret") ?? request.headers.get("x-scalev-secret");
  if (header) return header;

  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  return null;
}

// Scalev (and most dashboards) ping the URL with a GET when you save it.
// Answering 200 here is what makes the endpoint "connect".
//
// Adding the correct ?secret= turns this into a self-check page: it
// answers the three questions that otherwise need a Supabase query —
// is the secret set, can the server reach the database, and has any
// webhook actually arrived.
export async function GET(request: NextRequest) {
  const expected = process.env.SCALEV_WEBHOOK_SECRET;
  const base = { ok: true, endpoint: "scalev-webhook", method: "POST" };

  if (!expected || readSecret(request) !== expected) {
    return NextResponse.json(base);
  }

  const diagnostics: Record<string, unknown> = {
    secret_configured: true,
    service_key_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    status_keluar: process.env.SCALEV_STATUS_KELUAR || "(default)",
    status_masuk: process.env.SCALEV_STATUS_MASUK || "(default)",
  };

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count, error: countError } = await supabase
      .from("scalev_sync_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

    if (countError) throw new Error(countError.message);

    const { data: last } = await supabase
      .from("scalev_sync_log")
      .select("created_at, direction, status, note, event_key")
      .order("created_at", { ascending: false })
      .limit(3);

    diagnostics.database = "ok";
    diagnostics.webhook_calls_24h = count ?? 0;
    diagnostics.last_entries = last ?? [];
  } catch (e) {
    diagnostics.database = "error";
    diagnostics.database_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ ...base, diagnostics });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const expected = process.env.SCALEV_WEBHOOK_SECRET;
  const supabase = createServiceClient();

  async function log(fields: {
    direction: "receive_order" | "receive_rts";
    status: "success" | "failed" | "skipped" | "pending";
    note: string;
    payload: unknown;
    eventKey?: string | null;
  }) {
    const { error } = await supabase.from("scalev_sync_log").insert({
      direction: fields.direction,
      status: fields.status,
      note: fields.note,
      payload: (fields.payload ?? {}) as Record<string, unknown>,
      event_key: fields.eventKey ?? null,
    });
    return error;
  }

  // Misconfiguration is the likeliest reason a webhook "can't connect",
  // so it gets its own answer instead of a blanket 401.
  if (!expected) {
    await log({
      direction: "receive_order",
      status: "failed",
      note: "SCALEV_WEBHOOK_SECRET belum di-set di environment Vercel.",
      payload: {},
    });
    return NextResponse.json({ error: "Webhook secret not configured on server" }, { status: 503 });
  }

  if (readSecret(request) !== expected) {
    await log({
      direction: "receive_order",
      status: "failed",
      note: "Secret salah atau tidak dikirim. Cek URL webhook di Scalev.",
      payload: {},
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    await log({
      direction: "receive_order",
      status: "failed",
      note: "Body bukan JSON yang valid.",
      payload: { raw: raw.slice(0, 2000) },
    });
    // 200, not 400: the body is already logged, and a 4xx just makes
    // Scalev retry the same broken payload or mark the endpoint dead.
    return NextResponse.json({ ok: false, reason: "invalid-json" });
  }

  const event = parseScalevPayload(payload);
  const { action, reason } = decideAction(event, {
    keluar: process.env.SCALEV_STATUS_KELUAR,
    masuk: process.env.SCALEV_STATUS_MASUK,
  });

  if (action === "ignore") {
    await log({ direction: "receive_order", status: "skipped", note: reason, payload });
    return NextResponse.json({ ok: true, skipped: reason });
  }

  const direction = action === "masuk" ? "receive_rts" : "receive_order";

  if (event.lines.length === 0) {
    await log({
      direction,
      status: "failed",
      note: "Status cocok, tapi daftar produk tidak ditemukan di payload. Perlu dicek strukturnya.",
      payload,
    });
    return NextResponse.json({ ok: false, reason: "no-lines" });
  }

  // Idempotency gate. The insert happens BEFORE any stock is moved: if
  // this exact order+action was already handled, the unique index on
  // event_key rejects it and we stop here instead of deducting twice.
  const eventKey = event.orderId ? `${event.orderId}:${action}` : null;
  if (eventKey) {
    const { error } = await supabase.from("scalev_sync_log").insert({
      direction,
      status: "pending",
      note: reason,
      payload: payload as Record<string, unknown>,
      event_key: eventKey,
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, skipped: "duplicate", event_key: eventKey });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  async function finish(status: "success" | "failed" | "skipped", note: string) {
    if (eventKey) {
      await supabase.from("scalev_sync_log").update({ status, note }).eq("event_key", eventKey);
    } else {
      await log({ direction, status, note, payload });
    }
  }

  const { data: items, error: itemsError } = await supabase
    .from("master_items")
    .select("id, name, scalev_product_id")
    .eq("is_active", true);

  if (itemsError) {
    await finish("failed", "Gagal baca master item: " + itemsError.message);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const byScalevId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const it of items ?? []) {
    if (it.scalev_product_id) byScalevId.set(String(it.scalev_product_id).toLowerCase(), it.id);
    byName.set(it.name.toLowerCase().trim(), it.id);
  }

  function matchItem(line: ParsedLine): string | null {
    if (line.productId) {
      const hit = byScalevId.get(line.productId.toLowerCase());
      if (hit) return hit;
    }
    if (line.name) {
      const hit = byName.get(line.name.toLowerCase().trim());
      if (hit) return hit;
    }
    return null;
  }

  const movements: {
    item_id: string;
    movement_type: "masuk" | "keluar";
    qty: number;
    from_location: typeof SALE_LOCATION | null;
    to_location: typeof SALE_LOCATION | "customer" | null;
    note: string;
  }[] = [];
  const unmatched: string[] = [];

  for (const line of event.lines) {
    const itemId = matchItem(line);
    if (!itemId) {
      unmatched.push(line.name ?? line.productId ?? "(tanpa nama)");
      continue;
    }
    movements.push(
      action === "keluar"
        ? {
            item_id: itemId,
            movement_type: "keluar",
            qty: line.qty,
            from_location: SALE_LOCATION,
            to_location: "customer",
            note: `Scalev order ${event.orderId ?? "-"}`,
          }
        : {
            item_id: itemId,
            movement_type: "masuk",
            qty: line.qty,
            from_location: null,
            to_location: SALE_LOCATION,
            note: `Scalev retur/batal order ${event.orderId ?? "-"}`,
          },
    );
  }

  if (movements.length === 0) {
    await finish(
      "failed",
      `Tidak ada produk yang cocok dengan master item: ${unmatched.join(", ")}. ` +
        "Isi Scalev Product ID di Master Data, atau samakan nama itemnya.",
    );
    return NextResponse.json({ ok: false, reason: "no-match", unmatched });
  }

  // Written with the service role, so this bypasses RLS on purpose —
  // there's no logged-in user behind a webhook. That also means the
  // stock check inside create_stock_movement() doesn't apply here, and
  // that's deliberate: a sale that already happened in Scalev should
  // still be recorded even if our stock figure says there isn't enough.
  // It shows up as negative stock, which is the signal that something
  // upstream needs fixing.
  const { error: moveError } = await supabase.from("stock_movements").insert(movements);

  if (moveError) {
    await finish("failed", "Gagal tulis pergerakan stok: " + moveError.message);
    return NextResponse.json({ error: moveError.message }, { status: 500 });
  }

  const note =
    `${reason} ${movements.length} baris stok tercatat.` +
    (unmatched.length > 0 ? ` Tidak cocok: ${unmatched.join(", ")}.` : "");
  await finish(unmatched.length > 0 ? "skipped" : "success", note);

  return NextResponse.json({ ok: true, moved: movements.length, unmatched });
}
