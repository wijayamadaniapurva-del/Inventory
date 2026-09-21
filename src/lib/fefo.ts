// Reconstructs "how much of this item's current stock expires on which
// date" from the raw movement log — there's no real batch/lot tracking
// in the schema, so this is a First-Expired-First-Out simulation:
// replay every movement in chronological order, and whenever stock
// leaves, assume it came from whichever active batch expires soonest.
// This keeps the total exactly right; the split *between* dates is a
// reasonable estimate, not a precise record (confirmed acceptable).
//
// Scope: Gudang L1 + L2 combined (an internal transfer between the two
// floors doesn't change the combined total, so it's ignored here).
export interface FefoMovement {
  movement_type: "masuk" | "transfer" | "keluar";
  qty: number;
  from_location: string | null;
  to_location: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface ExpiryBatch {
  expiry_date: string | null; // null = no expiry date was ever recorded for this stock
  qty: number;
}

const POOL_LOCATIONS = new Set(["gudang_l1", "gudang_l2"]);
const EPSILON = 0.0001;

function inPool(loc: string | null): boolean {
  return loc != null && POOL_LOCATIONS.has(loc);
}

export function computeExpiryBatches(movements: FefoMovement[]): ExpiryBatch[] {
  const sorted = [...movements].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const batches: { expiry_date: string | null; remaining: number }[] = [];

  function addBatch(qty: number, expiry_date: string | null) {
    if (qty > 0) batches.push({ expiry_date, remaining: qty });
  }

  function consume(qty: number) {
    let toConsume = qty;
    while (toConsume > EPSILON) {
      let target: { expiry_date: string | null; remaining: number } | null = null;
      for (const b of batches) {
        if (b.remaining <= EPSILON) continue;
        if (
          target === null ||
          (b.expiry_date !== null && (target.expiry_date === null || b.expiry_date < target.expiry_date))
        ) {
          target = b;
        }
      }
      if (!target) break; // nothing left to consume from — data inconsistency, stop gracefully
      const take = Math.min(target.remaining, toConsume);
      target.remaining -= take;
      toConsume -= take;
    }
  }

  for (const m of sorted) {
    if (m.movement_type === "masuk" && inPool(m.to_location)) {
      addBatch(m.qty, m.expiry_date);
    } else if (m.movement_type === "keluar" && inPool(m.from_location)) {
      consume(m.qty);
    } else if (m.movement_type === "transfer") {
      const fromPool = inPool(m.from_location);
      const toPool = inPool(m.to_location);
      if (fromPool && !toPool) {
        consume(m.qty); // leaving L1/L2 entirely (e.g. to Vendor Cat / Maklon)
      } else if (!fromPool && toPool) {
        addBatch(m.qty, null); // entering from outside — no expiry data was ever captured on this leg
      }
      // fromPool && toPool (between L1 and L2): stays in the combined pool, ignore
    }
  }

  const merged = new Map<string, number>();
  for (const b of batches) {
    if (b.remaining <= EPSILON) continue;
    const key = b.expiry_date ?? "__none__";
    merged.set(key, (merged.get(key) ?? 0) + b.remaining);
  }

  return Array.from(merged.entries())
    .map(([key, qty]) => ({ expiry_date: key === "__none__" ? null : key, qty }))
    .sort((a, b) => {
      if (a.expiry_date === b.expiry_date) return 0;
      if (a.expiry_date === null) return 1;
      if (b.expiry_date === null) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });
}
