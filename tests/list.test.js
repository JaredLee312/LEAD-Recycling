import { describe, it, expect } from 'vitest';
import listModule from '../js/list.js';

const {
  haversineKm,
  formatDistance,
  mapsUrl,
  TOWN_CENTERS,
  findTownMatch,
  selectAndSortBins
} = listModule;

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(1.35, 103.8, 1.35, 103.8)).toBe(0);
  });

  it('returns roughly the right distance for two known Singapore points', () => {
    // Tampines town center to Bedok town center, roughly ~5.5km apart
    const km = haversineKm(1.356191, 103.954634, 1.32398, 103.929984);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(7);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometre distances in metres', () => {
    expect(formatDistance(0.363)).toBe('363 m away');
  });

  it('formats distances of 1km or more in kilometres, one decimal place', () => {
    expect(formatDistance(2.04)).toBe('2.0 km away');
    expect(formatDistance(12.96)).toBe('13.0 km away');
  });
});

describe('mapsUrl', () => {
  it('uses lat/lng coordinates when available, not the address text', () => {
    const url = mapsUrl({ lat: 1.3521, lng: 103.8198, address: 'Near Somewhere, Singapore' });
    expect(url).toContain('query=1.3521%2C103.8198');
    expect(url).not.toContain('Somewhere');
  });

  it('falls back to the address when coordinates are missing', () => {
    const url = mapsUrl({ address: '260 Ang Mo Kio Street 21, Singapore 560260' });
    expect(url).toContain(encodeURIComponent('260 Ang Mo Kio Street 21, Singapore 560260'));
  });
});

describe('findTownMatch', () => {
  it('matches a known town name case-insensitively', () => {
    expect(findTownMatch('tampines')).not.toBeNull();
    expect(findTownMatch('TAMPINES')).not.toBeNull();
    expect(findTownMatch('Tampines').name).toBe('Tampines');
  });

  it('returns null for text that is not a known town', () => {
    expect(findTownMatch('Not A Real Town')).toBeNull();
  });

  it('returns null for an empty or blank query', () => {
    expect(findTownMatch('')).toBeNull();
    expect(findTownMatch('   ')).toBeNull();
  });

  it('every entry in TOWN_CENTERS is findable by its own name', () => {
    TOWN_CENTERS.forEach((town) => {
      expect(findTownMatch(town.name)).not.toBeNull();
    });
  });
});

describe('selectAndSortBins', () => {
  const sampleData = [
    { name: 'Bin Near Tampines', address: '510 Tampines Central 1, Singapore', region: 'East', lat: 1.3548, lng: 103.9445 },
    { name: 'Bin Near Bishan', address: 'Bishan Street 13, Singapore', region: 'Central', lat: 1.3508, lng: 103.8504 },
    { name: 'Bin Near Yishun', address: 'Yishun Ring Road, Singapore', region: 'North', lat: 1.4322, lng: 103.8275 }
  ];

  it('with no query, returns every bin unsorted and unfiltered', () => {
    const result = selectAndSortBins(sampleData, '');
    expect(result.filtered.length).toBe(3);
    expect(result.townMatch).toBeNull();
  });

  it('with a plain text query, filters by substring match on name/address/region', () => {
    // "Near Bishan" (not the bare town name "Bishan") so this exercises the
    // substring-filter path rather than the exact-match town-lookup path.
    const result = selectAndSortBins(sampleData, 'Near Bishan');
    expect(result.filtered.length).toBe(1);
    expect(result.filtered[0].name).toBe('Bin Near Bishan');
  });

  it('with a known town query and zero literal text matches, still returns every bin, sorted by distance', () => {
    // None of the sample addresses contain the word "Tampines" as a region tag
    // match beyond one entry, but the key behaviour under test is: searching a
    // known town must never drop bins just because the town name isn't in
    // their text, and must sort what remains by real distance.
    const result = selectAndSortBins(sampleData, 'Tampines');
    expect(result.townMatch).not.toBeNull();
    expect(result.filtered.length).toBe(3);
    // Nearest to Tampines town centre should be first
    expect(result.filtered[0].name).toBe('Bin Near Tampines');
    expect(result.filtered[0].distanceKm).toBeLessThan(result.filtered[1].distanceKm);
    expect(result.filtered[1].distanceKm).toBeLessThan(result.filtered[2].distanceKm);
  });

  it('a town match takes priority over plain text filtering, even if the query also happens to match by substring', () => {
    const result = selectAndSortBins(sampleData, 'Yishun');
    expect(result.filtered.length).toBe(3);
    expect(result.filtered[0].name).toBe('Bin Near Yishun');
  });
});
