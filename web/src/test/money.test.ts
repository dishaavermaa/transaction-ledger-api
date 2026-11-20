import { describe, expect, it } from 'vitest';
import { MoneyError, formatMinor, minorToRupeesString, rupeesToMinor } from '../lib/money';

describe('rupeesToMinor', () => {
  it('converts whole rupees to paise', () => {
    expect(rupeesToMinor('100')).toBe(10_000);
    expect(rupeesToMinor('0')).toBe(0);
  });

  it('converts one and two decimal places exactly', () => {
    expect(rupeesToMinor('12.5')).toBe(1_250);
    expect(rupeesToMinor('12.50')).toBe(1_250);
    expect(rupeesToMinor('0.01')).toBe(1);
  });

  it('handles the classic float trap without error (0.1 + 0.2 === 0.3)', () => {
    // Float math gives 0.30000000000000004; string parsing must not.
    expect(rupeesToMinor('0.1') + rupeesToMinor('0.2')).toBe(rupeesToMinor('0.3'));
    expect(rupeesToMinor('0.1') + rupeesToMinor('0.2')).toBe(30);
  });

  it('rejects more than two decimal places', () => {
    expect(() => rupeesToMinor('1.234')).toThrow(MoneyError);
    expect(() => rupeesToMinor('0.001')).toThrow(MoneyError);
  });

  it('rejects empty, non-numeric, and negative input', () => {
    expect(() => rupeesToMinor('')).toThrow(MoneyError);
    expect(() => rupeesToMinor('   ')).toThrow(MoneyError);
    expect(() => rupeesToMinor('abc')).toThrow(MoneyError);
    expect(() => rupeesToMinor('-5')).toThrow(MoneyError);
    expect(() => rupeesToMinor('5.')).toThrow(MoneyError);
  });

  it('trims surrounding whitespace', () => {
    expect(rupeesToMinor('  42.00  ')).toBe(4_200);
  });
});

describe('minorToRupeesString', () => {
  it('formats paise as a plain decimal', () => {
    expect(minorToRupeesString(5_000)).toBe('50.00');
    expect(minorToRupeesString(1)).toBe('0.01');
    expect(minorToRupeesString(0)).toBe('0.00');
  });
});

describe('formatMinor', () => {
  it('formats paise as an INR amount', () => {
    const formatted = formatMinor(5_000);
    expect(formatted).toContain('50.00');
    // en-IN currency formatting uses the ₹ symbol.
    expect(formatted).toMatch(/₹|INR/);
  });

  it('round-trips a rupee string through minor units', () => {
    expect(formatMinor(rupeesToMinor('1234.56'))).toContain('1,234.56');
  });
});
