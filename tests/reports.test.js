import { describe, it, expect, beforeEach } from 'vitest';
import reportsModule from '../js/reports.js';

const {
  binId,
  timeAgo,
  REPORT_COOLDOWN_MS,
  reportCooldownRemainingMs,
  markReportSubmitted,
  validateReportForm,
  validateReportEdit,
  validatePhotoFile,
  photoStoragePathFromUrl,
  MAX_PHOTO_BYTES,
  REPORT_VISIBILITY_MS,
  isReportVisible,
  REPORT_TYPE_LABELS
} = reportsModule;

// Minimal in-memory localStorage polyfill — Node has no localStorage global,
// and this is the only browser API these particular functions touch.
function makeFakeLocalStorage() {
  let store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
}

beforeEach(() => {
  global.localStorage = makeFakeLocalStorage();
});

describe('binId', () => {
  it('builds a stable id from lat/lng, independent of object key order', () => {
    const a = binId({ lat: 1.3521, lng: 103.8198, name: 'A' });
    const b = binId({ name: 'B', lng: 103.8198, lat: 1.3521 });
    expect(a).toBe(b);
  });

  it('produces different ids for different coordinates', () => {
    const a = binId({ lat: 1.3521, lng: 103.8198 });
    const b = binId({ lat: 1.3522, lng: 103.8198 });
    expect(a).not.toBe(b);
  });
});

describe('timeAgo', () => {
  it('reports very recent timestamps as "just now"', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
  });

  it('reports a timestamp from 2 hours ago correctly', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2 hours ago');
  });

  it('uses singular wording for exactly 1 unit', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneHourAgo)).toBe('1 hour ago');
  });
});

describe('validateReportForm — a report type must be actively chosen', () => {
  it('blocks submission when no report type is selected at all', () => {
    expect(validateReportForm({ reportType: '', description: '', hasPhoto: true })).not.toBeNull();
  });

  it('blocks submission when reportType is missing entirely', () => {
    expect(validateReportForm({ description: 'Something is wrong', hasPhoto: true })).not.toBeNull();
  });
});

describe('validateReportForm — a photo is compulsory', () => {
  it('blocks submission when no photo is attached, even with a valid type selected', () => {
    expect(validateReportForm({ reportType: 'full', description: '', hasPhoto: false })).not.toBeNull();
  });

  it('allows submission once a photo is attached', () => {
    expect(validateReportForm({ reportType: 'full', description: '', hasPhoto: true })).toBeNull();
  });
});

describe('validateReportForm — Legal Tech rule: "Other" issues need a description', () => {
  it('blocks submission when type is "other" with no description', () => {
    expect(validateReportForm({ reportType: 'other', description: '', hasPhoto: true })).not.toBeNull();
  });

  it('allows submission when type is "other" with a description', () => {
    expect(validateReportForm({ reportType: 'other', description: 'Lid is missing', hasPhoto: true })).toBeNull();
  });

  it('never requires a description for "full" or "damaged" — description stays optional', () => {
    expect(validateReportForm({ reportType: 'full', description: '', hasPhoto: true })).toBeNull();
    expect(validateReportForm({ reportType: 'damaged', description: '', hasPhoto: true })).toBeNull();
  });
});

describe('validatePhotoFile — Defense: reject bad uploads before they reach the network', () => {
  it('does not itself enforce presence — that is validateReportForm\'s job via hasPhoto', () => {
    expect(validatePhotoFile(null)).toBeNull();
  });

  it('rejects non-image files', () => {
    const err = validatePhotoFile({ type: 'text/plain', size: 1000 });
    expect(err).not.toBeNull();
  });

  it('rejects image formats other than JPG/PNG (e.g. WEBP, GIF, HEIC)', () => {
    expect(validatePhotoFile({ type: 'image/webp', size: 1000 })).not.toBeNull();
    expect(validatePhotoFile({ type: 'image/gif', size: 1000 })).not.toBeNull();
    expect(validatePhotoFile({ type: 'image/heic', size: 1000 })).not.toBeNull();
  });

  it('accepts JPG under both its common MIME spellings', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/jpg', size: 1000 })).toBeNull();
  });

  it('rejects files over 10MB', () => {
    const err = validatePhotoFile({ type: 'image/png', size: 11 * 1024 * 1024 });
    expect(err).not.toBeNull();
  });

  it('accepts a file exactly at the 10MB boundary', () => {
    const err = validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES });
    expect(err).toBeNull();
  });

  it('accepts a normal small image', () => {
    const err = validatePhotoFile({ type: 'image/jpeg', size: 500 * 1024 });
    expect(err).toBeNull();
  });
});

describe('report submission cooldown (basic spam control)', () => {
  it('has no cooldown before any report has been submitted', () => {
    expect(reportCooldownRemainingMs()).toBe(0);
  });

  it('starts a cooldown immediately after a report is marked submitted', () => {
    markReportSubmitted();
    const remaining = reportCooldownRemainingMs();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(REPORT_COOLDOWN_MS);
  });
});

describe('isReportVisible — reports disappear after 24 hours', () => {
  it('a report submitted just now is visible', () => {
    expect(isReportVisible(new Date().toISOString())).toBe(true);
  });

  it('a report from 23 hours ago is still visible', () => {
    const iso = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(isReportVisible(iso)).toBe(true);
  });

  it('a report from 25 hours ago is no longer visible', () => {
    const iso = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isReportVisible(iso)).toBe(false);
  });

  it('REPORT_VISIBILITY_MS is exactly 24 hours', () => {
    expect(REPORT_VISIBILITY_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('REPORT_TYPE_LABELS', () => {
  it('has a label for every report type the form can submit', () => {
    expect(REPORT_TYPE_LABELS.full).toBeDefined();
    expect(REPORT_TYPE_LABELS.damaged).toBeDefined();
    expect(REPORT_TYPE_LABELS.other).toBeDefined();
  });
});

describe('validateReportEdit — editing an existing report', () => {
  it('blocks saving when no report type is selected', () => {
    expect(validateReportEdit({ reportType: '', description: '' })).not.toBeNull();
  });

  it('does not require a photo to be re-attached (unlike a new submission)', () => {
    expect(validateReportEdit({ reportType: 'full', description: '' })).toBeNull();
  });

  it('still requires a description when the type is "other"', () => {
    expect(validateReportEdit({ reportType: 'other', description: '' })).not.toBeNull();
    expect(validateReportEdit({ reportType: 'other', description: 'Lid is missing' })).toBeNull();
  });
});

describe('photoStoragePathFromUrl — recovering the storage path so a deleted report also deletes its photo', () => {
  it('extracts the path after the bucket name from a public URL', () => {
    const url = 'https://xyz.supabase.co/storage/v1/object/public/bin-report-photos/blue-bin/1.234_103.8/167-abc.jpg';
    expect(photoStoragePathFromUrl(url)).toBe('blue-bin/1.234_103.8/167-abc.jpg');
  });

  it('returns null for a report with no photo', () => {
    expect(photoStoragePathFromUrl(null)).toBeNull();
  });

  it('returns null for a url that does not contain the bucket marker', () => {
    expect(photoStoragePathFromUrl('https://example.com/not-a-supabase-url.jpg')).toBeNull();
  });
});
