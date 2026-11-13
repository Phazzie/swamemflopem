// Reads saved files back. Passcode required.
//   ?pathname=sessions/...            one file
//   ?sid=..&q=..&take=..              a whole recording, its slices joined in order
import { get, list } from '@vercel/blob';
import { ACCESS, ROOT, json, isAdmin, okId, RE_SID, RE_Q, RE_TAKE } from './_lib.js';

export async function GET(request) {
  if (!isAdmin(request)) return json({ error: 'passcode' }, 401);
  const p = new URL(request.url).searchParams;

  try {
    const pathname = p.get('pathname');
    if (pathname) {
      if (!pathname.startsWith(ROOT) || pathname.includes('..')) return json({ error: 'bad path' }, 400);
      const r = await get(pathname, { access: ACCESS, useCache: false });
      if (!r || r.statusCode !== 200) return json({ error: 'not found' }, 404);
      return new Response(r.stream, {
        headers: {
          'content-type': r.blob.contentType || 'application/octet-stream',
          'x-content-type-options': 'nosniff',
          'cache-control': 'private, no-store',
        },
      });
    }

    const sid = p.get('sid');
    const q = p.get('q');
    const take = p.get('take');
    if (!okId(sid, RE_SID) || !okId(q, RE_Q) || !okId(take, RE_TAKE)) return json({ error: 'bad answer id' }, 400);

    const prefix = `${ROOT}${sid}/${q}/take-${take}/part-`;
    const page = await list({ prefix, limit: 1000 });
    const parts = page.blobs.map((b) => b.pathname).sort();
    if (!parts.length) return json({ error: 'not found' }, 404);

    const mime = p.get('mime') || 'audio/webm';
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const part of parts) {
            const r = await get(part, { access: ACCESS, useCache: false });
            if (!r || r.statusCode !== 200) throw new Error(`missing ${part}`);
            const reader = r.stream.getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': /^audio\/[a-z0-9.+-]+/i.test(mime) ? mime.split(';')[0] : 'audio/webm',
        'content-disposition': `inline; filename="${sid}_${q}_${take}.${ext}"`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('read failed', err);
    return json({ error: 'storage', detail: String(err?.message || err).slice(0, 300) }, 500);
  }
}
