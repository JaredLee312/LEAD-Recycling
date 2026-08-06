import { describe, it, expect } from 'vitest';
import assistantModule from '../js/assistant.js';

const {
  CATEGORY_INFO,
  validateAssistantForm,
  mapLabelToCategory,
  REASON_TEMPLATES
} = assistantModule;

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

describe('mapLabelToCategory — mapping ImageNet labels onto bin categories', () => {
  it('maps drink containers to blue-bin', () => {
    expect(mapLabelToCategory('water bottle').category).toBe('blue-bin');
    expect(mapLabelToCategory('pop bottle, soda bottle').category).toBe('blue-bin');
  });

  it('flags a BCRS hint only for bottle/can-shaped blue-bin items', () => {
    expect(mapLabelToCategory('water bottle').bcrsHint).toBe(true);
    expect(mapLabelToCategory('newspaper').bcrsHint).toBe(false);
  });

  it('maps electronics and batteries to e-waste', () => {
    expect(mapLabelToCategory('cellular telephone').category).toBe('e-waste');
    expect(mapLabelToCategory('laptop, laptop computer').category).toBe('e-waste');
  });

  it('maps clothing and shoes to textile', () => {
    expect(mapLabelToCategory('running shoe').category).toBe('textile');
    expect(mapLabelToCategory('cardigan').category).toBe('textile');
  });

  it('is case-insensitive', () => {
    expect(mapLabelToCategory('WATER BOTTLE').category).toBe('blue-bin');
  });

  it('returns null for labels that match none of the categories', () => {
    expect(mapLabelToCategory('Rottweiler')).toBeNull();
    expect(mapLabelToCategory('')).toBeNull();
  });
});

describe('REASON_TEMPLATES', () => {
  it('has a reason for every real category plus the not-recyclable case', () => {
    expect(REASON_TEMPLATES['blue-bin']).toBeDefined();
    expect(REASON_TEMPLATES['e-waste']).toBeDefined();
    expect(REASON_TEMPLATES['textile']).toBeDefined();
    expect(REASON_TEMPLATES['none']).toBeDefined();
  });
});
