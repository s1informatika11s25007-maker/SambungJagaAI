import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeCronRequest } from '../../src/services/security/cronAuth';

describe('Cron endpoint authentication', () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  function response() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
  }

  it('rejects a spoofed Vercel header when no Bearer secret is supplied', () => {
    process.env.CRON_SECRET = 'x'.repeat(40);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    const res = response();
    const allowed = authorizeCronRequest({ headers: { 'x-vercel-cron': '1' } }, res);
    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a missing or reused service-role secret configuration', () => {
    process.env.CRON_SECRET = 'service-role-secret-which-is-long-enough';
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.CRON_SECRET;
    const res = response();
    expect(authorizeCronRequest({ headers: {} }, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('accepts only the configured dedicated Bearer secret', () => {
    process.env.CRON_SECRET = 'dedicated-cron-secret-at-least-32-characters';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'different-service-role-secret';
    const res = response();
    expect(authorizeCronRequest({ headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});
