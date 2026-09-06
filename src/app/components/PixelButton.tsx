import { forwardRef } from "react";
import { PixelArt } from "./PixelArt";

type PixelColor =
  | "blue"
  | "pink"
  | "purple"
  | "peach"
  | "white"
  | "neutral";

interface PixelButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: PixelColor;
}

/**
 * Chunky 8-bit button: hard outline, two-tone pastel body, gloss dash and a
 * solid drop shadow it sinks into on press. Size it from the outside with
 * `className` (e.g. `w-11 h-11`).
 */
export const PixelButton = forwardRef<
  HTMLButtonElement,
  PixelButtonProps
>(function PixelButton(
  { color = "blue", className = "", children, onClick, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={`pixel-btn pixel-btn--${color} ${className}`}
      onClick={(event) => {
        // A pointer click leaves focus on the button, so the ring pops up the
        // moment the player touches an arrow key. Keyboard activation reports
        // detail 0 – those users still get the ring, which is the point of it.
        if (event.detail > 0) event.currentTarget.blur();
        onClick?.(event);
      }}
    >
      <span className="pixel-btn__ring" />
      <span className="pixel-btn__shadow" />
      <span className="pixel-btn__face">
        <span className="pixel-btn__body">
          <span className="pixel-btn__gloss" />
        </span>
      </span>
      <span className="pixel-btn__content">{children}</span>
    </button>
  );
});

/* ---------------------------------------------------------------- icons -- */

/** 9x9 sprites – one character per pixel, `X` is on. */
const SPRITES = {
  arrow: [
    "....X....",
    "...XXX...",
    "..XXXXX..",
    ".XXXXXXX.",
    "XXXXXXXXX",
    "...XXX...",
    "...XXX...",
    "...XXX...",
    "...XXX...",
  ],
  // "replay": a ring around a play triangle – reads far better at 27px than
  // any circular-arrow rendition does.
  restart: [
    "..XXXXX..",
    ".XX...XX.",
    "XX.X...XX",
    "X..XX...X",
    "X..XXX..X",
    "X..XX...X",
    "XX.X...XX",
    ".XX...XX.",
    "..XXXXX..",
  ],
  sun: [
    "....X....",
    ".X.....X.",
    "...XXX...",
    "..XXXXX..",
    "X.XXXXX.X",
    "..XXXXX..",
    "...XXX...",
    ".X.....X.",
    "....X....",
  ],
  // A 7x7 cross inset in the 9x9 grid – the other icons read lighter because
  // they're rings, so a full-bleed X looks oversized next to them.
  close: [
    ".........",
    ".XX...XX.",
    ".XXX.XXX.",
    "..XXXXX..",
    "...XXX...",
    "..XXXXX..",
    ".XXX.XXX.",
    ".XX...XX.",
    ".........",
  ],
  sound: [
    "...XX....",
    "..XXX.X..",
    ".XXXX..X.",
    "XXXXX.X.X",
    "XXXXX.X.X",
    "XXXXX.X.X",
    ".XXXX..X.",
    "..XXX.X..",
    "...XX....",
  ],
  mute: [
    "...XX....",
    "..XXX....",
    ".XXXX.X.X",
    "XXXXX..X.",
    "XXXXX.X.X",
    "XXXXX....",
    ".XXXX....",
    "..XXX....",
    "...XX....",
  ],
  moon: [
    "..XXX....",
    ".XXXX....",
    "XXXX.....",
    "XXX......",
    "XXX......",
    "XXX......",
    "XXXX.....",
    ".XXXX....",
    "..XXX....",
  ],
} satisfies Record<string, string[]>;

export type PixelSprite = keyof typeof SPRITES;

interface PixelIconProps {
  sprite: PixelSprite;
  /** Degrees, multiples of 90 only – anything else breaks the pixel grid. */
  rotate?: 0 | 90 | 180 | 270;
}

/**
 * Renders a UI sprite at exactly one CSS pixel-unit (`--u`) per cell, so the
 * grid always lands on whole pixels however the button is sized.
 */
export function PixelIcon({ sprite, rotate = 0 }: PixelIconProps) {
  return (
    <PixelArt
      sprite={{ rows: SPRITES[sprite], palette: { X: "currentColor" } }}
      unit="var(--u)"
      style={
        rotate ? { transform: `rotate(${rotate}deg)` } : undefined
      }
    />
  );
}
