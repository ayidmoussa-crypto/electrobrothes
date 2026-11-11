"use client";

import { Expand, Gift, LoaderCircle, Minimize, Radio, Shuffle, Trophy, Users, Volume2, VolumeX, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { drawWinner } from "@/app/actions/admin-giveaways";
import { Logo } from "@/components/brand/Logo";
import { tr as makeTr, type AdminLang } from "@/lib/admin-tr";

export type LiveWinner = { name: string; phone: string; rank: number };

type Props = {
  id: string;
  lang: AdminLang;
  title: string;
  prize: string;
  worth: string | null;
  image: string | null;
  drawAt: string;
  drawLabel: string;
  entries: number;
  recentNames: string[];
  winners: LiveWinner[];
};

type Stage = { kind: "idle" } | { kind: "spinning"; name: string } | { kind: "won"; winner: LiveWinner };

const SPIN_MS = 6500;

/** Brand colours read from the design tokens, so the confetti never hard-codes a colour. */
function tokenColors() {
  const css = getComputedStyle(document.documentElement);
  return ["--color-yellow-500", "--color-yellow-300", "--color-white", "--color-yellow-600"].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
}

function burst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const colors = tokenColors();
  const w = canvas.width;
  const h = canvas.height;
  const bits = Array.from({ length: 220 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
    const speed = (14 + Math.random() * 16) * dpr;
    return {
      x: fromLeft ? 0 : w,
      y: h * 0.75,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: (6 + Math.random() * 8) * dpr,
      spin: Math.random() * Math.PI,
      vs: (Math.random() - 0.5) * 0.4,
      color: colors[i % colors.length],
    };
  });
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    for (const b of bits) {
      b.vy += 0.45 * dpr;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.spin += b.vs;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 4200);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
      ctx.restore();
    }
    if (t < 4200) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w, h);
  };
  requestAnimationFrame(frame);
}

/** Short beeps from the browser itself: a tick per name, a chord for the winner. No sound files. */
function useSound(on: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback(
    (kind: "tick" | "win") => {
      if (!on) return;
      try {
        ctx.current ??= new AudioContext();
        const a = ctx.current;
        const notes = kind === "tick" ? [880] : [523, 659, 784, 1046];
        notes.forEach((f, i) => {
          const o = a.createOscillator();
          const g = a.createGain();
          const at = a.currentTime + (kind === "win" ? i * 0.09 : 0);
          o.type = kind === "tick" ? "square" : "triangle";
          o.frequency.value = f;
          g.gain.setValueAtTime(kind === "tick" ? 0.04 : 0.12, at);
          g.gain.exponentialRampToValueAtTime(0.0001, at + (kind === "tick" ? 0.05 : 0.6));
          o.connect(g).connect(a.destination);
          o.start(at);
          o.stop(at + 0.7);
        });
      } catch {}
    },
    [on],
  );
}

/**
 * Full-screen stage for the Instagram / TikTok live: the prize, the number of entries, then a name reel that
 * slows down and lands on the winner drawn by the server. Space or Enter draws; the phone shows masked.
 */
