import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { SnakeGame } from "./components/SnakeGame";
import { motion } from "motion/react";
import { PixelButton, PixelIcon } from "./components/PixelButton";
import { sfx } from "./sfx";
import { paletteVars } from "./palette";

export default function App() {
  /* The neon/CRT treatment is built for a dark screen, so start there
     regardless of the system setting. The toggle still works. */
  const [isDark, setIsDark] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isMuted, setIsMuted] = useState(() => sfx.isMuted());
  const [isBoosted, setIsBoosted] = useState(false);
  const snakeGameRef = useRef<{ resetGame: () => void }>(null);

  /* Give the page keyboard focus on load. Without this, a key pressed
     before the first click goes nowhere – the document never had focus, so
     no keydown reaches the game. */
  useEffect(() => {
    window.focus();
    if (document.activeElement === document.body) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div
      /* The palette rides on the root as custom properties so the stylesheet
         and the components share one definition – see src/app/palette.ts. */
      style={paletteVars as CSSProperties}
      className={`neon-stage${isBoosted ? " neon-stage--boost" : ""} size-full min-h-screen flex flex-col items-center justify-center p-2 min-[375px]:p-4 sm:p-8 bg-background text-foreground`}
    >
      {/* Page dressing. Sits behind the game on its own layer. */}
      <div className="starfield" aria-hidden="true" />

      <div className="flex flex-col items-center gap-4 sm:gap-12 w-full pt-2 min-[375px]:pt-4 sm:pt-8 pb-2 min-[375px]:pb-4 sm:pb-8">
        {/* Header. On a phone the controls take their own row and the title
            drops below them with the full width to itself – squeezed into a
            middle column it wrapped to five lines. From sm up it is one row
            with the title centred between the two control groups. */}
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr] items-center gap-y-3 gap-x-2 w-full">
          <div className="col-start-1 row-start-1 justify-self-start above-crt">
            <PixelButton
              color="neutral"
              onClick={() => snakeGameRef.current?.quitGame()}
              className="w-10 h-10 sm:w-11 sm:h-11"
              aria-label="Quit game"
            >
              <PixelIcon sprite="close" />
            </PixelButton>
          </div>

          <div className="col-start-1 col-span-2 row-start-2 sm:col-start-2 sm:col-span-1 sm:row-start-1 text-center">
            {/* `data-text` feeds the scanline overlay in the stylesheet,
                which paints a clipped copy of the lettering. */}
            <h1
              className="neon-title text-[16px] min-[375px]:text-[24px] sm:text-[32px] leading-tight [word-spacing:-0.375em]"
              data-text="Snake Game"
            >
              Snake Game
            </h1>
          </div>

          <div className="col-start-2 row-start-1 sm:col-start-3 justify-self-end flex gap-2 min-[375px]:gap-2.5 above-crt">
            <motion.div
              animate={isGameOver ? { scale: [1, 1.12, 1] } : {}}
              transition={
                isGameOver
                  ? {
                      duration: 0.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  : {}
              }
            >
              <PixelButton
                color="white-blue"
                onClick={() => snakeGameRef.current?.resetGame()}
                className="w-10 h-10 sm:w-11 sm:h-11"
                aria-label="Restart game"
              >
                <PixelIcon sprite="restart" />
              </PixelButton>
            </motion.div>
            <PixelButton
              /* Green while sound is on, red once it is off – the colour
                 carries the state, not just the sprite. */
              color={isMuted ? "white-red" : "white-green"}
              onClick={() => {
                const next = !isMuted;
                sfx.setMuted(next);
                setIsMuted(next);
              }}
              className="w-10 h-10 sm:w-11 sm:h-11"
              aria-label={isMuted ? "Unmute" : "Mute"}
              aria-pressed={isMuted}
            >
              <PixelIcon sprite={isMuted ? "mute" : "sound"} />
            </PixelButton>
            <PixelButton
              color="white-orange"
              onClick={() => setIsDark(!isDark)}
              className="w-10 h-10 sm:w-11 sm:h-11"
              aria-label="Toggle theme"
            >
              <PixelIcon sprite={isDark ? "sun" : "moon"} />
            </PixelButton>
          </div>
        </div>

        <SnakeGame
          ref={snakeGameRef}
          onGameOverChange={setIsGameOver}
          onBoostChange={setIsBoosted}
        />
      </div>

      {/* Fixed, above the game, ignored by the pointer. Hidden on the light
          theme – a vignette only makes sense on a dark screen. */}
      <div className="crt-vignette fixed" />
    </div>
  );
}