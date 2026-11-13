import {
  QUESTIONS, GPT_PROMPT, FACTS, FACT_TYPED, WU_FIRST, WU_LAST, JACKPOT_AT, TIMEOUTS,
} from './questions.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  { sid: newSid(), started: false, answered: {}, timeouts: TIMEOUTS, current: null, gptSent: false, jackpotSeen: false, sound: true, wu: 0, rot: 0, side: 'A' },
  load() || {},
);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: carry on in memory */ } };

const count = () => Object.keys(state.answered).length;
const remaining = () => QUESTIONS.filter((q) => !state.answered[q.id]);
const byId = (id) => QUESTIONS.find((q) => q.id === id);

/* ---------------- sound: a drum break for the spin, bells for the jackpot (all synthesized) ---------------- */
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
function snare(t) {
  burst(t, 'bandpass', 1900, 0.5, 0.17);
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
  env(o, t, 0.25, 0.09); o.start(t); o.stop(t + 0.1);
}
function bell(t, f, peak = 0.22, len = 0.9) {
  for (const [mult, p] of [[1, peak], [2.76, peak * 0.35]]) {
    const o = ac.createOscillator(); o.frequency.value = f * mult;
    env(o, t, p, len); o.start(t); o.stop(t + len + 0.02);
  }
}
function playBreak(seconds) {
  if (!state.sound || !audio()) return;
  const step = 60 / 96 / 4; // sixteenth notes at 96 beats a minute
  const t0 = ac.currentTime + 0.03;
  const kicks = [0, 7, 10]; const snares = [4, 12];
  for (let i = 0; i * step < seconds - 0.2; i++) {
    const s = i % 16;
    const t = t0 + i * step + (s % 2 ? 0.028 : 0); // a little swing
    if (kicks.includes(s) || (i > 16 && s === 15)) kick(t);
    if (snares.includes(s)) snare(t);
    if (s % 2 === 0) burst(t, 'highpass', 7000, s % 4 === 0 ? 0.13 : 0.07, 0.04);
  }
}
function playBells(freqs, gap = 0.12) {
  if (!state.sound || !audio()) return;
  const t0 = ac.currentTime + 0.02;
  freqs.forEach((f, i) => bell(t0 + i * gap, f));
}

