// Shared helpers for the storage functions. Files that start with "_" are not routes.
import { timingSafeEqual } from 'node:crypto';

export const ACCESS = 'private';
export const ROOT = 'sessions/';

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export const okId = (v, re) => typeof v === 'string' && re.test(v);
export const RE_SID = /^[a-z0-9]{8,32}$/;
export const RE_Q = /^[a-z0-9-]{1,24}$/;
export const RE_TAKE = /^\d{10,16}$/;

// The results page and the read functions need the passcode set in ADMIN_KEY.
export function isAdmin(request) {
  const want = process.env.ADMIN_KEY || '';
  if (!want) return false;
  const url = new URL(request.url);
  const got = request.headers.get('x-key') || url.searchParams.get('key') || '';
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
