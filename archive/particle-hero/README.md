# Particle hero (archived)

The old home page hero: glowing dots on a night sky that gather into a product, hold it, then burst into the next one.
Removed from the site in favour of a static offer hero. Kept here to reuse in social videos. Not built, linted or type-checked.

- `HeroParticles.tsx`: the canvas component (client, React). It imported `@/lib/hero-shapes` and `@/lib/hero-sky`.
- `hero-shapes.ts`: the product outlines the dots gather into.
- `hero-sky.ts`: a copy of the night sky. The original still lives in `src/lib/hero-sky.ts`, because `NightSky` (promo band, bundles) uses it.
- `hero.jpg`: the shop photo the hero used before the particles.
- The hero button style (`.hero-cta`) stays in `src/app/globals.css` until the new hero replaces it.
