import { describe, it, expect } from 'vitest';
import analyticsModule from '../js/analytics.js';

const {
  RECYCLING_MATERIALS,
  validateLogEntry,
  computeTotals,
  sortedMaterialBreakdown,
  formatCount
} = analyticsModule;

describe('validateLogEntry', () => {
  it('rejects a missing material', () => {
    expect(validateLogEntry({ material: '', quantity: 3 })).not.toBeNull();
  });

  it('rejects a material not in the known list', () => {
    expect(validateLogEntry({ material: 'Styrofoam', quantity: 3 })).not.toBeNull();
  });

  it('rejects a zero quantity', () => {
    expect(validateLogEntry({ material: 'Paper', quantity: 0 })).not.toBeNull();
  });

  it('rejects a negative quantity', () => {
    expect(validateLogEntry({ material: 'Paper', quantity: -2 })).not.toBeNull();
  });

  it('rejects a non-integer quantity', () => {
    expect(validateLogEntry({ material: 'Paper', quantity: 2.5 })).not.toBeNull();
  });

  it('rejects a non-numeric quantity', () => {
    expect(validateLogEntry({ material: 'Paper', quantity: 'abc' })).not.toBeNull();
  });

  it('accepts a valid entry for every known material', () => {
    RECYCLING_MATERIALS.forEach((material) => {
      expect(validateLogEntry({ material, quantity: 1 })).toBeNull();
    });
  });

  it('accepts a large whole number', () => {
    expect(validateLogEntry({ material: 'Plastic', quantity: 500 })).toBeNull();
  });
});

describe('computeTotals', () => {
  // Fixed reference point: 15 August 2026
  const now = new Date(2026, 7, 15, 12, 0, 0);

  it('returns all zeros for no rows', () => {
    const totals = computeTotals([], now);
    expect(totals.month).toBe(0);
    expect(totals.year).toBe(0);
    expect(totals.allTime).toBe(0);
    expect(totals.byMaterial).toEqual({});
  });

  it('counts an entry from earlier this month in month, year, and allTime', () => {
    const rows = [{ material: 'Paper', quantity: 5, created_at: new Date(2026, 7, 2).toISOString() }];
    const totals = computeTotals(rows, now);
    expect(totals.month).toBe(5);
    expect(totals.year).toBe(5);
    expect(totals.allTime).toBe(5);
  });

  it('counts an entry from earlier this year (different month) in year and allTime, but not month', () => {
    const rows = [{ material: 'Glass', quantity: 7, created_at: new Date(2026, 1, 10).toISOString() }];
    const totals = computeTotals(rows, now);
    expect(totals.month).toBe(0);
    expect(totals.year).toBe(7);
    expect(totals.allTime).toBe(7);
  });

  it('counts an entry from last year only in allTime, not month or year', () => {
    const rows = [{ material: 'Metal', quantity: 9, created_at: new Date(2025, 11, 31).toISOString() }];
    const totals = computeTotals(rows, now);
    expect(totals.month).toBe(0);
    expect(totals.year).toBe(0);
    expect(totals.allTime).toBe(9);
  });

  it('sums correctly across a mix of dates and materials', () => {
    const rows = [
      { material: 'Paper', quantity: 3, created_at: new Date(2026, 7, 10).toISOString() },  // this month
      { material: 'Paper', quantity: 2, created_at: new Date(2026, 3, 1).toISOString() },   // this year, not month
      { material: 'Plastic', quantity: 10, created_at: new Date(2024, 0, 1).toISOString() } // old, allTime only
    ];
    const totals = computeTotals(rows, now);
    expect(totals.month).toBe(3);
    expect(totals.year).toBe(5);
    expect(totals.allTime).toBe(15);
    expect(totals.byMaterial.Paper).toBe(5);
    expect(totals.byMaterial.Plastic).toBe(10);
  });

  it('boundary: an entry at exactly midnight on the 1st of this month counts as this month', () => {
    const rows = [{ material: 'Textile', quantity: 1, created_at: new Date(2026, 7, 1, 0, 0, 0).toISOString() }];
    const totals = computeTotals(rows, now);
    expect(totals.month).toBe(1);
  });
});

describe('sortedMaterialBreakdown', () => {
  it('sorts materials from highest to lowest quantity', () => {
    const result = sortedMaterialBreakdown({ Paper: 3, Plastic: 10, Glass: 5 });
    expect(result.map((r) => r.material)).toEqual(['Plastic', 'Glass', 'Paper']);
  });

  it('returns an empty array for no data', () => {
    expect(sortedMaterialBreakdown({})).toEqual([]);
  });
});

describe('formatCount', () => {
  it('formats small numbers plainly', () => {
    expect(formatCount(7)).toBe('7');
  });

  it('adds thousands separators for large numbers', () => {
    expect(formatCount(12345)).toBe('12,345');
  });

  it('formats zero', () => {
    expect(formatCount(0)).toBe('0');
  });
});
