"use client";

import { useEffect, useRef } from "react";
import { paintSky, type TwinkleStar } from "@/lib/hero-sky";

/**
 * The hero's night sky (lib/hero-sky.ts) behind another black block: the same seeded stars, band and constellations,
 * with the bright stars breathing slowly. Twinkles only while on screen, and stays still for reduced motion.
 * Place it inside a `relative isolate` box.
 */
export function NightSky() {
  const skyRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sky = skyRef.current;
    const stars = starsRef.current;
    const host = sky?.parentElement;
    const skyCtx = sky?.getContext("2d");
    const ctx = stars?.getContext("2d");
    if (!sky || !stars || !host || !skyCtx || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const colors = {
      white: css.getPropertyValue("--color-white"),
      warm: css.getPropertyValue("--color-warm-300"),
      yellow: css.getPropertyValue("--color-yellow-500"),
      line: css.getPropertyValue("--color-warm-500"),
      glow: css.getPropertyValue("--color-warm-500"),
    };
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let twinkles: TwinkleStar[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const box = host.getBoundingClientRect();
      width = box.width;
      height = box.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const c of [sky, stars]) {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Only the lower figure: the upper ones would cross the title on the text side.
      twinkles = paintSky(skyCtx, width, height, getComputedStyle(sky).direction === "rtl", colors, ["orion"]);
      draw(0);
    };

    // Bright stars: a soft glowing dot each, the alpha breathing on its own rhythm.
    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < twinkles.length; i++) {
        const s = twinkles[i];
        const color = s.tone === 0 ? colors.yellow : colors.white;
        ctx.globalAlpha = still ? 0.8 : 0.25 + 0.75 * Math.abs(Math.sin(now / 1700 + i * 1.7));
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size / 6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let frame = 0;
    let visible = false;
    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!still && !frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const sized = new ResizeObserver(resize);
    sized.observe(host);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    seen.observe(host);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      sized.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // The sky clips itself to the host's corners, so the host needs no overflow-hidden: on iPhone Safari a
  // rounded overflow-hidden box around this animated canvas stops a sideways row inside it from swiping.
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
      <canvas ref={skyRef} className="absolute inset-0 size-full" />
      <canvas ref={starsRef} className="absolute inset-0 size-full" />
    </div>
  );
}
