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

/**
 * The colour the game is *in*: the snake, the set, the glow off the tube.
 *
 * A role, not a hue, and that is the point – it can be swapped here without
 * disturbing `blue` and `green` themselves, which stay available as coin
 * hues, d-pad keys and stat colours. Those are deliberately left alone: they
 * are a set of colours told apart from each other, so pulling one of them to
 * follow the brand would collapse a distinction rather than carry one.
 */
export const BRAND: PaletteName = "green";

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
 * A starfield tile – scattered single pixels, with the odd two-pixel one.
 *
 * The positions are written out rather than generated. `Math.random()` would
 * reshuffle the sky on every load, and an even grid reads as a grid however
 * small the dots get; only an irregular scatter reads as stars.
 *
 * Density is the whole game here: about one star per 30,000 square pixels,
 * which is roughly a clear night. Twice that and it stops looking like a sky
 * and starts looking like noise. The tiles below are large and hold few
 * stars each for exactly that reason.
 *
 * An SVG data URI rather than CSS gradients: a gradient dot has a soft edge,
 * and at one pixel across that is a smudge, not a star.
 */
export const starField = (
  color: string,
  tile: number,
  /** x, y, size */
  stars: readonly [number, number, number][],
): string => {
  const rects = stars
    .map(([x, y, n]) => `<rect x="${x}" y="${y}" width="${n}" height="${n}"/>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" ` +
    `height="${tile}" viewBox="0 0 ${tile} ${tile}" fill="${color}" ` +
    `shape-rendering="crispEdges">${rects}</svg>`;
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
  ["--c-brand", PALETTE[BRAND]],
  ["--c-brand-rgb", toRgbTriplet(PALETTE[BRAND])],
  /* Two tiles whose sizes share no useful factor, so the combined repeat is
     far wider than any screen – with this few stars a single tile would show
     its lattice straight away. */
  [
    "--starfield-a",
    starField("#ffffff", 600, [
      [47, 133, 1], [289, 61, 1], [412, 318, 2],
      [133, 401, 1], [531, 247, 1], [218, 529, 1],
    ]),
  ],
  [
    "--starfield-b",
    starField("#ffffff", 460, [
      [96, 207, 1], [347, 88, 2], [201, 373, 1], [419, 441, 1],
    ]),
  ],
]) as Record<string, string>;
