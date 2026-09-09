// Safety Stock = Rata-rata pemakaian harian x Lead time (hari) x (1 + Faktor buffer)
// avg_daily_usage and lead_time_days are per item; bufferPercent is one
// global setting shared by every item (see app_settings key
// 'safety_stock_buffer_percent').
export function computeSafetyStock(
  avgDailyUsage: number | null,
  leadTimeDays: number | null,
  bufferPercent: number
): number | null {
  if (avgDailyUsage == null || leadTimeDays == null) return null;
  return avgDailyUsage * leadTimeDays * (1 + bufferPercent / 100);
}
