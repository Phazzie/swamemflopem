import { QUESTIONS, GPT_PROMPT, FACTS, FACT_TYPED, JACKPOT_AT, TIMEOUTS } from './questions.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------------- saved state (survives leaving for the ChatGPT app and coming back) ---------------- */
const KEY = 'swam.v1';
const newSid = () => {
  const a = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(a, (b) => (b % 36).toString(36)).join('');
};
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.sid) return s;
  } catch { /* fall through to a fresh start */ }
  return null;
}
const state = Object.assign(
  { sid: newSid(), started: false, answered: {}, timeouts: TIMEOUTS, current: null, gptSent: false, jackpotSeen: false, sound: true, rot: 0, side: 'A' },
  load() || {},
);
// answers saved under an older question list don't count against this one
for (const id of Object.keys(state.answered)) if (!QUESTIONS.some((q) => q.id === id)) delete state.answered[id];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: carry on in memory */ } };

const count = () => Object.keys(state.answered).length;
const remaining = () => QUESTIONS.filter((q) => !state.answered[q.id]);
const byId = (id) => QUESTIONS.find((q) => q.id === id);

/* ---------------- sound: a drum break under the spin, wheel clicks, bells (all synthesized) ---------------- */
let ac; let noise;
function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function env(node, t, peak, len) {
  const g = ac.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  node.connect(g).connect(ac.destination);
}
function tone(t, freq, peak, len, type = 'sine') {
  const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
  env(o, t, peak, len); o.start(t); o.stop(t + len + 0.02);
}
function kick(t) {
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  env(o, t, 0.8, 0.3); o.start(t); o.stop(t + 0.32);
}
function burst(t, type, freq, peak, len) {
  const s = ac.createBufferSource(); s.buffer = noise;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
  s.connect(f); env(f, t, peak, len); s.start(t); s.stop(t + len + 0.02);
}
function snare(t) { burst(t, 'bandpass', 1900, 0.5, 0.17); tone(t, 190, 0.25, 0.09, 'triangle'); }
function bell(t, f, peak = 0.22, len = 0.9) { tone(t, f, peak, len); tone(t, f * 2.76, peak * 0.35, len); }
function playBreak(seconds) {
  if (!state.sound || !audio()) return;
  const step = 60 / 94 / 4; // sixteenth notes at 94 beats a minute
  const t0 = ac.currentTime + 0.03;
  const kicks = [0, 7, 10]; const snares = [4, 12];
  const bass = { 0: 55, 3: 55, 7: 65.4, 10: 49, 14: 55 }; // a low, lazy bassline
  for (let i = 0; i * step < seconds - 0.2; i++) {
    const s = i % 16;
    const t = t0 + i * step + (s % 2 ? 0.03 : 0); // swing
    if (kicks.includes(s) || (i > 16 && s === 15)) kick(t);
    if (snares.includes(s)) snare(t);
    if (s % 2 === 0) burst(t, 'highpass', 7000, s % 4 === 0 ? 0.12 : 0.06, 0.04);
    if (bass[s]) { tone(t, bass[s], 0.42, 0.34); tone(t, bass[s] * 2, 0.08, 0.3, 'triangle'); }
  }
}
function playBells(freqs, gap = 0.12) {
  if (!state.sound || !audio()) return;
  const t0 = ac.currentTime + 0.02;
  freqs.forEach((f, i) => bell(t0 + i * gap, f));
}
let lastClick = 0;
function click() {
  const now = performance.now();
  if (now - lastClick < 38) return;
  lastClick = now;
  if (!state.sound || !ac) return;
  burst(ac.currentTime, 'highpass', 2600, 0.22, 0.018);
  tone(ac.currentTime, 1500, 0.07, 0.02, 'square');
}

