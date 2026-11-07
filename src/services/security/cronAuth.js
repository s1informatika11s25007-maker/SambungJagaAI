import { timingSafeEqual } from 'node:crypto';

/**
 * Authorize a scheduled server request with a dedicated secret.
 * Never trust caller-controlled Vercel-looking headers or the Supabase service key.
 */
export function authorizeCronRequest(req, res) {
  const secret = process.env.CRON_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || secret.length < 32 || secret === serviceRoleKey) {
    res.status(503).json({
      success: false,
      error: 'Cron belum dikonfigurasi. Set CRON_SECRET acak minimal 32 karakter dan berbeda dari service-role key.'
    });
    return false;
  }

  const supplied = req?.headers?.authorization || '';
  const expectedBuffer = Buffer.from(`Bearer ${secret}`, 'utf8');
  const suppliedBuffer = Buffer.from(supplied, 'utf8');
  const valid = suppliedBuffer.length === expectedBuffer.length
    && timingSafeEqual(suppliedBuffer, expectedBuffer);

  if (!valid) {
    res.status(401).json({ success: false, error: 'Unauthorized: Bearer CRON_SECRET tidak valid.' });
    return false;
  }

  return true;
}
