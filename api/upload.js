// Saves one piece of an answer to private storage.
//   kind=audio   one slice of a recording (slices stay under the 4.5 MB request limit)
//   kind=meta    the answer's record, written last: typed text, length, slice count
//   kind=gpt     what her ChatGPT said
//   kind=session who started and when
import { put } from '@vercel/blob';
import { ACCESS, ROOT, json, okId, RE_SID, RE_Q, RE_TAKE } from './_lib.js';

const MAX_AUDIO = 4.3 * 1024 * 1024;
const MAX_TEXT = 300 * 1024;
const MAX_PARTS = 200;

export async function POST(request) {
  const p = new URL(request.url).searchParams;
  const kind = p.get('kind');
  const sid = p.get('sid');
  if (!okId(sid, RE_SID)) return json({ error: 'bad session' }, 400);

  const body = new Uint8Array(await request.arrayBuffer());
  if (!body.length) return json({ error: 'empty' }, 400);

  let pathname;
  let contentType = 'application/octet-stream';

  if (kind === 'audio') {
    const q = p.get('q');
    const take = p.get('take');
    const part = Number(p.get('part'));
    if (!okId(q, RE_Q) || !okId(take, RE_TAKE)) return json({ error: 'bad answer id' }, 400);
    if (!Number.isInteger(part) || part < 0 || part >= MAX_PARTS) return json({ error: 'bad part' }, 400);
    if (body.length > MAX_AUDIO) return json({ error: 'slice too big' }, 413);
    pathname = `${ROOT}${sid}/${q}/take-${take}/part-${String(part).padStart(3, '0')}.bin`;
  } else if (kind === 'meta') {
    const q = p.get('q');
    const take = p.get('take');
    if (!okId(q, RE_Q) || !okId(take, RE_TAKE)) return json({ error: 'bad answer id' }, 400);
    if (body.length > MAX_TEXT) return json({ error: 'too long' }, 413);
    pathname = `${ROOT}${sid}/${q}/take-${take}/meta.json`;
    contentType = 'application/json';
  } else if (kind === 'gpt') {
    if (body.length > MAX_TEXT) return json({ error: 'too long' }, 413);
    pathname = `${ROOT}${sid}/chatgpt/${Date.now()}.txt`;
    contentType = 'text/plain; charset=utf-8';
  } else if (kind === 'session') {
    if (body.length > 4096) return json({ error: 'too long' }, 413);
    pathname = `${ROOT}${sid}/session.json`;
    contentType = 'application/json';
  } else {
    return json({ error: 'bad kind' }, 400);
  }

  try {
    const blob = await put(pathname, Buffer.from(body), {
      access: ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return json({ ok: true, pathname: blob.pathname, bytes: body.length });
  } catch (err) {
    console.error('save failed', pathname, err);
    return json({ error: 'storage', detail: String(err?.message || err).slice(0, 300) }, 500);
  }
}
