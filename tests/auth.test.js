import { describe, it, expect } from 'vitest';
import authModule from '../js/auth.js';

const { validateAuthForm, validateMfaCode } = authModule;

describe('validateAuthForm — sign in', () => {
  it('rejects a missing email', () => {
    expect(validateAuthForm({ email: '', password: 'password123', mode: 'signin' })).not.toBeNull();
  });

  it('rejects a malformed email', () => {
    expect(validateAuthForm({ email: 'not-an-email', password: 'password123', mode: 'signin' })).not.toBeNull();
  });

  it('rejects a missing password', () => {
    expect(validateAuthForm({ email: 'user@example.com', password: '', mode: 'signin' })).not.toBeNull();
  });

  it('rejects a password under 8 characters', () => {
    expect(validateAuthForm({ email: 'user@example.com', password: 'short', mode: 'signin' })).not.toBeNull();
  });

  it('accepts a valid email and password', () => {
    expect(validateAuthForm({ email: 'user@example.com', password: 'password123', mode: 'signin' })).toBeNull();
  });

  it('accepts a password exactly at the 8-character boundary', () => {
    expect(validateAuthForm({ email: 'user@example.com', password: '12345678', mode: 'signin' })).toBeNull();
  });
});

describe('validateAuthForm — sign up', () => {
  it('rejects mismatched passwords', () => {
    const result = validateAuthForm({
      email: 'user@example.com', password: 'password123', confirmPassword: 'different123', consent: true, mode: 'signup'
    });
    expect(result).not.toBeNull();
  });

  it('accepts matching passwords with consent given', () => {
    const result = validateAuthForm({
      email: 'user@example.com', password: 'password123', confirmPassword: 'password123', consent: true, mode: 'signup'
    });
    expect(result).toBeNull();
  });

  it('rejects a missing confirmPassword field entirely', () => {
    const result = validateAuthForm({ email: 'user@example.com', password: 'password123', consent: true, mode: 'signup' });
    expect(result).not.toBeNull();
  });
});

describe('validateAuthForm — sign up requires explicit Privacy Policy consent (PDPA)', () => {
  it('blocks account creation when the consent checkbox is unchecked', () => {
    const result = validateAuthForm({
      email: 'user@example.com', password: 'password123', confirmPassword: 'password123', consent: false, mode: 'signup'
    });
    expect(result).not.toBeNull();
  });

  it('blocks account creation when consent is omitted entirely', () => {
    const result = validateAuthForm({
      email: 'user@example.com', password: 'password123', confirmPassword: 'password123', mode: 'signup'
    });
    expect(result).not.toBeNull();
  });

  it('never requires consent for signing in — only new account creation', () => {
    const result = validateAuthForm({ email: 'user@example.com', password: 'password123', mode: 'signin' });
    expect(result).toBeNull();
  });
});

describe('validateMfaCode', () => {
  it('rejects an empty code', () => {
    expect(validateMfaCode('')).not.toBeNull();
  });

  it('rejects a code with letters', () => {
    expect(validateMfaCode('12a456')).not.toBeNull();
  });

  it('rejects a code that is too short', () => {
    expect(validateMfaCode('12345')).not.toBeNull();
  });

  it('rejects a code that is too long', () => {
    expect(validateMfaCode('1234567')).not.toBeNull();
  });

  it('accepts a valid 6-digit code', () => {
    expect(validateMfaCode('123456')).toBeNull();
  });

  it('accepts a code with surrounding whitespace', () => {
    expect(validateMfaCode('  123456  ')).toBeNull();
  });
});
