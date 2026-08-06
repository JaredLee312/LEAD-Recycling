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
      email: 'user@example.com', password: 'Password123!', confirmPassword: 'Different123!', consent: true, mode: 'signup'
    });
    expect(result).not.toBeNull();
  });

  it('accepts matching, strong passwords with consent given', () => {
    const result = validateAuthForm({
      email: 'user@example.com', password: 'Password123!', confirmPassword: 'Password123!', consent: true, mode: 'signup'
    });
    expect(result).toBeNull();
  });

  it('rejects a missing confirmPassword field entirely', () => {
    const result = validateAuthForm({ email: 'user@example.com', password: 'Password123!', consent: true, mode: 'signup' });
    expect(result).not.toBeNull();
  });
});

describe('validateAuthForm — sign up requires a strong password (PDPA: reduce unauthorised access risk)', () => {
  const base = { email: 'user@example.com', consent: true, mode: 'signup' };

  it('rejects a password with no uppercase letter', () => {
    const result = validateAuthForm({ ...base, password: 'password123!', confirmPassword: 'password123!' });
    expect(result).not.toBeNull();
  });

  it('rejects a password with no lowercase letter', () => {
    const result = validateAuthForm({ ...base, password: 'PASSWORD123!', confirmPassword: 'PASSWORD123!' });
    expect(result).not.toBeNull();
  });

  it('rejects a password with no number', () => {
    const result = validateAuthForm({ ...base, password: 'Password!!', confirmPassword: 'Password!!' });
    expect(result).not.toBeNull();
  });

  it('rejects a password with no symbol', () => {
    const result = validateAuthForm({ ...base, password: 'Password123', confirmPassword: 'Password123' });
    expect(result).not.toBeNull();
  });

  it('accepts a password with all four required character classes', () => {
    const result = validateAuthForm({ ...base, password: 'Password123!', confirmPassword: 'Password123!' });
    expect(result).toBeNull();
  });

  it('never enforces complexity when signing in — only new account creation', () => {
    // A weak-by-current-standards password must still be able to sign in,
    // so an account created before this rule existed is never locked out.
    const result = validateAuthForm({ email: 'user@example.com', password: 'password123', mode: 'signin' });
    expect(result).toBeNull();
  });
});

describe('validateAuthForm — sign up requires explicit Privacy Policy consent (PDPA)', () => {
  const strongPassword = 'Password123!';

  it('blocks account creation when the consent checkbox is unchecked', () => {
    const result = validateAuthForm({
      email: 'user@example.com', password: strongPassword, confirmPassword: strongPassword, consent: false, mode: 'signup'
    });
    expect(result).not.toBeNull();
  });

  it('blocks account creation when consent is omitted entirely', () => {
    const result = validateAuthForm({
      email: 'user@example.com', password: strongPassword, confirmPassword: strongPassword, mode: 'signup'
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
