// Lists everything that has been saved. Passcode required.
import { list } from '@vercel/blob';
import { ROOT, json, isAdmin } from './_lib.js';

export async function GET(request) {
  if (!isAdmin(request)) return json({ error: 'passcode' }, 401);
  const files = [];
  let cursor;
  try {
    do {
      const page = await list({ prefix: ROOT, cursor, limit: 1000 });
      for (const b of page.blobs) {
        files.push({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error('list failed', err);
    return json({ error: 'storage', detail: String(err?.message || err).slice(0, 300) }, 500);
  }
  return json({ files });
}
