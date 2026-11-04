import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGroqModel, summarizeGroqError } from '../src/config/groq';

describe('Groq configuration and safe error reporting', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the configured model and the deployment-aligned default', () => {
    vi.stubEnv('GROQ_MODEL', '');
    expect(getGroqModel()).toBe('openai/gpt-oss-20b');
    vi.stubEnv('GROQ_MODEL', 'custom/model');
    expect(getGroqModel()).toBe('custom/model');
  });

  it('summarizes API errors without exposing credentials or response headers', () => {
    const apiKey = 'gsk_private_test_value';
    vi.stubEnv('GROQ_API_KEY', apiKey);

    const summary = summarizeGroqError({
      status: 429,
      message: `Request failed with Authorization: Bearer ${apiKey}`,
      headers: { authorization: apiKey, cookie: 'private' },
    });

    expect(summary.status).toBe(429);
    expect(JSON.stringify(summary)).not.toContain(apiKey);
    expect(JSON.stringify(summary)).not.toContain('private');
  });
});
