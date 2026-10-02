/**
 * Scalev doesn't publish a fixed payload schema, and the field names
 * differ between event types (order.created vs order.status_changed).
 * Rather than hard-coding one shape and silently doing nothing when it
 * doesn't match, this reads the payload defensively: it looks for the
 * pieces it needs under any of the names Scalev is known to use, and
 * reports what it couldn't find so the Scalev Log page can show why an
 * event didn't move stock.
 */

export type ParsedAction = "keluar" | "masuk" | "ignore";

export interface ParsedLine {
  /** Whatever identifier the payload carried — matched against master_items.scalev_product_id */
  productId: string | null;
  /** Product/variant name, used as a fallback match on master_items.name */
  name: string | null;
  qty: number;
}

export interface ParsedEvent {
  eventName: string | null;
  orderId: string | null;
  status: string | null;
  lines: ParsedLine[];
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** First non-empty string found at any of `keys`, searched depth-first. */
function findString(node: unknown, keys: string[], depth = 0): string | null {
  if (depth > 6 || !isObject(node)) return null;
  for (const k of keys) {
    const v = node[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  for (const v of Object.values(node)) {
    if (isObject(v)) {
      const found = findString(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function toQty(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const LINE_ARRAY_KEYS = [
  "order_details",
  "order_items",
  "orderItems",
  "items",
  "products",
  "line_items",
  "lineItems",
  "details",
  "cart_items",
];

const PRODUCT_ID_KEYS = [
  "scalev_product_id",
  "product_variant_id",
  "productVariantId",
  "variant_id",
  "variantId",
  "product_id",
  "productId",
  "sku",
  "product_sku",
];

const PRODUCT_NAME_KEYS = [
  "product_name",
  "productName",
  "variant_name",
  "variantName",
  "name",
  "product_variant_name",
  "title",
];

const QTY_KEYS = ["quantity", "qty", "amount", "total_quantity", "qty_ordered", "count"];

/** Pulls the order lines out of whichever array the payload used. */
function findLines(node: unknown, depth = 0): ParsedLine[] {
  if (depth > 6 || !isObject(node)) return [];

  for (const key of LINE_ARRAY_KEYS) {
    const arr = node[key];
    if (Array.isArray(arr) && arr.length > 0 && arr.some(isObject)) {
      const lines = arr.filter(isObject).map((row) => {
        let qty = 0;
        for (const k of QTY_KEYS) {
          qty = toQty(row[k]);
          if (qty > 0) break;
        }
        return {
          productId: findString(row, PRODUCT_ID_KEYS),
          name: findString(row, PRODUCT_NAME_KEYS),
          // A line with no quantity field at all still means one unit
          // sold far more often than it means zero.
          qty: qty > 0 ? qty : 1,
        };
      });
      if (lines.some((l) => l.productId || l.name)) return lines;
    }
  }

  for (const v of Object.values(node)) {
    if (isObject(v)) {
      const found = findLines(v, depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export function parseScalevPayload(payload: unknown): ParsedEvent {
  const root = isObject(payload) ? payload : {};
  return {
    eventName: findString(root, ["event", "event_type", "eventType", "type", "topic", "action"]),
    orderId: findString(root, [
      "order_id",
      "orderId",
      "order_code",
      "orderCode",
      "invoice_number",
      "invoiceNumber",
      "code",
      "id",
    ]),
    status: findString(root, [
      "new_status",
      "newStatus",
      "order_status",
      "orderStatus",
      "status",
      "payment_status",
      "paymentStatus",
    ]),
    lines: findLines(root),
  };
}

/**
 * Which statuses actually move stock.
 *
 * Deducting on "order created" would be wrong here: Scalev orders can
 * sit unpaid or get cancelled before anything leaves the warehouse. So
 * stock goes out when the order is packed/shipped, and comes back on a
 * cancellation or return (RTS).
 *
 * Both lists can be overridden per environment without a redeploy —
 * SCALEV_STATUS_KELUAR / SCALEV_STATUS_MASUK, comma-separated — because
 * the exact wording Scalev sends is easier to confirm from a real
 * event than to guess.
 */
const DEFAULT_KELUAR = [
  "dikirim",
  "sedang_dikirim",
  "shipped",
  "shipping",
  "in_transit",
  "dalam_pengiriman",
  "packing",
  "diproses",
  "processing",
  "selesai",
  "completed",
  "delivered",
  "diterima",
];

const DEFAULT_MASUK = [
  "rts",
  "retur",
  "return",
  "returned",
  "batal",
  "cancel",
  "cancelled",
  "canceled",
  "dibatalkan",
  "refund",
  "refunded",
];

function listFromEnv(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s-]+/g, "_");
}

export function decideAction(
  event: ParsedEvent,
  env: { keluar?: string; masuk?: string } = {},
): { action: ParsedAction; reason: string } {
  const keluarList = listFromEnv(env.keluar, DEFAULT_KELUAR);
  const masukList = listFromEnv(env.masuk, DEFAULT_MASUK);

  // Status wins over event name: "order.updated" says nothing on its
  // own, the status inside it does.
  const haystack = normalize([event.status, event.eventName].filter(Boolean).join(" "));
  if (!haystack) return { action: "ignore", reason: "Event tanpa status — tidak jelas harus apa." };

  const hit = (list: string[]) => list.find((word) => haystack.includes(normalize(word)));

  const masukHit = hit(masukList);
  if (masukHit) return { action: "masuk", reason: `Status "${event.status ?? event.eventName}" → stok balik (${masukHit}).` };

  const keluarHit = hit(keluarList);
  if (keluarHit) return { action: "keluar", reason: `Status "${event.status ?? event.eventName}" → stok keluar (${keluarHit}).` };

  return { action: "ignore", reason: `Status "${event.status ?? event.eventName}" tidak termasuk daftar yang mengubah stok.` };
}
