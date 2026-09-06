/**
 * The game's colours, in one place.
 *
 * Everything that shows a hue – coins, the snake, both button families, the
 * stat readouts, the boost cycle – reads from here, so a colour can only be
 * changed in one spot and the screen stays of a piece. The brightness level
 * is set by the d-pad: saturated arcade tones, not pastels.
 *
 * Cyan is deliberately missing from `COIN_HUES` below: it belongs to the
 * diamond, and a cyan coin would blur the one distinction the board relies on.
 */
export const PALETTE = {
  blue: "#1e1eff",
  green: "#22c94e",
  gold: "#ffd83d",
  red: "#e02a2a",
  purple: "#a658f9",
  orange: "#ffa500",
  cyan: "#7fe9ff",
} as const;

export type PaletteName = keyof typeof PALETTE;

/**
 * Darker cuts of the hues that also appear as text.
 *
 * The bright tones sit between 1.4:1 and 1.8:1 on the light theme's white
 * page – illegible. These are the light theme's stand-ins, same hue, dark
 * enough to read: the green clears 5.4:1, and the gold is held at 2.9:1,
 * deliberately short of the 4.5:1 text bar. Its hue matters as much as its
 * depth – around 44 degrees it reads as gold, and by 36 it has turned to
 * burnt brown, so it is pinned by hue first and darkened only as far as
 * that allows.
 */
export const PALETTE_DEEP = {
  gold: "#c18f0a",
  green: "#1a7a3c",
} as const;

/** Hues the coin cycles through as you eat. */
export const COIN_HUES = [
  "gold",
  "green",
  "blue",
  "red",
  "purple",
  "orange",
] as const satisfies readonly PaletteName[];

/** `"#1e1eff"` -> `"30 30 255"`, the form `rgb(… / <alpha>)` takes. */
export const toRgbTriplet = (hex: string): string => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/**
 * A repeating pixel motif for the empty page either side of the set –
 * staggered dashes that read as rows of terminal text at a glance.
 *
 * Built as an SVG data URI rather than stacked CSS gradients: a gradient per
 * dash would run to a dozen layers and none of them would be legible as a
 * shape. `crispEdges` keeps the blocks square when the tile is scaled up.
 */
export const dashWeave = (color: string): string => {
  /* x, y, length – on a 16x16 grid, four rows of three dashes, offset row to
     row so the tile does not read as columns. */
  const dashes: [number, number, number][] = [
    [1, 1, 3], [6, 1, 2], [10, 1, 4],
    [2, 5, 2], [6, 5, 4], [12, 5, 2],
    [1, 9, 4], [7, 9, 2], [11, 9, 3],
    [3, 13, 2], [7, 13, 3], [12, 13, 2],
  ];
  const rects = dashes
    .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="1"/>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" ` +
    `viewBox="0 0 16 16" fill="${color}" shape-rendering="crispEdges">` +
    `${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/** Mixes two hex colours. `t` of 0 is `a`, 1 is `b`. */
export const mix = (a: string, b: string, t: number): string => {
  const parse = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [x, y] = [parse(a), parse(b)];
  return `#${x
    .map((c, i) => Math.round(c * (1 - t) + y[i] * t))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
};

/**
 * A halftone dot field – a plain square-dot grid that the stylesheet's mask
 * then fades out, giving the density falloff.
 *
 * Drawn as an SVG data URI rather than a CSS radial-gradient because a
 * gradient dot has a soft edge: at three pixels across it reads as a blur
 * instead of a pixel. The tile is 8 units with a 2-unit dot, so the dot stays
 * three-eighths of the spacing whatever `background-size` is set to.
 */
export const dotField = (color: string): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" ` +
    `viewBox="0 0 8 8" fill="${color}" shape-rendering="crispEdges">` +
    `<rect x="0" y="0" width="2" height="2"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/**
 * The palette as CSS custom properties, for the stylesheet to consume.
 *
 * Applied inline on the app's root element rather than written into the CSS,
 * so this file stays the only definition. Inline means they are there on the
 * first paint – setting them from an effect would flash the fallbacks.
 */
export const paletteVars = Object.fromEntries([
  ...Object.entries(PALETTE).flatMap(([name, hex]) => [
    [`--c-${name}`, hex],
    [`--c-${name}-rgb`, toRgbTriplet(hex)],
  ]),
  ...Object.entries(PALETTE_DEEP).map(([name, hex]) => [
    `--c-${name}-deep`,
    hex,
  ]),
  ["--side-weave", dashWeave(PALETTE.blue)],
  /* Azure, not a tint of the brand blue: tinting #1e1eff holds hue 240 and
     the eye calls that violet. Carried most of the way to the diamond's cyan
     it lands on a pale blue that actually reads blue. */
  ["--bottom-dots", dotField(mix(PALETTE.blue, PALETTE.cyan, 0.72))],
]) as Record<string, string>;
