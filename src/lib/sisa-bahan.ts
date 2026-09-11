export interface ShippedMaterial {
  name: string;
  unit: string;
  qty: number;
}

export interface BomRatio {
  material_item_id: string;
  ratio_per_unit: number;
}

export interface SisaRow {
  name: string;
  unit: string;
  sisa: number;
}

// Perkiraan sisa = qty yang dikirim - (resep x qty yang diterima dari
// maklon, lolos+reject — dua-duanya sama-sama makan material saat
// diproduksi). Cuma dihasilkan untuk material yang sudah punya resep.
export function computeSisaBahan(
  shippedByMaterial: Map<string, ShippedMaterial>,
  bomRows: BomRatio[],
  qtyDiterima: number
): SisaRow[] {
  return bomRows
    .map((b) => {
      const shipped = shippedByMaterial.get(b.material_item_id);
      if (!shipped) return null;
      const expectedUsage = b.ratio_per_unit * qtyDiterima;
      return { name: shipped.name, unit: shipped.unit, sisa: shipped.qty - expectedUsage };
    })
    .filter((r): r is SisaRow => r !== null);
}
