// Local-only session cost helper. The device doesn't know the user's tariff;
// uisettings_store.energy_rate / currency_symbol hold it (set on Settings →
// HTTP). When rate is 0 callers treat the helper as "no cost to display".

/**
 * Format an energy reading as a localised cost string.
 * @param kWh Session energy in kilowatt-hours.
 * @param rate Tariff per kWh in the user's currency.
 * @param symbol Currency symbol — prefixed verbatim, no spacing.
 * @returns `null` when rate/kWh aren't usable for a cost.
 */
export function formatCost(
  kWh: number | undefined,
  rate: number | undefined,
  symbol: string | undefined,
): string | null {
  if (
    kWh === undefined || rate === undefined ||
    !Number.isFinite(kWh) || !Number.isFinite(rate) ||
    rate <= 0 || kWh < 0
  ) {
    return null
  }
  const value = kWh * rate
  // Two decimal places matches how people write tariffs (e.g. "$0.42/kWh");
  // toFixed(2) is good enough — the kWh source itself is only Wh-resolution.
  return `${symbol ?? ''}${value.toFixed(2)}`
}