/* ---------------- the record ---------------- */
const N = QUESTIONS.length;
const STEP = 360 / N;
const POINTER = 45; // where the needle sits, in degrees clockwise from the top
const pol = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildPlatter() {
  const R0 = 66; const R1 = 190;
  let s = '<circle r="198" fill="#000"/><circle r="194" fill="none" stroke="#FFD100" stroke-width="2"/>';
  QUESTIONS.forEach((q, i) => {
    const a0 = i * STEP; const a1 = a0 + STEP; const c = a0 + STEP / 2;
    s += `<g class="w" data-q="${q.id}">`
      + `<path class="wedge${i % 2 ? ' alt' : ''}" d="M${pol(R0, a0)} L${pol(R1, a0)} A${R1} ${R1} 0 0 1 ${pol(R1, a1)} L${pol(R0, a1)} A${R0} ${R0} 0 0 0 ${pol(R0, a0)}Z"/>`
      + `<text class="lbl" transform="rotate(${c - 90}) translate(80 6)">${esc(q.label)}</text></g>`;
  });
  for (const r of [104, 128, 152, 176]) s += `<circle r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="1"/>`;
  // the label in the middle of the record is a basketball
  s += '<circle r="62" fill="#F26B1D" stroke="#000" stroke-width="5"/>'
    + '<path d="M0 -62V62M-62 0H62M-44 -44Q-14 0 -44 44M44 -44Q14 0 44 44" fill="none" stroke="#000" stroke-width="3.5"/>'
    + '<text class="num" x="0" y="31" text-anchor="middle">7</text>';
  $('platter').innerHTML = s;
}
function setRotation(deg, instant) {
  const p = $('platter');
  if (instant) { p.style.transition = 'none'; p.style.transform = `rotate(${deg}deg)`; void p.getBoundingClientRect(); p.style.transition = ''; } else p.style.transform = `rotate(${deg}deg)`;
  state.rot = deg;
}
function paintPlatter() {
  document.querySelectorAll('#platter .w').forEach((g) => {
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
  state.current = null; paintPlatter();
  $('card').hidden = true; $('doneCard').hidden = true;
  $('spin').disabled = true; $('spinNote').textContent = '';

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const i = QUESTIONS.indexOf(pick);
  const jitter = (Math.random() - 0.5) * (STEP - 12);
  const target = POINTER - (i * STEP + STEP / 2) + jitter;
  const delta = (((target - state.rot) % 360) + 360) % 360;
  const dur = reduced ? 0.05 : 4.8;
  playBreak(dur);
  setRotation(state.rot + 360 * 4 + delta);
  await sleep(dur * 1000 + 120);

  state.current = pick.id; save();
  spinning = false;
  playBells([660], 0);
  paintPlatter(); showCard();
}

/* ---------------- lamps ---------------- */
function paintLamps() {
  const c = count();
  let s = '';
  for (let i = 0; i < JACKPOT_AT; i++) s += `<span class="lamp${i < c ? ' on' : ''}">7</span>`;
  if (c >= JACKPOT_AT) for (let i = JACKPOT_AT; i < N; i++) s += `<span class="lamp ot${i < c ? ' on' : ''}">7</span>`;
  $('lamps').innerHTML = s;
  $('lamps').setAttribute('aria-label', c >= JACKPOT_AT ? `${c} of ${N} answered. Jackpot hit.` : `${c} of ${JACKPOT_AT} answered`);
}

/* ---------------- recording ---------------- */
const MAX_SECONDS = 12 * 60;
const SLICE = 3 * 1024 * 1024; // each upload stays under the server's 4.5 MB request limit
let take = null; // { blob, mime, seconds, url }
let rec = null; let stream = null; let chunks = []; let t0 = 0; let tick = null; let raf = null; let saving = false;

const setStatus = (el, msg, bad) => { el.textContent = msg || ''; el.classList.toggle('bad', !!bad); };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
  $('recLabel').textContent = 'Recording. Tap when you’re done';
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
  $('clock').hidden = true;
}
function finishRec() {
  const seconds = (performance.now() - t0) / 1000;
  const mime = rec.mimeType || chunks[0]?.type || 'audio/webm';
  teardownMic();
  rec = null;
  const blob = new Blob(chunks, { type: mime }); chunks = [];
  if (!blob.size) { setStatus($('status'), 'Nothing recorded. Tap the mic and try again.', true); $('recLabel').textContent = 'Tap and talk'; return; }
  take = { blob, mime, seconds, url: URL.createObjectURL(blob) };
  $('playback').src = take.url;
  $('review').hidden = false;
  $('recLabel').textContent = `Got ${fmt(seconds)}. Tap to record over it`;
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
  $('doneCard').hidden = true;
  $('chamber').textContent = `Chamber ${count() + 1}: ${q.label}`;
  $('setup').hidden = !q.setup; $('setup').textContent = q.setup || '';
  $('question').textContent = q.q;
  $('nudge').hidden = true;
  $('recLabel').textContent = 'Tap and talk';
  $('rec').setAttribute('aria-label', 'Start recording');
  setStatus($('status'), '');
  $('timeout').textContent = state.timeouts > 0 ? `Call a timeout (${state.timeouts} left)` : 'No timeouts left';
  $('timeout').disabled = !canTimeout();
  $('card').hidden = false;
  paintLock(); paintControls();
  $('question').focus({ preventScroll: true });
  if (matchMedia('(max-width: 899px)').matches) $('card').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

function showDone(seconds) {
  const c = count();
  $('card').hidden = true;
  $('doneTitle').textContent = c >= N ? 'Locked in. That’s all ten.' : `Locked in. ${c} down.`;
  $('fact').textContent = seconds > 0 ? FACTS[(c - 1) % FACTS.length](seconds) : FACT_TYPED;
  $('again').textContent = remaining().length ? 'Spin again' : 'Flip to Side B';
  $('doneCard').hidden = false;
  paintLamps(); paintPlatter(); paintControls(); paintTabs(); paintOutro();
  playBells([880, 1108], 0.1);
  if (matchMedia('(max-width: 899px)').matches) $('doneCard').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  if (c >= JACKPOT_AT && !state.jackpotSeen) setTimeout(openJackpot, 1100);
  else $('again').focus({ preventScroll: true });
}

function paintControls() {
  const left = remaining().length;
  const busy = !!state.current;
  $('spin').hidden = (busy && !$('card').hidden) || !$('doneCard').hidden;
  $('spin').disabled = spinning;
  if (!left) {
    $('spin').hidden = true;
    $('spinNote').textContent = state.gptSent ? 'The record’s clean. All ten answered.' : 'The record’s clean. Side B is next.';
  } else if (!busy) {
    const c = count();
    $('spinNote').textContent = c === 0 ? 'Ten questions on the record. Seven hits the jackpot.'
      : c < JACKPOT_AT ? `${JACKPOT_AT - c} more to the jackpot.`
        : `Overtime. ${left} left on the record.`;
  } else $('spinNote').textContent = '';
  $('controls').hidden = $('spin').hidden && !$('spinNote').textContent;
}

/* ---------------- jackpot ---------------- */
function openJackpot() {
  state.jackpotSeen = true; save();
  const j = $('jackpot');
  const symbols = ['★', '♪', '◆', '★', '♪', '◆', '★', '7'];
  j.classList.remove('landed');
  const strips = j.querySelectorAll('.strip');
  strips.forEach((s) => {
    s.style.transition = 'none'; s.style.transform = 'translateY(0)';
    s.innerHTML = symbols.map((x) => `<span class="${x === '7' ? 'seven' : ''}">${x}</span>`).join('');
  });
  j.hidden = false;
  void j.getBoundingClientRect();
  const end = `translateY(-${((symbols.length - 1) / symbols.length) * 100}%)`;
  const base = reduced ? 0 : 1600;
  strips.forEach((s, i) => {
    s.style.transition = ''; s.style.transitionDelay = `${reduced ? 0 : i * 0.4}s`; s.style.transform = end;
    setTimeout(() => playBells([[784, 988, 1175][i]], 0), base + i * 400);
  });
  setTimeout(() => {
    j.classList.add('landed');
    playBells([784, 988, 1175, 1568, 1175, 1568], 0.11);
    $('overtime').hidden = !remaining().length;
    (remaining().length ? $('overtime') : $('toB')).focus();
  }, base + 3 * 400 + 250);
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
    setStatus($('gptStatus'), count() >= JACKPOT_AT ? 'Sent to T. That’s Side B done.' : 'Sent to T. Side A still has questions waiting.');
    $('sendGpt').textContent = 'Sent to T';
    paintTabs(); paintOutro(); paintControls();
    playBells([880, 1108, 1318], 0.1);
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
function wuName() {
  let h = state.wu * 7919;
  for (const ch of state.sid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${WU_FIRST[h % WU_FIRST.length]} ${WU_LAST[(h >>> 8) % WU_LAST.length]}`;
}
function paintOutro() {
  const done = count() >= JACKPOT_AT && state.gptSent;
  $('outro').hidden = !done;
  if (done) $('wuName').textContent = wuName();
}
function paintSound() {
  $('sound').textContent = state.sound ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', String(state.sound));
}

/* ---------------- wiring ---------------- */
buildPlatter();
setRotation(state.rot % 360, true);
$('prompt').textContent = GPT_PROMPT;
$('gpt').value = localStorage.getItem(`${KEY}.gpt`) || '';
$('sendGpt').disabled = !$('gpt').value.trim();
if (state.gptSent) $('sendGpt').textContent = 'Send a new version to T';
paintLamps(); paintPlatter(); paintTabs(); paintOutro(); paintSound();

if (state.started) {
  show(state.side === 'B' ? 'B' : 'A');
  if (state.current && byId(state.current) && !state.answered[state.current]) showCard();
  else { state.current = null; paintControls(); }
}

$('start').addEventListener('click', () => {
  state.started = true; save();
  audio();
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
$('reroll').addEventListener('click', () => { state.wu += 1; save(); paintOutro(); });

addEventListener('beforeunload', (e) => { if (take || (rec && rec.state === 'recording')) { e.preventDefault(); e.returnValue = ''; } });
