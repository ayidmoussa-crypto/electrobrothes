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

    // One glowing dot per colour, drawn once: stamping it each frame is far cheaper than shadowBlur, which made
    // a row swiping over the sky stutter on iPhone.
    const GLOW = 7;
    const sprite = (color: string) => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      g.fillStyle = color;
      g.fillRect(0, 0, 64, 64);
      // Keep the colour, fade it out from a solid core: a mask, so any colour format works.
      const mask = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      mask.addColorStop(0, "rgb(0 0 0 / 1)");
      mask.addColorStop(0.16, "rgb(0 0 0 / 1)");
      mask.addColorStop(0.3, "rgb(0 0 0 / 0.25)");
      mask.addColorStop(1, "rgb(0 0 0 / 0)");
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = mask;
      g.fillRect(0, 0, 64, 64);
      return c;
    };
    const dots = [sprite(colors.yellow), sprite(colors.white)];

    // Bright stars: a soft glowing dot each, the alpha breathing on its own rhythm.
    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < twinkles.length; i++) {
        const s = twinkles[i];
        const r = s.size / 6 + GLOW;
        ctx.globalAlpha = still ? 0.8 : 0.25 + 0.75 * Math.abs(Math.sin(now / 1700 + i * 1.7));
        ctx.drawImage(dots[s.tone], s.x - r, s.y - r, r * 2, r * 2);
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
    // A sky in a fixed background is always "on screen": watch the block that shows it instead.
    let watched: Element = host;
    for (let el: Element | null = host; el; el = el.parentElement) if (getComputedStyle(el).position === "fixed") watched = el.parentElement ?? host;
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    seen.observe(watched);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    // Hold the twinkle while a row inside the block is being swiped, so the phone spends every frame on the swipe.
    const block = host.parentElement ?? host;
    let resume = 0;
    const hold = () => {
      stop();
      clearTimeout(resume);
      resume = window.setTimeout(start, 300);
    };
    block.addEventListener("scroll", hold, { capture: true, passive: true });
    block.addEventListener("touchstart", hold, { passive: true });
    block.addEventListener("touchmove", hold, { passive: true });

    return () => {
      clearTimeout(resume);
      block.removeEventListener("scroll", hold, { capture: true });
      block.removeEventListener("touchstart", hold);
      block.removeEventListener("touchmove", hold);
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
