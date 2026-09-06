import { BRAND, PALETTE } from "../palette";
export interface Sprite {
  /** One character per pixel; a character with no palette entry is transparent. */
  rows: string[];
  palette: Record<string, string>;
  /** Halo colour, for pickups that get one. Kept next to the palette so a
      reward's glow can never drift away from the reward's own colour. */
  glow?: string;
}

interface PixelArtProps {
  sprite: Sprite;
  /**
   * CSS size of one sprite pixel – a number of px, or any CSS length
   * (e.g. "var(--u)"). Keep it a whole number of device pixels or the grid
   * goes fuzzy.
   */
  unit: number | string;
  /** Merged over the sprite's own palette, e.g. to tint a reward. */
  palette?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Draws a sprite as one <rect> per horizontal run of colour, so a 9x8 sprite
 * costs ~20 nodes instead of 72.
 */
export function PixelArt({
  sprite,
  unit,
  palette,
  className,
  style,
}: PixelArtProps) {
  const colors = palette
    ? { ...sprite.palette, ...palette }
    : sprite.palette;
  const height = sprite.rows.length;
  const width = sprite.rows[0].length;

  const rects: React.ReactNode[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      let end = x;
      while (end < row.length && row[end] === char) end++;
      const fill = colors[char];
      if (fill) {
        rects.push(
          <rect
            key={`${y}-${x}`}
            x={x}
            y={y}
            width={end - x}
            height={1}
            fill={fill}
          />,
        );
      }
      x = end;
    }
  });

  const px = (cells: number) =>
    typeof unit === "number"
      ? `${cells * unit}px`
      : `calc(${unit} * ${cells})`;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{
        display: "block",
        width: px(width),
        height: px(height),
        ...style,
      }}
    >
      {rects}
    </svg>
  );
}

/* --------------------------------------------------------------- rewards -- */

const OUTLINE = "#2d2d2d";

/**
 * Normal pickup: a gold coin. Fixed colours – unlike the heart it replaced,
 * a coin only reads as a coin in gold.
 */
export const COIN: Sprite = {
  rows: [
    "...KKKK...",
    "..KYYYYK..",
    ".KWWYYYDK.",
    "KYYOOOOYDK",
    "KYYOOOOYDK",
    "KYYOOOODDK",
    "KYYOOOODDK",
    ".KYYYYDDK.",
    "..KYYDDK..",
    "...KKKK...",
  ],
  palette: {
    K: OUTLINE,
    W: "#ffffff",
    /* The three tones are mixed from the one hue at the same ratios
       `coinPalette` below uses, so the sprite as authored and the sprite as
       re-tinted at runtime are shaded identically. */
    /** Bright face. */
    Y: PALETTE.gold,
    /** Raised inner plate. */
    O: `color-mix(in srgb, ${PALETTE.gold} 68%, #000)`,
    /** Shading down the right-hand side. */
    D: `color-mix(in srgb, ${PALETTE.gold} 45%, #000)`,
  },
};

/**
 * Re-tints the coin from a single base colour, keeping its three tones: the
 * bright face, the raised inner plate and the shading down the right side.
 * The outline and the white glint stay put – they read as light and edge
 * rather than as part of the coin's colour.
 */
export const coinPalette = (base: string) => ({
  Y: base,
  O: `color-mix(in srgb, ${base} 68%, #000)`,
  D: `color-mix(in srgb, ${base} 45%, #000)`,
});

/** Rare pickup: fixed gem colours so it always reads as the valuable one. */
export const DIAMOND: Sprite = {
  /* Cut like a gem rather than shaded like a ball: a flat table across the
     top, one hard girdle line the full width, and facet lines running down
     the pavilion to the point. The old sprite graded smoothly from light to
     dark, which at eleven pixels across reads as a blurred sphere – it is
     the flat planes meeting at hard lines that say faceted at this size.

     Two facet lines down the crown, separating the table from the shoulder
     either side – that pair is what makes a drawn gem read as cut rather
     than as a blob with a line through it. They appear only on the two rows
     where the crown is wider than the table, which is where a shoulder
     exists at all.

     One facet line down the pavilion, not three: at this size three of them
     eat more of the stone than they describe.

     Twelve rows rather than ten, for the girdle's sake. It is one pixel
     either way, but one in ten reads as a bar across the middle and one in
     twelve reads as a line between two masses – the crown and the pavilion
     need enough rows of their own for it to sit between them. Still eleven
     wide, so the footprint in the cell is unchanged. */
  rows: [
    "...KKKKK...",
    "..KCCCCCK..",
    ".KCCCCCWWK.",
    "KCKCCCCCKCK",
    "KCKCCCCCKCK",
    "KKKKKKKKKKK",
    "KBBBBKBBBBK",
    ".KBBBKBBBK.",
    "..KBBKBBK..",
    "...KBBBK...",
    "....KBK....",
    ".....K.....",
  ],
  palette: {
    K: OUTLINE,
    W: "#ffffff",
    C: PALETTE.cyan,
    B: "#3bb8e8",
  },
  glow: PALETTE.cyan,
};

/** Play triangle for the start prompt. */
export const PLAY: Sprite = {
  rows: [
    "XX.......",
    "XXXX.....",
    "XXXXXX...",
    "XXXXXXXX.",
    "XXXXXXXXX",
    "XXXXXXXX.",
    "XXXXXX...",
    "XXXX.....",
    "XX.......",
  ],
  palette: { X: "currentColor" },
};

/* ----------------------------------------------------------------- snake -- */

/**
 * Head, drawn facing up – rotate by whole quarter turns for the other
 * directions. The bottom row is solid `D` so it seams into the next segment.
 */
export const SNAKE_HEAD: Sprite = {
  rows: [
    "..DDDDDD..",
    ".DBBBBBBD.",
    "DBBBBBBBBD",
    "DBWWBBWWBD",
    "DBKWBBWKBD",
    "DBBBBBBBBD",
    "DBBBBBBBBD",
    "DBBBBBBBBD",
    "DBBBBBBBBD",
    "DDDDDDDDDD",
  ],
  palette: {
    D: `color-mix(in srgb, ${PALETTE[BRAND]} 80%, #000)`,
    B: PALETTE[BRAND],
    W: "#ffffff",
    K: "#1a1a1a",
  },
};

/** Tail, joined at the top edge and tapering downwards. */
export const SNAKE_TAIL: Sprite = {
  rows: [
    "DDDDDDDDDD",
    "DBBBBBBBBD",
    ".DBBBBBBD.",
    ".DBBBBBBD.",
    "..DBBBBD..",
    "..DBBBBD..",
    "...DBBD...",
    "...DBBD...",
    "....DD....",
    "..........",
  ],
  palette: {
    D: `color-mix(in srgb, ${PALETTE[BRAND]} 80%, #000)`,
    B: PALETTE[BRAND],
  },
};
