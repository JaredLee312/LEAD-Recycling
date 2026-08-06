import { describe, it, expect, beforeEach } from 'vitest';
import assistantModule from '../js/assistant.js';

const {
  CATEGORY_INFO,
  validateAssistantForm,
  ASSISTANT_COOLDOWN_MS,
  assistantCooldownRemainingMs,
  markAssistantQueried
} = assistantModule;

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

describe('validateAssistantForm', () => {
  it('blocks asking without a photo attached', () => {
    expect(validateAssistantForm({ hasPhoto: false })).not.toBeNull();
  });

  it('allows asking once a photo is attached', () => {
    expect(validateAssistantForm({ hasPhoto: true })).toBeNull();
  });
});

describe('CATEGORY_INFO — maps every classifiable category to a real bin page', () => {
  it('covers all four bin categories the assistant can return', () => {
    expect(CATEGORY_INFO['blue-bin']).toBeDefined();
    expect(CATEGORY_INFO['e-waste']).toBeDefined();
    expect(CATEGORY_INFO['textile']).toBeDefined();
    expect(CATEGORY_INFO['bcrs']).toBeDefined();
  });

  it('does not have an entry for "none" — that case is rendered as not-recyclable instead', () => {
    expect(CATEGORY_INFO['none']).toBeUndefined();
  });

  it('every category links to its real list page', () => {
    expect(CATEGORY_INFO['blue-bin'].href).toBe('blue-bin.html');
    expect(CATEGORY_INFO['e-waste'].href).toBe('e-waste.html');
    expect(CATEGORY_INFO['textile'].href).toBe('textile.html');
    expect(CATEGORY_INFO['bcrs'].href).toBe('bcrs.html');
  });
});

describe('assistant query cooldown (cost control — each query is a real, billed API call)', () => {
  it('has no cooldown before any query has been made', () => {
    expect(assistantCooldownRemainingMs()).toBe(0);
  });

  it('starts a cooldown immediately after a query is marked', () => {
    markAssistantQueried();
    const remaining = assistantCooldownRemainingMs();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(ASSISTANT_COOLDOWN_MS);
  });

  it('cooldown is shorter than the report cooldown — this is a read-only query, not a public write', () => {
    expect(ASSISTANT_COOLDOWN_MS).toBeLessThan(60 * 1000);
  });
});