/* ---------------- confetti, tap stickers, a little earthquake ---------------- */
const PASTELS = ['#FF8FD2', '#7FEFC2', '#B9A4FF', '#FFAE85', '#84D0FF', '#FFF9F0'];
const FACES = ['Modak', 'Rubik Iso', 'Faster One', 'Climate Crisis', 'Luckiest Guy', 'Rubik Bubbles', 'Chicle', 'Rubik Wet Paint'];
const any = (a) => a[Math.floor(Math.random() * a.length)];
function party(n = 26) {
  if (reduced) return;
  const box = $('party');
  for (let i = 0; i < n; i++) {
    const e = document.createElement('i');
    const kind = i % 4;
    e.textContent = ['7', '●', '★', '✿'][kind];
    e.style.setProperty('--x', `${Math.random() * 100}%`);
    e.style.setProperty('--s', `${1.4 + Math.random() * 2.6}rem`);
    e.style.setProperty('--c', kind === 1 ? '#FF9A4D' : any(PASTELS));
    e.style.setProperty('--ff', `'${any(FACES)}'`);
    e.style.setProperty('--d', `${1.4 + Math.random() * 1.6}s`);
    e.style.setProperty('--w', `${Math.random() * 0.5}s`);
    e.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    e.style.setProperty('--r', `${(Math.random() - 0.5) * 900}deg`);
    box.append(e);
    setTimeout(() => e.remove(), 3800);
  }
}
// every tap anywhere leaves a sticker
if (!reduced) {
  addEventListener('pointerdown', (ev) => {
    const e = document.createElement('b');
    e.textContent = any(['7', '7', '★', '✿', '●']);
    e.style.setProperty('--x', `${ev.clientX}px`);
    e.style.setProperty('--y', `${ev.clientY}px`);
    e.style.setProperty('--c', any(PASTELS));
    e.style.setProperty('--ff', `'${any(FACES)}'`);
    e.style.setProperty('--r', `${(Math.random() - 0.5) * 80}deg`);
    $('party').append(e);
    setTimeout(() => e.remove(), 750);
  }, { passive: true });
}
function bump() {
  if (reduced) return;
  document.body.classList.remove('bump'); void document.body.offsetWidth;
  document.body.classList.add('bump');
  setTimeout(() => document.body.classList.remove('bump'), 430);
}
function boing() {
  if (!state.sound || !audio()) return;
  const t = ac.currentTime; const o = ac.createOscillator();
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(560, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(260, t + 0.34);
  env(o, t, 0.3, 0.4); o.start(t); o.stop(t + 0.42);
}

/* ---------------- the wheel (it has a face, a foam finger and sneakers) ---------------- */
const N = QUESTIONS.length;
const STEP = 360 / N;
const COLORS = ['#FF8FD2', '#7FEFC2', '#B9A4FF', '#FFAE85', '#84D0FF'];
const PATS = ['dots', 'stripes', '', 'checks', 'zig', '', 'stripes', 'dots', 'zig', 'checks'];
const INK = '#1D1235';
const pol = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let platter; let flap; let pupils = [];

function buildWheel() {
  const R0 = 52; const R1 = 192;
  let s = '<defs>'
    + `<pattern id="p-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.7" fill="${INK}"/><circle cx="12" cy="12" r="2.7" fill="${INK}"/></pattern>`
    + `<pattern id="p-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="5" height="14" fill="${INK}"/></pattern>`
    + `<pattern id="p-checks" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="11" height="11" fill="${INK}"/><rect x="11" y="11" width="11" height="11" fill="${INK}"/></pattern>`
    + `<pattern id="p-zig" width="20" height="13" patternUnits="userSpaceOnUse"><path d="M0 10L5 3L10 10L15 3L20 10" fill="none" stroke="${INK}" stroke-width="2.6"/></pattern>`
    + '</defs>';
  // a scalloped burst behind the wheel, turning the other way
  let burst = '';
  for (let i = 0; i < 48; i++) burst += `${i ? 'L' : 'M'}${pol(i % 2 ? 212 : 231, i * 7.5)}`;
  s += `<g><path d="${burst}Z" fill="#FFAE85" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
    + (reduced ? '' : '<animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="46s" repeatCount="indefinite"/>') + '</g>';
  // legs and mismatched sneakers
  const shoe = (fill) => `<path d="M12 -8V14H-36Q-48 14 -46 3Q-44 -4 -31 -5L-8 -9Z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M-30 -1l5 6M-21 -3l5 6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M-44 13H12" stroke="#FFF9F0" stroke-width="4"/>`;
  s += `<g class="leg-l"><path d="M-44 186Q-52 220 -50 246" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><g transform="translate(-52 258)">${shoe('#FF8FD2')}</g></g>`
    + `<g class="leg-r"><path d="M44 186Q52 220 50 246" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><g transform="translate(52 258) scale(-1 1)">${shoe('#7FEFC2')}</g></g>`;
  s += `<circle r="202" fill="${INK}"/>`;
  // the part that spins
  s += '<g id="platter">';
  QUESTIONS.forEach((q, i) => {
    const a0 = i * STEP; const a1 = a0 + STEP; const c = a0 + STEP / 2;
    const d = `M${pol(R0, a0)} L${pol(R1, a0)} A${R1} ${R1} 0 0 1 ${pol(R1, a1)} L${pol(R0, a1)} A${R0} ${R0} 0 0 0 ${pol(R0, a0)}Z`;
    s += `<g class="w" data-q="${q.id}"><path class="seg" fill="${COLORS[i % COLORS.length]}" d="${d}"/>`
      + (PATS[i] ? `<path class="pat" fill="url(#p-${PATS[i]})" opacity=".13" d="${d}"/>` : '')
      + `<text class="lbl" transform="rotate(${c - 90}) translate(64 7)">${esc(q.label)}</text></g>`;
  });
  for (let i = 0; i < N; i++) s += `<circle r="6" fill="#FFF9F0" stroke="${INK}" stroke-width="3" transform="translate(${pol(R1 - 2, i * STEP)})"/>`;
  s += `<circle r="54" fill="#FF9A4D" stroke="${INK}" stroke-width="5"/>`
    + `<path d="M0 -54V54M-54 0H54M-38 -38Q-12 0 -38 38M38 -38Q12 0 38 38" fill="none" stroke="${INK}" stroke-width="3.5"/></g>`;
  // the ball's face stays put while the seams spin under it
  s += `<circle cx="-18" cy="-9" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="18" cy="-9" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/>`
    + `<circle class="pup" cx="-18" cy="-14" r="6" fill="${INK}"/><circle class="pup" cx="18" cy="-14" r="6" fill="${INK}"/>`
    + `<path class="mouth-smile" d="M-17 20Q0 38 17 20" fill="#FF8FD2" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
    + `<ellipse class="mouth-o" cx="0" cy="27" rx="9" ry="12" fill="${INK}"/>`;
  // a foam finger does the pointing
  s += `<g id="flap"><path d="M-28 -258h56a9 9 0 0 1 9 9v22a9 9 0 0 1 -9 9h-18v26a10 10 0 0 1 -20 0v-26h-18a9 9 0 0 1 -9 -9v-22a9 9 0 0 1 9 -9z" fill="#84D0FF" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
    + `<text x="0" y="-226" text-anchor="middle" font-family="Modak, Impact, sans-serif" font-size="30" fill="${INK}">7</text></g>`;
  $('wheel').innerHTML = s;
  platter = $('platter'); flap = $('flap'); pupils = [...document.querySelectorAll('#wheel .pup')];
}
function setRotation(deg) { platter.setAttribute('transform', `rotate(${deg.toFixed(2)})`); }
function eyes(theta) {
  // null looks up at the finger; an angle sends the pupils round in circles
  pupils.forEach((p, i) => {
    const x = (i ? 18 : -18) + (theta == null ? 0 : 7 * Math.cos(theta + i));
    const y = -9 + (theta == null ? -5 : 7 * Math.sin(theta + i));
    p.setAttribute('cx', x.toFixed(1)); p.setAttribute('cy', y.toFixed(1));
  });
}
function paintWheel() {
  document.querySelectorAll('#wheel .w').forEach((g) => {
    g.classList.toggle('answered', !!state.answered[g.dataset.q]);
    g.classList.toggle('current', state.current === g.dataset.q);
  });
}

let spinning = false;
async function spin(exclude) {
  if (spinning) return;
  let pool = remaining();
  if (exclude && pool.length > 1) pool = pool.filter((q) => q.id !== exclude);
  if (!pool.length) return;
  spinning = true;
  state.current = null; paintWheel();
  $('card').hidden = true; $('doneCard').hidden = true;
  $('controls').hidden = false; $('spin').hidden = false; $('spin').disabled = true; $('spinNote').textContent = '';

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const i = QUESTIONS.indexOf(pick);
  const jitter = (Math.random() - 0.5) * (STEP - 12);
  const target = -(i * STEP + STEP / 2) + jitter; // puts that wedge under the flapper at the top
  const from = state.rot;
  const delta = (((target - from) % 360) + 360) % 360;
  const to = from + 360 * 5 + delta;
  const dur = reduced ? 60 : 5200;
  audio(); playBreak(dur / 1000);
  $('wheel').classList.add('spinning');

  await new Promise((done) => {
    const t0 = performance.now();
    let seg = Math.floor(from / STEP);
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const a = from + (to - from) * (1 - (1 - p) ** 4);
      setRotation(a);
      const s = Math.floor(a / STEP);
      if (s !== seg) {
        seg = s; click();
        flap.setAttribute('transform', 'rotate(-20 0 -240)');
        setTimeout(() => flap.setAttribute('transform', ''), 55);
      }
      eyes(a / 14);
      if (p < 1) requestAnimationFrame(frame); else done();
    };
    requestAnimationFrame(frame);
  });

  $('wheel').classList.remove('spinning');
  state.rot = to % 360; state.current = pick.id; save();
  spinning = false;
  eyes(null); boing(); bump();
  paintWheel(); showCard();
}

/* ---------------- the sevens across the top ---------------- */
let shown = -1;
function paintBoard() {
  const c = count();
  if (c === shown) return; // only repaint when the count changes, so the sevens don't all re-pop
  shown = c;
  const total = c >= JACKPOT_AT ? N : JACKPOT_AT;
  let s = '';
  for (let i = 0; i < total; i++) s += `<span class="sv${i < c ? ' on' : ''}">7</span>`;
  $('lamps').innerHTML = s;
  $('lamps').setAttribute('aria-label', c >= JACKPOT_AT ? `${c} of ${N} answered. Seven for seven.` : `${c} of ${JACKPOT_AT} answered`);
}

/* ---------------- recording ---------------- */
const MAX_SECONDS = 12 * 60;
const SLICE = 3 * 1024 * 1024; // each upload stays under the server's 4.5 MB request limit
let take = null; // { blob, mime, seconds, url }
let rec = null; let stream = null; let chunks = []; let t0 = 0; let tick = null; let raf = null; let saving = false;

const setStatus = (el, msg, bad) => { el.textContent = msg || ''; el.classList.toggle('bad', !!bad); };
const fmt = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

async function startRec() {
  const status = $('status');
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus(status, 'This browser can’t record. Type your answer instead.', true);
    $('typedWrap').open = true; return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    setStatus(status, 'The mic is blocked. Allow it in your browser’s site settings, or type your answer.', true);
    $('typedWrap').open = true; return;
  }
  const mime = pickMime();
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
  } catch {
    rec = new MediaRecorder(stream);
  }
  clearTake();
  chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = finishRec;
  rec.start(1000);
  t0 = performance.now();

  $('rec').setAttribute('aria-pressed', 'true');
  $('rec').setAttribute('aria-label', 'Stop recording');
  $('tape').classList.add('rolling');
  $('recLabel').textContent = 'Tape’s rolling. Tap when you’re done';
  $('clock').hidden = false; $('clock').textContent = '0:00';
  $('review').hidden = true; $('nudge').hidden = true;
  $('timeout').disabled = true;
  setStatus(status, '');
  paintLock();

  const q = byId(state.current);
  tick = setInterval(() => {
    const s = (performance.now() - t0) / 1000;
    $('clock').textContent = fmt(s);
    if (s > 12 && q?.nudge && $('nudge').hidden) { $('nudge').textContent = q.nudge; $('nudge').hidden = false; }
    if (s >= MAX_SECONDS) stopRec();
  }, 250);

  // the button breathes with her voice
  const a = audio();
  if (a) {
    const src = a.createMediaStreamSource(stream);
    const an = a.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      $('rec').style.setProperty('--lvl', Math.min(1, Math.sqrt(sum / buf.length) * 5).toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    loop();
  }
}
function stopRec() {
  if (rec && rec.state !== 'inactive') rec.stop();
}
function teardownMic() {
  clearInterval(tick); cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  $('rec').style.setProperty('--lvl', 0);
  $('rec').setAttribute('aria-pressed', 'false');
  $('rec').setAttribute('aria-label', 'Start recording');
  $('tape').classList.remove('rolling');
  $('clock').hidden = true;
}
function finishRec() {
  const seconds = (performance.now() - t0) / 1000;
  const mime = rec.mimeType || chunks[0]?.type || 'audio/webm';
  teardownMic();
  rec = null;
  const blob = new Blob(chunks, { type: mime }); chunks = [];
  if (!blob.size) { setStatus($('status'), 'Nothing recorded. Tap the button and try again.', true); $('recLabel').textContent = 'Tap and talk'; return; }
  take = { blob, mime, seconds, url: URL.createObjectURL(blob) };
  $('playback').src = take.url;
  $('review').hidden = false;
  $('recLabel').textContent = `Got ${fmt(seconds)} on tape. Tap to record over it`;
  const q = byId(state.current);
  if (q?.nudge) { $('nudge').textContent = q.nudge; $('nudge').hidden = false; }
  $('timeout').disabled = !canTimeout();
  paintLock();
}
function clearTake() {
  if (take?.url) URL.revokeObjectURL(take.url);
  take = null;
  $('playback').removeAttribute('src'); $('playback').load();
  $('review').hidden = true;
  $('rescue').hidden = true;
}
const typedText = () => $('typed').value.trim();
function paintLock() {
  const recording = rec && rec.state === 'recording';
  $('lock').disabled = saving || recording || (!take && !typedText());
  $('rec').disabled = saving;
}
const canTimeout = () => state.timeouts > 0 && remaining().length > 1;

/* ---------------- saving ---------------- */
async function post(params, body, type) {
  const url = `/api/upload?${new URLSearchParams(params)}`;
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method: 'POST', body, headers: { 'content-type': type } });
      if (r.ok) return await r.json();
      err = new Error(`HTTP ${r.status}`);
      if (r.status < 500 && r.status !== 408 && r.status !== 429) break;
    } catch (e) { err = e; }
    await sleep(900 * (i + 1));
  }
  throw err;
}

async function lockIn() {
  const q = byId(state.current);
  if (!q || saving) return;
  const text = typedText();
  if (!take && !text) return;
  saving = true; paintLock();
  $('timeout').disabled = true; $('redo').disabled = true;
  const status = $('status');
  const id = String(Date.now());
  const base = { sid: state.sid, q: q.id, take: id };
  try {
    let parts = 0;
    if (take) {
      parts = Math.ceil(take.blob.size / SLICE);
      for (let i = 0; i < parts; i++) {
        setStatus(status, parts > 1 ? `Saving. Piece ${i + 1} of ${parts}` : 'Saving');
        await post({ kind: 'audio', ...base, part: i }, take.blob.slice(i * SLICE, (i + 1) * SLICE), 'application/octet-stream');
      }
    } else setStatus(status, 'Saving');
    const meta = {
      q: q.id, label: q.label, question: q.q, nudge: q.nudge || null,
      take: id, typed: text || null,
      audio: take ? { parts, bytes: take.blob.size, mime: take.mime, seconds: Math.round(take.seconds * 10) / 10 } : null,
      at: new Date().toISOString(), order: count() + 1,
    };
    await post({ kind: 'meta', ...base }, JSON.stringify(meta), 'application/json');

    state.answered[q.id] = { take: id, seconds: take ? Math.round(take.seconds) : 0 };
    state.current = null; save();
    const seconds = take ? take.seconds : 0;
    clearTake(); $('typed').value = ''; $('typedWrap').open = false;
    setStatus(status, '');
    showDone(seconds);
  } catch {
    setStatus(status, 'That didn’t save. Your answer is still here. Check your signal and tap Lock it in again.', true);
    if (take) {
      const a = $('rescue'); a.href = take.url;
      a.download = `sydney-${q.id}.${take.mime.includes('mp4') ? 'm4a' : 'webm'}`; a.hidden = false;
    }
  } finally {
    saving = false; $('redo').disabled = false;
    $('timeout').disabled = !canTimeout();
    paintLock();
  }
}

/* ---------------- cards ---------------- */
function showCard() {
  const q = byId(state.current);
  if (!q) return;
  const c = count();
  $('doneCard').hidden = true;
  $('chamber').textContent = c >= JACKPOT_AT ? `Overtime ${c - JACKPOT_AT + 1}` : `Round ${c + 1} of ${JACKPOT_AT}`;
  $('tapeLabel').textContent = q.label;
  $('question').textContent = q.q;
  $('nudge').hidden = true;
  $('recLabel').textContent = 'Tap and talk';
  setStatus($('status'), '');
  $('timeout').textContent = state.timeouts > 0 ? `Call a timeout (${state.timeouts} left)` : 'No timeouts left';
  $('timeout').disabled = !canTimeout();
  $('card').hidden = false;
  paintLock(); paintControls(); paintBoard();
  $('question').focus({ preventScroll: true });
  if (matchMedia('(max-width: 899px)').matches) $('card').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

function showDone(seconds) {
  const c = count();
  $('card').hidden = true;
  $('doneTitle').textContent = c >= N ? 'All ten. Buzzer.' : `Bucket. ${c} down.`;
  $('fact').textContent = seconds > 0 ? FACTS[(c - 1) % FACTS.length](seconds) : FACT_TYPED;
  $('again').textContent = remaining().length ? 'Spin again' : 'Flip to Side B';
  $('doneCard').hidden = false;
  paintBoard(); paintWheel(); paintControls(); paintTabs(); paintOutro();
  playBells([880, 1108, 1318], 0.09);
  party(c >= JACKPOT_AT ? 14 : 30);
  if (matchMedia('(max-width: 899px)').matches) $('doneCard').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  if (c >= JACKPOT_AT && !state.jackpotSeen) setTimeout(openJackpot, 1300);
  else $('again').focus({ preventScroll: true });
}

function paintControls() {
  const left = remaining().length;
  const busy = !!state.current;
  $('spin').hidden = (busy && !$('card').hidden) || !$('doneCard').hidden;
  $('spin').disabled = spinning;
  if (!left) {
    $('spin').hidden = true;
    $('spinNote').textContent = state.gptSent ? 'Wheel’s empty. All ten answered.' : 'Wheel’s empty. Side B is next.';
  } else if (!busy) {
    const c = count();
    $('spinNote').textContent = c === 0 ? 'Ten questions on the wheel. Seven and you win.'
      : c < JACKPOT_AT ? `${JACKPOT_AT - c} more to seven.`
        : `Overtime. ${left} left on the wheel.`;
  } else $('spinNote').textContent = '';
  $('controls').hidden = $('spin').hidden && !$('spinNote').textContent;
}

/* ---------------- seven for seven ---------------- */
function openJackpot() {
  state.jackpotSeen = true; save();
  const j = $('jackpot');
  j.classList.remove('landed');
  j.hidden = false;
  j.querySelectorAll('.sv').forEach((e) => { e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; });
  [0, 350, 700].forEach((ms, i) => setTimeout(() => { playBells([[784, 988, 1175][i]], 0); bump(); }, reduced ? 0 : ms + 380));
  setTimeout(() => {
    j.classList.add('landed');
    playBells([784, 988, 1175, 1568, 1175, 1568], 0.11); boing();
    party(70); setTimeout(() => party(50), 900);
    $('overtime').hidden = !remaining().length;
    (remaining().length ? $('overtime') : $('toB')).focus();
  }, reduced ? 0 : 1500);
}
function closeJackpot() { $('jackpot').hidden = true; }

/* ---------------- Side B ---------------- */
async function copyPrompt() {
  try { await navigator.clipboard.writeText(GPT_PROMPT); } catch {
    const r = document.createRange(); r.selectNodeContents($('prompt'));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    try { document.execCommand('copy'); } catch { /* she can still copy by hand; the text is selected */ }
  }
  $('copy').textContent = 'Copied. Go paste it into your ChatGPT';
  setTimeout(() => { $('copy').textContent = 'Copy the prompt'; }, 5000);
}
async function sendGpt() {
  const text = $('gpt').value.trim();
  if (!text) return;
  $('sendGpt').disabled = true;
  setStatus($('gptStatus'), 'Sending');
  try {
    await post({ kind: 'gpt', sid: state.sid }, text, 'text/plain; charset=utf-8');
    state.gptSent = true; save();
    localStorage.removeItem(`${KEY}.gpt`);
    setStatus($('gptStatus'), count() >= JACKPOT_AT ? 'Sent to T. Side B is done.' : 'Sent to T. Side A still has questions waiting.');
    $('sendGpt').textContent = 'Sent to T';
    paintTabs(); paintOutro(); paintControls();
    playBells([880, 1108, 1318], 0.1); party(36);
  } catch {
    setStatus($('gptStatus'), 'That didn’t send. Your text is still in the box. Check your signal and try again.', true);
    $('sendGpt').disabled = false;
  }
}

/* ---------------- views ---------------- */
function show(side) {
  state.side = side; save();
  $('cover').hidden = true; $('bar').hidden = false;
  $('sideA').hidden = side !== 'A'; $('sideB').hidden = side !== 'B';
  $('tabA').setAttribute('aria-selected', side === 'A'); $('tabB').setAttribute('aria-selected', side === 'B');
  scrollTo(0, 0);
}
function paintTabs() {
  $('tabA').classList.toggle('done', count() >= JACKPOT_AT);
  $('tabB').classList.toggle('done', state.gptSent);
}
function paintOutro() {
  const done = count() >= JACKPOT_AT && state.gptSent;
  $('outro').hidden = !done;
  if (!done) return;
  const secs = Object.values(state.answered).reduce((a, x) => a + (x.seconds || 0), 0);
  const cell = (v, cap) => `<div class="stat"><b>${v}</b><span>${cap}</span></div>`;
  $('boxScore').innerHTML = cell(count(), 'answers')
    + cell(fmt(secs), 'on the mic')
    + cell(Math.round(secs * 18.5).toLocaleString('en-US'), 'miles around the Sun');
}
function paintSound() {
  $('sound').textContent = state.sound ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', String(state.sound));
}

/* ---------------- wiring ---------------- */
buildWheel();
setRotation(state.rot);
$('prompt').textContent = GPT_PROMPT;
$('gpt').value = localStorage.getItem(`${KEY}.gpt`) || '';
$('sendGpt').disabled = !$('gpt').value.trim();
if (state.gptSent) $('sendGpt').textContent = 'Send a new version to T';
paintBoard(); paintWheel(); paintTabs(); paintOutro(); paintSound();

if (state.started) {
  show(state.side === 'B' ? 'B' : 'A');
  if (state.current && byId(state.current) && !state.answered[state.current]) showCard();
  else { state.current = null; paintControls(); }
}

$('start').addEventListener('click', () => {
  state.started = true; save();
  audio(); playBells([523, 659, 784, 1046], 0.08); party(24);
  show('A'); paintControls();
  post({ kind: 'session', sid: state.sid }, JSON.stringify({ started: new Date().toISOString(), ua: navigator.userAgent }), 'application/json').catch(() => {});
});
$('tabA').addEventListener('click', () => show('A'));
$('tabB').addEventListener('click', () => show('B'));
$('sound').addEventListener('click', () => { state.sound = !state.sound; save(); paintSound(); });

$('spin').addEventListener('click', () => spin());
$('again').addEventListener('click', () => { if (remaining().length) { $('doneCard').hidden = true; spin(); } else show('B'); });
$('rec').addEventListener('click', () => { if (rec && rec.state === 'recording') stopRec(); else startRec(); });
$('redo').addEventListener('click', () => { clearTake(); $('recLabel').textContent = 'Tap and talk'; paintLock(); startRec(); });
$('typed').addEventListener('input', paintLock);
$('lock').addEventListener('click', lockIn);
$('timeout').addEventListener('click', () => {
  if (!canTimeout()) return;
  state.timeouts -= 1; save();
  const skipped = state.current;
  clearTake(); $('typed').value = '';
  spin(skipped);
});

$('copy').addEventListener('click', copyPrompt);
$('gpt').addEventListener('input', () => {
  $('sendGpt').disabled = !$('gpt').value.trim();
  try { localStorage.setItem(`${KEY}.gpt`, $('gpt').value); } catch { /* fine */ }
});
$('sendGpt').addEventListener('click', sendGpt);
$('overtime').addEventListener('click', () => { closeJackpot(); $('doneCard').hidden = true; spin(); });
$('toB').addEventListener('click', () => { closeJackpot(); show('B'); });

addEventListener('beforeunload', (e) => { if (take || (rec && rec.state === 'recording')) { e.preventDefault(); e.returnValue = ''; } });
