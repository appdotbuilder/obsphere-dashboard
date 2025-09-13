import { describe, expect, it } from 'bun:test';
import { type AuthInput } from '../schema';
import { authenticate } from '../handlers/auth';

describe('authenticate', () => {
  it('should authenticate with valid credentials', async () => {
    const validInput: AuthInput = {
      username: 'kedar',
      password: '1'
    };

    const result = await authenticate(validInput);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Authentication successful');
  });

  it('should reject invalid username', async () => {
    const invalidInput: AuthInput = {
      username: 'wronguser',
      password: '1'
    };

    const result = await authenticate(invalidInput);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });

  it('should reject invalid password', async () => {
    const invalidInput: AuthInput = {
      username: 'kedar',
      password: 'wrongpassword'
    };

    const result = await authenticate(invalidInput);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });

  it('should reject both invalid username and password', async () => {
    const invalidInput: AuthInput = {
      username: 'wronguser',
      password: 'wrongpassword'
    };

    const result = await authenticate(invalidInput);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });

  it('should be case sensitive for username', async () => {
    const caseInput: AuthInput = {
      username: 'KEDAR',
      password: '1'
    };

    const result = await authenticate(caseInput);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });

  it('should handle empty username', async () => {
    const emptyUsernameInput: AuthInput = {
      username: '',
      password: '1'
    };

    const result = await authenticate(emptyUsernameInput);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });

  it('should handle empty password', async () => {
    const emptyPasswordInput: AuthInput = {
      username: 'kedar',
      password: ''
    };

    const result = await authenticate(emptyPasswordInput);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });

  it('should handle whitespace in credentials', async () => {
    const whitespaceInput: AuthInput = {
      username: ' kedar ',
      password: ' 1 '
    };

    const result = await authenticate(whitespaceInput);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });
});