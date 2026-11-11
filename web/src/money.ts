export function formatMoney(minorUnits: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });

  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const units = String(minorUnits).padStart(digits + 1, '0');
  const decimal = digits === 0 ? units : `${units.slice(0, -digits)}.${units.slice(-digits)}`;
  return formatter.format(decimal as Intl.StringNumericLiteral);
}
