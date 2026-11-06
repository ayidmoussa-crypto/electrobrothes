"use client";

import { useEffect, useRef } from "react";
import { HERO_SHAPES, sampleShape, TONES } from "@/lib/hero-shapes";
import { paintSky, type TwinkleStar } from "@/lib/hero-sky";

const HOLD_MS = 4400; // How long each product lasts, the first second or so being spent gathering.
const REACH = 110; // How far the pointer pushes particles, in CSS pixels.
const DRIFT = 14; // How far the sky moves against the pointer, in CSS pixels. The sky canvas is this much oversize.
const METEOR_EVERY_MS = 9000;

/** A soft glowing dot in a brand colour, drawn once and stamped for every particle. */
function sprite(color: string) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/**
 * Hero backdrop: a night sky (lib/hero-sky.ts) and, over it, glowing dots that gather into a product, hold it while
 * it sways in 3D, then burst and gather into the next one. The pointer scatters them and drifts the sky; a click or
 * tap sets off a shockwave and moves on to the next product. It listens on the parent section, so links and buttons
 * in the hero keep working. It only runs while on screen, and is a still picture for people who ask for reduced motion.
 */
export function HeroParticles() {
  const ref = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const skyCanvas = skyRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    const skyCtx = skyCanvas?.getContext("2d");
    if (!canvas || !skyCanvas || !host || !ctx || !skyCtx) return;

    const css = getComputedStyle(document.documentElement);
    const sprites = [] as HTMLCanvasElement[];
    sprites[TONES.yellow] = sprite(css.getPropertyValue("--color-yellow-500"));
    sprites[TONES.white] = sprite(css.getPropertyValue("--color-white"));
    sprites[TONES.warm] = sprite(css.getPropertyValue("--color-warm-300"));
    const skyColors = {
      white: css.getPropertyValue("--color-white"),
      warm: css.getPropertyValue("--color-warm-300"),
      yellow: css.getPropertyValue("--color-yellow-500"),
      line: css.getPropertyValue("--color-warm-500"),
      glow: css.getPropertyValue("--color-warm-500"),
    };
    let twinkles: TwinkleStar[] = [];

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = window.innerWidth < 768 ? 800 : 1500;
    const shapes = HERO_SHAPES.map((draw) => sampleShape(draw, count));

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let scale = 0;
    let dpr = 1;

    const resize = () => {
      const box = host.getBoundingClientRect();
      width = box.width;
      height = box.height;
      dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.5 : 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const rtl = getComputedStyle(canvas).direction === "rtl";
      if (width < 768) {
        // Phones: above the text.
        centerX = width / 2;
        centerY = height * 0.32;
        scale = Math.min(width * 0.74, height * 0.38);
      } else {
        // Opposite the text, which follows the reading direction.
        centerX = width * (rtl ? 0.26 : 0.74);
        centerY = height * 0.56;
        scale = Math.min(width * 0.4, height * 0.68);
      }
      const skyW = width + DRIFT * 2;
      const skyH = height + DRIFT * 2;
      skyCanvas.width = Math.round(skyW * dpr);
      skyCanvas.height = Math.round(skyH * dpr);
      skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      twinkles = paintSky(skyCtx, skyW, skyH, rtl, skyColors);
    };
    resize();

    // Every particle starts anywhere and has its own depth, weight and twinkle.
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const vx = new Float32Array(count);
    const vy = new Float32Array(count);
    const depth = new Float32Array(count);
    const pull = new Float32Array(count);
    const phase = new Float32Array(count);
    const dot = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      x[i] = Math.random() * width;
      y[i] = Math.random() * height;
      depth[i] = (Math.random() - 0.5) * 0.16;
      pull[i] = 0.02 + Math.random() * 0.02;
      phase[i] = Math.random() * Math.PI * 2;
      dot[i] = 5 + Math.random() * 5 + (Math.random() < 0.05 ? 8 : 0);
    }

    let current = 0;
    let changedAt = performance.now();
    let frame = 0;
    let last = 0;
    let visible = true;
    const pointer = { x: -9999, y: -9999, sway: 0, driftX: 0, driftY: 0 };
    let nextMeteor = performance.now() + METEOR_EVERY_MS / 2;
    let meteor: { startedAt: number; x: number; y: number } | null = null;

    const blast = (fromX: number, fromY: number, power: number) => {
      for (let i = 0; i < count; i++) {
        const dx = x[i] - fromX;
        const dy = y[i] - fromY;
        const d = Math.hypot(dx, dy) || 1;
        const push = (power * (0.5 + Math.random())) / (1 + d / 160);
        vx[i] += (dx / d) * push;
        vy[i] += (dy / d) * push;
      }
    };
    const next = (now: number) => {
      current = (current + 1) % shapes.length;
      changedAt = now;
    };

    const paint = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      // The sky's bright stars breathe slowly, on the same drift as the sky they belong to.
      for (let i = 0; i < twinkles.length; i++) {
        const star = twinkles[i];
        ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(now / 1700 + i * 1.7));
        ctx.drawImage(sprites[star.tone === 0 ? TONES.yellow : TONES.white], star.x - DRIFT + pointer.driftX - star.size / 2, star.y - DRIFT + pointer.driftY - star.size / 2, star.size, star.size);
      }

      // A rare shooting star, falling along the band and leaning like the bolt.
      if (meteor) {
        const t = (now - meteor.startedAt) / 800;
        if (t >= 1) meteor = null;
        else {
          const headX = meteor.x - t * 240;
          const headY = meteor.y + t * 340;
          const tail = ctx.createLinearGradient(headX, headY, headX + 70, headY - 100);
          tail.addColorStop(0, skyColors.yellow);
          tail.addColorStop(1, "transparent");
          ctx.globalAlpha = Math.sin(t * Math.PI);
          ctx.strokeStyle = tail;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(headX + 70, headY - 100);
          ctx.stroke();
        }
      }

      const shape = shapes[current];
      for (let i = 0; i < count; i++) {
        ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(now / 900 + phase[i]));
        const s = dot[i];
        ctx.drawImage(sprites[shape.tone[i]], x[i] - s / 2, y[i] - s / 2, s, s);
      }
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 2);
      last = now;
      if (now - changedAt > HOLD_MS) {
        next(now);
        blast(centerX, centerY, 5);
      }

      if (now > nextMeteor) {
        nextMeteor = now + METEOR_EVERY_MS;
        // Starts over the empty side of the sky, so it never crosses the text.
        meteor = { startedAt: now, x: centerX + scale * (0.2 + Math.random() * 0.5), y: height * 0.08 };
      }

      // The sky drifts slightly against the pointer, which gives it distance.
      const hasPointer = pointer.x > -9000;
      const driftToX = hasPointer ? ((pointer.x / width - 0.5) * -2 * DRIFT) : 0;
      const driftToY = hasPointer ? ((pointer.y / height - 0.5) * -2 * DRIFT) : 0;
      pointer.driftX += (driftToX - pointer.driftX) * 0.05 * dt;
      pointer.driftY += (driftToY - pointer.driftY) * 0.05 * dt;
      skyCanvas.style.transform = `translate3d(${pointer.driftX.toFixed(1)}px, ${pointer.driftY.toFixed(1)}px, 0)`;

      const shape = shapes[current];
      // Slow sway, steered by the pointer: the depth of each particle makes the flat drawing read as an object.
      const wanted = pointer.x > -9000 ? ((pointer.x - centerX) / width) * 1.2 : Math.sin(now / 2200) * 0.32;
      pointer.sway += (wanted - pointer.sway) * 0.04 * dt;
      const cos = Math.cos(pointer.sway);
      const sin = Math.sin(pointer.sway);
      const damp = Math.pow(0.86, dt);

      for (let i = 0; i < count; i++) {
        const tx = centerX + (shape.x[i] * cos + depth[i] * sin) * scale;
        const ty = centerY + shape.y[i] * scale;
        vx[i] += (tx - x[i]) * pull[i] * dt;
        vy[i] += (ty - y[i]) * pull[i] * dt;

        const dx = x[i] - pointer.x;
        const dy = y[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < REACH * REACH) {
          const d = Math.sqrt(d2) || 1;
          const push = (1 - d / REACH) * 2.6 * dt;
          vx[i] += (dx / d) * push;
          vy[i] += (dy / d) * push;
        }

        vx[i] *= damp;
        vy[i] *= damp;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
      }
      paint(now);
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (frame || !visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const placeStill = () => {
      const shape = shapes[0];
      for (let i = 0; i < count; i++) {
        x[i] = centerX + shape.x[i] * scale;
        y[i] = centerY + shape.y[i] * scale;
      }
      paint(0);
    };

    const onResize = () => {
      resize();
      if (still) placeStill();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    if (still) {
      placeStill();
      return () => observer.disconnect();
    }

    const local = (e: PointerEvent) => {
      const box = host.getBoundingClientRect();
      return { x: e.clientX - box.left, y: e.clientY - box.top };
    };
    const onMove = (e: PointerEvent) => Object.assign(pointer, local(e));
    const onLeave = () => {
      pointer.x = pointer.y = -9999;
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("a, button")) return;
      const at = local(e);
      Object.assign(pointer, at);
      blast(at.x, at.y, 14);
      next(performance.now());
    };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointercancel", onLeave);
    host.addEventListener("pointerdown", onDown);

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
      observer.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointercancel", onLeave);
      host.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <>
      {/* Oversize by DRIFT on each side, so its edges never show as it moves. */}
      <canvas ref={skyRef} aria-hidden="true" className="pointer-events-none absolute -inset-3.5 -z-20 h-[calc(100%+1.75rem)] w-[calc(100%+1.75rem)] will-change-transform" />
      <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full" />
    </>
  );
}