export function LiveDraw(p: Props) {
  const tr = makeTr(p.lang);
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(p.winners.length ? { kind: "won", winner: p.winners.at(-1)! } : { kind: "idle" });
  const [winners, setWinners] = useState(p.winners);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [sound, setSound] = useState(true);
  const [full, setFull] = useState(false);
  const [pending, start] = useTransition();
  const canvas = useRef<HTMLCanvasElement>(null);
  const play = useSound(sound);
  const busy = stage.kind === "spinning" || pending;

  // Keeps the entry count current while nobody is drawing.
  useEffect(() => {
    if (winners.length || stage.kind !== "idle") return;
    const r = setInterval(() => !document.hidden && router.refresh(), 8000);
    return () => clearInterval(r);
  }, [router, stage.kind, winners.length]);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const spin = useCallback(
    (reel: string[], winner: LiveWinner) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const land = () => {
        setStage({ kind: "won", winner });
        setWinners((w) => [...w, winner]);
        play("win");
        if (canvas.current && !reduced) burst(canvas.current);
      };
      if (reduced || reel.length < 2) return land();
      // Each step waits a little longer than the last (ease-out), so the reel visibly slows into the winner.
      const n = reel.length;
      const weights = reel.map((_, i) => Math.pow(i / (n - 1), 2.6) + 0.04);
      const total = weights.reduce((s, x) => s + x, 0);
      let at = 0;
      reel.forEach((name, i) => {
        at += (weights[i] / total) * SPIN_MS;
        const last = i === n - 1;
        setTimeout(() => {
          if (last) return land();
          setStage({ kind: "spinning", name });
          play("tick");
        }, at);
      });
    },
    [play],
  );

  const draw = useCallback(() => {
    if (busy) return;
    // Before the announced time the first draw asks for a second press: it closes entries early.
    const early = !winners.length && Date.now() < new Date(p.drawAt).getTime();
    if (early && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setError(null);
    setStage({ kind: "spinning", name: p.recentNames[0] ?? "…" });
    start(async () => {
      const r = await drawWinner(p.id);
      if (!r.ok) {
        setError(r.message);
        setStage(winners.length ? { kind: "won", winner: winners.at(-1)! } : { kind: "idle" });
        return;
      }
      spin(r.reel, r.winner);
    });
  }, [armed, busy, p.drawAt, p.id, p.recentNames, spin, winners]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        draw();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draw]);

  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  const winner = stage.kind === "won" ? stage.winner : null;
  const ctrl = "grid size-11 cursor-pointer place-items-center rounded-full text-warm-300 transition-colors hover:bg-white/10 hover:text-white";

  return (
    <div dir={p.lang === "ar" ? "rtl" : "ltr"} lang={p.lang} className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-linear-to-b from-deep to-ink text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-yellow-500/10 blur-3xl" />
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 size-full" />

      <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto text-white" />
          <span className="text-lg font-extrabold" dir="ltr">
            ElectroBrothers
          </span>
          <span className="ms-2 inline-flex items-center gap-2 rounded-full bg-yellow-500 px-3 py-1 text-xs font-extrabold text-ink">
            <span aria-hidden="true" className="gw-pulse size-2 rounded-full bg-ink" />
            {tr("سحب مباشر", "Live draw")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSound((s) => !s)} aria-pressed={sound} aria-label={tr("الصوت", "Sound")} title={tr("الصوت", "Sound")} className={ctrl}>
            {sound ? <Volume2 className="size-5" aria-hidden="true" /> : <VolumeX className="size-5" aria-hidden="true" />}
          </button>
          <button type="button" onClick={toggleFull} aria-label={tr("ملء الشاشة", "Full screen")} title={tr("ملء الشاشة", "Full screen")} className={ctrl}>
            {full ? <Minimize className="size-5" aria-hidden="true" /> : <Expand className="size-5" aria-hidden="true" />}
          </button>
          <Link href={`/admin/giveaways/${p.id}`} aria-label={tr("رجوع للوحة", "Back to the dashboard")} title={tr("رجوع للوحة", "Back to the dashboard")} className={ctrl}>
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 pb-10 md:grid-cols-[2fr_3fr] md:px-8">
        {/* The prize */}
        <section className="flex flex-col items-center text-center">
          <div className="relative grid aspect-square w-full max-w-sm place-items-center">
            <div aria-hidden="true" className="gw-rays" />
            <div className="gw-float relative grid size-[70%] place-items-center rounded-full bg-white shadow-[0_0_0_8px_var(--color-yellow-500),0_0_80px_16px_color-mix(in_srgb,var(--color-yellow-500)_35%,transparent)]">
              {p.image ? (
                <Image src={p.image} alt={p.prize} fill sizes="280px" priority unoptimized={p.image.endsWith(".svg")} className="rounded-full object-contain p-[14%]" />
              ) : (
                <Gift className="size-28 text-ink" aria-hidden="true" />
              )}
            </div>
          </div>
          <p className="text-sm font-semibold text-warm-300">{tr("الجائزة", "The prize")}</p>
          <h1 className="mt-1 text-3xl text-white md:text-4xl">{p.prize}</h1>
          {p.worth ? <p className="mt-1 font-bold text-yellow-500">{p.worth}</p> : null}
        </section>

        {/* The draw */}
        <section className="flex flex-col items-center gap-6 text-center" aria-live="polite">
          <p className="text-lg font-semibold text-warm-300">{p.title}</p>
          <p className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-lg">
            <Users className="size-5 text-yellow-500" aria-hidden="true" />
            <b className="text-2xl tabular-nums">{p.entries}</b> {tr("مشارك", "entries")}
          </p>

          <div className="relative w-full overflow-hidden rounded-[2rem] border-2 border-yellow-500/60 bg-warm-900/70 px-4 py-10 shadow-2xl shadow-yellow-500/10 md:py-14">
            {winner ? (
              <div key={winner.rank} className="gw-win-in flex flex-col items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-yellow-500 px-4 py-1.5 text-sm font-extrabold text-ink">
                  <Trophy className="size-4" aria-hidden="true" />
                  {winner.rank === 1 ? tr("الرابح", "The winner") : tr(`احتياطي ${winner.rank - 1}`, `Backup ${winner.rank - 1}`)}
                </span>
                <p dir="auto" className="text-5xl font-extrabold break-words text-yellow-500 md:text-7xl">
                  {winner.name}
                </p>
                <p className="text-2xl font-bold tracking-wider text-white tabular-nums" dir="ltr">
                  {winner.phone}
                </p>
              </div>
            ) : stage.kind === "spinning" ? (
              <div className="gw-window flex flex-col items-center">
                <p dir="auto" className="text-5xl font-extrabold text-white md:text-7xl">
                  {stage.name}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Shuffle className="size-10 text-yellow-500" aria-hidden="true" />
                <p className="text-3xl font-extrabold md:text-4xl">{tr("واجدين للسحب؟", "Ready to draw?")}</p>
                <p className="text-warm-300">{p.drawLabel}</p>
              </div>
            )}
          </div>

          {error ? <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2 font-semibold text-danger">{error}</p> : null}
          {armed ? (
            <p role="alert" className="rounded-lg bg-warning-soft px-4 py-2 font-semibold text-warning-text">
              {tr("الوقت مازال ما وصلش: السحب دابا غادي يسد التسجيل. ضغط مرة أخرى للتأكيد.", "The draw time has not come yet: drawing now closes entries. Press again to confirm.")}
            </p>
          ) : null}

          <button
            type="button"
            onClick={draw}
            disabled={busy || p.entries === 0 || winners.length >= p.entries}
            className="inline-flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-full bg-yellow-500 px-10 text-2xl font-extrabold text-ink shadow-lg shadow-yellow-500/30 transition-colors hover:bg-yellow-600 active:bg-yellow-700 disabled:cursor-not-allowed disabled:bg-warm-700 disabled:text-warm-400 disabled:shadow-none"
          >
            {busy ? <LoaderCircle className="size-7 animate-spin" aria-hidden="true" /> : <Radio className="size-7" aria-hidden="true" />}
            {winners.length ? tr("سحب احتياطي", "Draw a backup") : tr("ابدأ السحب", "Start the draw")}
          </button>
          <p className="text-xs text-warm-300">{tr("ولا ضغط على Space. الرقم كيبان مخبي باش يبقى خاص.", "Or press Space. The number shows masked to stay private.")}</p>

          {winners.length > 1 ? (
            <ol className="flex flex-wrap justify-center gap-2 text-sm">
              {winners.map((w) => (
                <li key={w.rank} className={`rounded-full px-3 py-1 font-semibold ${w.rank === 1 ? "bg-yellow-500 text-ink" : "bg-white/10 text-warm-300"}`}>
                  {w.rank === 1 ? tr("الرابح", "Winner") : tr(`احتياطي ${w.rank - 1}`, `Backup ${w.rank - 1}`)}: <bdi>{w.name}</bdi>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      </main>

      {/* Latest entrants scrolling along the bottom while waiting: proof on stream that real people entered. */}
      {!winners.length && p.recentNames.length ? (
        <div aria-hidden="true" className="overflow-hidden border-t border-white/10 py-3">
          <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-8 whitespace-nowrap text-warm-300">
            {[...p.recentNames, ...p.recentNames].map((n, i) => (
              <bdi key={i}>{n}</bdi>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
