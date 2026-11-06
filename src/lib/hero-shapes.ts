// The silhouettes the hero's particles gather into, drawn on a 100 x 100 grid. `body` is the product itself,
// `spark` is its bright detail, which the particles mostly take in Electric Yellow.

type Layers = { body: CanvasRenderingContext2D; spark: CanvasRenderingContext2D };
type Draw = (l: Layers) => void;

const BOX = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

/** Punches a hole in the body, so the shape reads as an object and not as a blob. */
const cut = (ctx: CanvasRenderingContext2D, paint: () => void) => {
  ctx.globalCompositeOperation = "destination-out";
  paint();
  ctx.globalCompositeOperation = "source-over";
};

const BOLT_SVG = "M1151 479L1020 869L1200 874L815 1377L935 997H752Z"; // The logo's bolt (brand/Logo.tsx).
const bolt = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number) => {
  const k = h / 898;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-976, -479);
  ctx.fill(new Path2D(BOLT_SVG));
  ctx.restore();
};

const headphones: Draw = ({ body, spark }) => {
  body.lineWidth = 7;
  body.lineCap = "round";
  body.beginPath();
  body.arc(50, 50, 36, Math.PI, 0);
  body.stroke();
  BOX(body, 7, 48, 19, 40, 8);
  BOX(body, 74, 48, 19, 40, 8);
  BOX(spark, 26, 54, 5, 28, 2);
  BOX(spark, 69, 54, 5, 28, 2);
};

const battery: Draw = ({ body, spark }) => {
  body.lineWidth = 7;
  body.beginPath();
  body.roundRect(6, 26, 80, 48, 9);
  body.stroke();
  BOX(body, 89, 40, 7, 20, 3);
  bolt(spark, 46, 32, 36);
};

const watch: Draw = ({ body, spark }) => {
  BOX(body, 34, 2, 32, 28, 4);
  BOX(body, 34, 70, 32, 28, 4);
  BOX(body, 20, 20, 60, 60, 16);
  BOX(body, 80, 42, 6, 16, 2);
  cut(body, () => BOX(body, 28, 28, 44, 44, 10));
  spark.lineWidth = 4.5;
  spark.lineCap = "round";
  spark.beginPath();
  spark.moveTo(50, 50);
  spark.lineTo(50, 35);
  spark.moveTo(50, 50);
  spark.lineTo(61, 56);
  spark.stroke();
};

// A wall charger only reads as one with all three parts: the two pins, the block, and a cable ending in its plug.
const charger: Draw = ({ body, spark }) => {
  BOX(spark, 33, 3, 9, 18, 2);
  BOX(spark, 58, 3, 9, 18, 2);
  body.lineWidth = 7;
  body.beginPath();
  body.roundRect(20, 21, 60, 41, 10);
  body.stroke();
  bolt(spark, 50, 27, 29);
  body.lineWidth = 5;
  body.lineCap = "round";
  body.beginPath();
  body.moveTo(50, 62);
  body.bezierCurveTo(50, 90, 18, 66, 20, 84);
  body.stroke();
  BOX(body, 13, 82, 14, 12, 3);
  BOX(spark, 16, 94, 8, 5, 1);
};

const brandBolt: Draw = ({ spark }) => bolt(spark, 50, 2, 96);

export const HERO_SHAPES: Draw[] = [headphones, battery, watch, charger, brandBolt];

/** Tones index the sprites in HeroParticles. */
export const TONES = { yellow: 0, white: 1, warm: 2 } as const;

export type SampledShape = { x: Float32Array; y: Float32Array; tone: Uint8Array };

/** Turns a drawing into `count` random points, centred on 0 with the grid spanning -0.5 to 0.5. */
export function sampleShape(draw: Draw, count: number): SampledShape {
  const size = 220;
  const layer = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.scale(size / 100, size / 100);
    return ctx;
  };
  const body = layer();
  const spark = layer();
  draw({ body, spark });
  const bodyData = body.getImageData(0, 0, size, size).data;
  const sparkData = spark.getImageData(0, 0, size, size).data;

  const points: number[] = []; // x, y, isSpark
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4 + 3;
      if (sparkData[i] > 128) points.push(x, y, 1);
      else if (bodyData[i] > 128) points.push(x, y, 0);
    }
  }

  const shape: SampledShape = { x: new Float32Array(count), y: new Float32Array(count), tone: new Uint8Array(count) };
  const total = points.length / 3;
  for (let n = 0; n < count; n++) {
    const p = Math.floor(Math.random() * total) * 3;
    shape.x[n] = points[p] / size - 0.5;
    shape.y[n] = points[p + 1] / size - 0.5;
    const r = Math.random();
    shape.tone[n] = points[p + 2]
      ? r < 0.92
        ? TONES.yellow
        : TONES.white
      : r < 0.14
        ? TONES.yellow
        : r < 0.52
          ? TONES.white
          : TONES.warm;
  }
  return shape;
}
