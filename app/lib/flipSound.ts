"use client";
/**
 * أصوات الكتاب: تقليب الصفحة + قلم التظليل (ملفات في public/sounds).
 * تُحمَّل وتُفكّ مرة واحدة ثم تُشغَّل بزمن استجابة منخفض عبر Web Audio؛
 * وإن فشل التحميل نرجع لصوت مُولَّد بالكود.
 */
let ctx: AudioContext | null = null;
const bufs: Record<string, AudioBuffer | Promise<AudioBuffer | null> | null> = {};

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function load(name: string): Promise<AudioBuffer | null> {
  const c = audio();
  if (!c) return Promise.resolve(null);
  const cur = bufs[name];
  if (cur && !(cur instanceof Promise)) return Promise.resolve(cur);
  if (cur instanceof Promise) return cur;
  const p = fetch(`/sounds/${name}.mp3`)
    .then((r) => r.arrayBuffer())
    .then((a) => c.decodeAudioData(a))
    .then((b) => (bufs[name] = b))
    .catch(() => (bufs[name] = null));
  bufs[name] = p;
  return p;
}

function play(name: string, volume: number, fallback?: () => void) {
  const c = audio();
  if (!c) return;
  const b = bufs[name];
  if (b && !(b instanceof Promise)) {
    const src = c.createBufferSource();
    src.buffer = b;
    const g = c.createGain();
    g.gain.value = volume;
    src.connect(g).connect(c.destination);
    src.start();
    return;
  }
  void load(name).then((buf) => {
    if (!buf) fallback?.();
  });
  if (!(b instanceof Promise)) fallback?.();
}

/** تحميل مسبق (يُستدعى عند فتح الكتاب) */
export function preloadBookSounds() {
  void load("flip");
  void load("hl");
}

export function playHighlight(volume = 0.7) {
  play("hl", volume);
}

export function playFlip(intensity = 1) {
  play("flip", Math.min(1, 0.9 * intensity), () => playSynthFlip(intensity));
}

function playSynthFlip(intensity = 1) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;
    const dur = 0.5;

    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const swish = t < 0.03 ? t / 0.03 : Math.exp(-(t - 0.03) * 7);
      const flutter = 0.65 + 0.35 * Math.sin(t * 2 * Math.PI * (40 + 30 * t));
      const settle = t > 0.3 ? Math.exp(-(t - 0.3) * 30) * 0.6 : 0;
      d[i] = (Math.random() * 2 - 1) * (swish * flutter + settle);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(3800, now);
    band.frequency.exponentialRampToValueAtTime(1400, now + dur);

    const gain = ctx.createGain();
    gain.gain.value = 0.22 * intensity;
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start(now);

    // خبطة الورقة على الصفحة
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(140, now + 0.32);
    thump.frequency.exponentialRampToValueAtTime(60, now + 0.42);
    tg.gain.setValueAtTime(0, now);
    tg.gain.setValueAtTime(0.06 * intensity, now + 0.32);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    thump.connect(tg).connect(ctx.destination);
    thump.start(now + 0.3);
    thump.stop(now + 0.46);
  } catch {
    /* الصوت إضافة — لا نكسر شيئاً لو فشل */
  }
}
