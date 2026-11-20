/**
 * Money is integer minor units (paise) everywhere — in state, in requests, and
 * in responses — exactly like the backend. Rupees exist only as display strings
 * and as what the user types. All conversion happens here, by string parsing
 * rather than float math, so classic float errors (0.1 + 0.2 !== 0.3) can never
 * corrupt an amount.
 */

export class MoneyError extends Error {}

/**
 * Parse a user-typed rupee amount into integer paise.
 * Accepts digits with an optional dot and up to two decimal places.
 * Rejects empty input, negatives, more than two decimals, and junk.
 */
export function rupeesToMinor(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new MoneyError('Enter an amount.');
  }
  // One or more digits, optionally a dot followed by 1–2 digits. No sign.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new MoneyError('Enter a valid amount in rupees (up to 2 decimal places).');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  // Pad "5" -> "50" paise and "5.2" -> "20" paise. String-based, so no rounding.
  const paise = fraction.padEnd(2, '0');
  const minor = Number(whole) * 100 + Number(paise);
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError('Amount is too large.');
  }
  return minor;
}

/** Integer paise -> rupees as a plain decimal string ("5000" -> "50.00"). */
export function minorToRupeesString(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const rupees = Math.trunc(abs / 100);
  const paise = abs % 100;
  return `${sign}${rupees}.${String(paise).padStart(2, '0')}`;
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Integer paise -> localized INR string for display, e.g. 5000 -> "₹50.00". */
export function formatMinor(minor: number): string {
  // Division is for display only; the underlying value stays integer paise.
  return inr.format(minor / 100);
}
