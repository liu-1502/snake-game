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
 * Darker cuts of the three hues that also appear as text.
 *
 * The bright tones sit between 1.4:1 and 1.8:1 on the light theme's white
 * page – illegible. These clear 4.5:1, so the light theme swaps to them and
 * keeps the same hue.
 */
export const PALETTE_DEEP = {
  gold: "#b06a10",
  cyan: "#0e6d85",
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

/** Mixes a hex colour toward white. 0 leaves it, 1 is white. */
export const lighten = (hex: string, amount: number): string => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => mix(c).toString(16).padStart(2, "0"))
    .join("");
  return `#${out}`;
};

/**
 * A halftone dot field for the empty page either side of the set – a plain
 * square-dot grid, which the corner mask in the stylesheet then thins out
 * with distance to give the fade.
 *
 * Built as an SVG data URI rather than a CSS radial-gradient because a
 * gradient dot has a soft edge: at this size it reads as a blur rather than
 * as a pixel. `crispEdges` keeps the dots square when the tile is scaled up.
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
  /* Paler than the brand blue: at full strength the dots read as a solid
     field rather than as a texture behind the page. */
  ["--side-weave", dotField(lighten(PALETTE.blue, 0.55))],
]) as Record<string, string>;
