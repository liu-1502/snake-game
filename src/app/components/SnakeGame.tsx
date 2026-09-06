import {
  useMemo,
  useEffect,
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { PixelButton, PixelIcon } from "./PixelButton";
import { sfx } from "../sfx";
import { BRAND, COIN_HUES, PALETTE } from "../palette";
import {
  PixelArt,
  COIN,
  coinPalette,
  PLAY,
  DIAMOND,
  SNAKE_HEAD,
  SNAKE_TAIL,
} from "./PixelArt";

interface Position {
  x: number;
  y: number;
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const ARROW_HEADINGS: Record<string, Direction> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
};

/** One pixel arrow sprite, rotated per direction. Each key gets its own
    colourway from the button sheet so the pad reads as four distinct keys
    rather than one repeated button. */
const DPAD = [
  { direction: "LEFT", rotate: 270, label: "Move left", color: "red" },
  { direction: "UP", rotate: 0, label: "Move up", color: "blue" },
  { direction: "DOWN", rotate: 180, label: "Move down", color: "brand" },
  { direction: "RIGHT", rotate: 90, label: "Move right", color: "orange" },
] as const;

/**
 * Board shape per screen. Cell size is fixed by the sprite grid, so the only
 * way to keep cells legible on a phone is to use fewer columns – 34 columns
 * squeezed into 375px leaves 10px cells.
 */
const DESKTOP_GRID = { width: 34, height: 20 };
const PHONE_GRID = { width: 17, height: 20 };
const PHONE_QUERY = "(max-width: 639px)";

const gridFor = (isPhone: boolean) =>
  isPhone ? PHONE_GRID : DESKTOP_GRID;
const CELL_SIZE = 25;
/** One sprite pixel. Sprites are drawn on a 10-tall grid, so this fills a cell. */
const SPRITE_UNIT = CELL_SIZE / 10;
/** Frame is two rules with a gap between them; the wrapper reserves all three. */
/* The set, from the outside in: a dark rim, the shell, then a recessed
   inner frame that the glass sits down inside. FRAME_INNER is the dark line
   at the glass; it is drawn over the recess rather than beside it, so it
   costs no space of its own and is not part of the border total.

   FRAME_CHIN is the deeper band along the bottom that carries the power
   button, the way a monitor's is deeper than its sides. */
const FRAME_EDGE = 3;
const FRAME_BAND = 13;
const FRAME_RECESS = 12;
const FRAME_INNER = 2;
const FRAME_BORDER = FRAME_EDGE + FRAME_BAND + FRAME_RECESS;
const FRAME_CHIN = 26;

/**
 * Space the title, score row, d-pad and page padding take around the board –
 * measured, not guessed. Budgeting too little lets the board grow past the
 * viewport and pushes the d-pad off screen.
 */
const CHROME_HEIGHT = 348;

const HIGH_SCORE_KEY = "snake-high-score";
// Starts as a bare head; every heart eaten adds one segment.
/** Same blue as the board frame and the d-pad buttons. */
const INITIAL_SNAKE_COLOR = PALETTE[BRAND];
const INITIAL_DIRECTION: Direction = "UP";
const INITIAL_SPEED = 150;
const MIN_SPEED = 50; // Fastest possible speed
const SPEED_INCREASE_RATE = 5; // Speed increases every 5 points per score increase
const BOOSTER_SPAWN_MIN = 5000; // Min 5 seconds
const BOOSTER_SPAWN_MAX = 10000; // Max 10 seconds
const BOOSTER_LIFETIME = 5000; // Booster stays for 5 seconds
const MULTIPLIER_DURATION = 10000; // Multiplier lasts 10 seconds
const POINTS_PER_LEVEL = 50;

/**
 * The coin is re-tinted on every spawn, so the snake still gains a
 * differently coloured segment each time it eats.
 */
const COIN_COLORS = COIN_HUES.map((name) => ({
  name,
  color: PALETTE[name],
}));

/** The coin on screen at the start of every game; later spawns are random.
    Looked up in COIN_HUES rather than by matching a display string: the
    tuple is typed, so a name that isn't in the palette fails to compile
    instead of silently yielding -1 and an undefined coin. */
const INITIAL_COIN_INDEX = COIN_HUES.indexOf("gold");

const randomCoinIndex = () =>
  Math.floor(Math.random() * COIN_COLORS.length);

/** Snake shading: outline/seam, and the top-left highlight. */
const segDark = (color: string) =>
  `color-mix(in srgb, ${color} 62%, #000)`;
const segLight = (color: string) =>
  `color-mix(in srgb, ${color} 42%, #fff)`;

/** Quarter turns that point a sprite's "up" edge at each direction. */
const HEAD_ROTATION = {
  UP: 0,
  RIGHT: 90,
  DOWN: 180,
  LEFT: 270,
} as const;

/** Turns the tail so its joined edge faces the next segment along. */
const tailRotation = (tail: Position, towardHead: Position) => {
  if (towardHead.y < tail.y) return 0;
  if (towardHead.x > tail.x) return 90;
  if (towardHead.y > tail.y) return 180;
  return 270;
};

interface SnakeGameProps {
  onGameOverChange?: (isGameOver: boolean) => void;
  /** Fires when the diamond's multiplier starts and when it lapses. */
  onBoostChange?: (boosted: boolean) => void;
}

export interface SnakeGameRef {
  resetGame: () => void;
  quitGame: () => void;
}

export const SnakeGame = forwardRef<SnakeGameRef, SnakeGameProps>(({ onGameOverChange, onBoostChange }, ref) => {
  const [grid, setGrid] = useState(() =>
    gridFor(window.matchMedia(PHONE_QUERY).matches),
  );
  /* The game loop lives in a timer, so its closure can outlive a breakpoint
     change by a tick. Reading the bounds through a ref keeps that stray tick
     from measuring the new board against the old walls. */
  const gridRef = useRef(grid);
  gridRef.current = grid;

  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const sync = () => setGrid(gridFor(query.matches));
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const boardWidth = grid.width * CELL_SIZE;
  const boardHeight = grid.height * CELL_SIZE;
  const frameWidth = boardWidth + FRAME_BORDER * 2;
  const frameHeight = boardHeight + FRAME_BORDER * 2 + FRAME_CHIN;

  const initialSnake = useMemo<Position[]>(
    () => [
      {
        x: Math.floor(grid.width / 2),
        y: Math.floor(grid.height / 2),
      },
    ],
    [grid],
  );

  const [snake, setSnake] = useState<Position[]>(initialSnake);
  const [snakeColors, setSnakeColors] = useState<string[]>([
    INITIAL_SNAKE_COLOR,
  ]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>(
    INITIAL_DIRECTION,
  );
  const [nextDirection, setNextDirection] = useState<Direction>(
    INITIAL_DIRECTION,
  );
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Notify parent when game over state changes
  useEffect(() => {
    onGameOverChange?.(isGameOver);
  }, [isGameOver, onGameOverChange]);

  // Booster food state
  const [boosterFood, setBoosterFood] =
    useState<Position | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [multiplierEndTime, setMultiplierEndTime] = useState<
    number | null
  >(null);

  const [coinColorIndex, setCoinColorIndex] = useState(
    INITIAL_COIN_INDEX,
  );
  /* The move handler reads this from inside a state updater, where the
     `coinColorIndex` it closed over may already be stale. */
  const coinColorRef = useRef(coinColorIndex);
  useEffect(() => {
    coinColorRef.current = coinColorIndex;
  }, [coinColorIndex]);

  /** Score shown on screen – runs up to `score` rather than jumping. */
  const [displayScore, setDisplayScore] = useState(0);
  const displayScoreRef = useRef(0);
  const [gain, setGain] = useState<{
    id: number;
    amount: number;
  } | null>(null);
  /* Separate from `gain` so clearing the popup doesn't re-key the number and
     flash it a second time. Starts at 0 so nothing flashes on first paint. */
  const [scoreFlash, setScoreFlash] = useState(0);

  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    } catch {
      // private mode / blocked storage – just start from zero
      return 0;
    }
  });

  const boardFitRef = useRef<HTMLDivElement>(null);
  const [boardScale, setBoardScale] = useState(1);

  /**
   * Fit the board to the space available. `transform: scale` doesn't shrink
   * the layout box, so the scaled board sits inside a box sized to the
   * scaled dimensions – otherwise a board wider than the viewport leaves a
   * band of dead space above and below it.
   *
   * Height is budgeted off the viewport rather than the board's own offset:
   * the page centres its column vertically, so measuring the board's top
   * would feed the new height straight back into the next measurement.
   *
   * The result is snapped so one cell is always a whole number of CSS
   * pixels; a fractional cell puts the grid lines and sprites on half
   * pixels and the art goes soft.
   */
  useEffect(() => {
    const element = boardFitRef.current;
    if (!element) return;

    const fit = () => {
      const cell = Math.min(
        CELL_SIZE,
        Math.floor((element.clientWidth * CELL_SIZE) / frameWidth),
        Math.floor(
          ((window.innerHeight - CHROME_HEIGHT) * CELL_SIZE) /
            frameHeight,
        ),
      );
      setBoardScale(Math.max(6, cell) / CELL_SIZE);
    };

    const observer = new ResizeObserver(fit);
    observer.observe(element);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [frameWidth, frameHeight]);

  /** One level per 50 points, i.e. every five coins. Purely a readout of
      how far into the run you are – the speed ramp keys off `score`. */
  const level = Math.floor(score / POINTS_PER_LEVEL) + 1;

  // Calculate current game speed based on score
  const gameSpeed = Math.max(
    MIN_SPEED,
    INITIAL_SPEED -
      Math.floor(score / 10) * SPEED_INCREASE_RATE,
  );

  const generateFood = useCallback(
    (
      currentSnake: Position[],
      excludeBooster: Position | null = null,
    ): Position => {
      setCoinColorIndex(randomCoinIndex());
      let newFood: Position;
      do {
        newFood = {
          x: Math.floor(Math.random() * grid.width),
          y: Math.floor(Math.random() * grid.height),
        };
      } while (
        currentSnake.some(
          (segment) =>
            segment.x === newFood.x && segment.y === newFood.y,
        ) ||
        (excludeBooster &&
          newFood.x === excludeBooster.x &&
          newFood.y === excludeBooster.y)
      );
      return newFood;
    },
    [grid],
  );

  const generateBoosterFood = useCallback(
    (
      currentSnake: Position[],
      currentFood: Position,
    ): Position => {
      let newBooster: Position;
      do {
        newBooster = {
          x: Math.floor(Math.random() * grid.width),
          y: Math.floor(Math.random() * grid.height),
        };
      } while (
        currentSnake.some(
          (segment) =>
            segment.x === newBooster.x &&
            segment.y === newBooster.y,
        ) ||
        (newBooster.x === currentFood.x &&
          newBooster.y === currentFood.y)
      );
      return newBooster;
    },
    [grid],
  );

  /** Clears the board back to its opening state. `playing` decides whether
      the run starts straight away or waits on the start prompt. */
  const dealFreshBoard = useCallback(
    (playing: boolean) => {
      setSnake(initialSnake);
      setSnakeColors([INITIAL_SNAKE_COLOR]);
      setDirection(INITIAL_DIRECTION);
      setNextDirection(INITIAL_DIRECTION);
      setFood(generateFood(initialSnake));
      setCoinColorIndex(INITIAL_COIN_INDEX);
      setScore(0);
      setIsGameOver(false);
      setIsPlaying(playing);
      setBoosterFood(null);
      setMultiplier(1);
      setMultiplierEndTime(null);
    },
    [generateFood, initialSnake],
  );

  /* Crossing the phone breakpoint changes the board dimensions, which can
     leave the snake or the food outside the new bounds. Deal a fresh board
     rather than trying to salvage the run. Skipped on first render – the
     board is already fresh there. */
  const lastGrid = useRef(grid);
  useEffect(() => {
    if (lastGrid.current === grid) return;
    lastGrid.current = grid;
    dealFreshBoard(false);
  }, [grid, dealFreshBoard]);

  const resetGame = useCallback(
    () => dealFreshBoard(true),
    [dealFreshBoard],
  );

  /** Abandons the current run and returns to the start prompt. */
  const quitGame = useCallback(
    () => dealFreshBoard(false),
    [dealFreshBoard],
  );

  useImperativeHandle(ref, () => ({
    resetGame,
    quitGame,
  }));

  const handleDirectionClick = useCallback(
    (newDirection: Direction) => {
      if (!isPlaying && !isGameOver) {
        // Same reasoning as the keyboard: first input sets the heading.
        setDirection(newDirection);
        setNextDirection(newDirection);
        setIsPlaying(true);
        return;
      }

      setNextDirection((prev) => {
        // Prevent moving in opposite direction
        if (newDirection === "UP" && prev === "DOWN")
          return prev;
        if (newDirection === "DOWN" && prev === "UP")
          return prev;
        if (newDirection === "LEFT" && prev === "RIGHT")
          return prev;
        if (newDirection === "RIGHT" && prev === "LEFT")
          return prev;
        return newDirection;
      });
    },
    [isPlaying, isGameOver],
  );

  const checkCollision = useCallback(
    (head: Position, body: Position[]): boolean => {
      // Check wall collision
      const bounds = gridRef.current;
      if (
        head.x < 0 ||
        head.x >= bounds.width ||
        head.y < 0 ||
        head.y >= bounds.height
      ) {
        return true;
      }
      // Check self collision
      return body.some(
        (segment) =>
          segment.x === head.x && segment.y === head.y,
      );
    },
    [],
  );

  const moveSnake = useCallback(() => {
    if (isGameOver || !isPlaying) return;

    setDirection(nextDirection);

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead: Position = { ...head };

      switch (nextDirection) {
        case "UP":
          newHead.y -= 1;
          break;
        case "DOWN":
          newHead.y += 1;
          break;
        case "LEFT":
          newHead.x -= 1;
          break;
        case "RIGHT":
          newHead.x += 1;
          break;
      }

      if (checkCollision(newHead, prevSnake)) {
        setIsGameOver(true);
        setIsPlaying(false);
        return prevSnake;
      }

      // --- Movement and color logic ---
      const newSnake = [newHead, ...prevSnake];
      let newColors = [...snakeColors];

      // If booster food is eaten
      if (
        boosterFood &&
        newHead.x === boosterFood.x &&
        newHead.y === boosterFood.y
      ) {
        setScore((prev) => prev + 50 * multiplier);
        setBoosterFood(null);
        setMultiplier(2);
        setMultiplierEndTime(Date.now() + MULTIPLIER_DURATION);

        // Add golden color for booster
        newColors = ["#FFD700", ...newColors];
      }
      // If normal food is eaten
      else if (newHead.x === food.x && newHead.y === food.y) {
        setScore((prev) => prev + 10 * multiplier);
        setFood(generateFood(newSnake, boosterFood));

        // Add new color from food at the head
        newColors = [
          COIN_COLORS[coinColorRef.current].color,
          ...newColors,
        ];
      } else {
        // Move snake forward (remove tail)
        newSnake.pop();
        /* Colours travel down the body: the head re-stamps its colour and
           everything shifts back a place. That is what lets the tail change
           colour at all – with a static array the last segment would keep
           the starting colour for the whole run. The cost is that the snake
           settles on the newest colour after a few moves. */
        newColors = [
          newColors[0],
          ...newColors.slice(0, newColors.length - 1),
        ];
      }

      setSnakeColors(newColors);
      return newSnake;
    });
  }, [
    nextDirection,
    food,
    boosterFood,
    multiplier,
    isGameOver,
    isPlaying,
    checkCollision,
    generateFood,
    snakeColors,
  ]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      /* `e.key` for the spacebar is not dependable – some input paths hand
         over an empty string instead of " ". `e.code` names the physical
         key and is always "Space", so test both. */
      const isSpace = e.key === " " || e.code === "Space";

      if (!isPlaying && !isGameOver) {
        const heading = ARROW_HEADINGS[e.key];
        if (heading) {
          e.preventDefault();
          /* At this point the snake is a single segment, so there is no
             neck to double back into. Setting the heading outright matters:
             the reversal guard below would veto Down against the starting
             heading of Up, so the run would begin going the wrong way. */
          setDirection(heading);
          setNextDirection(heading);
          setIsPlaying(true);
          return;
        }
        /* Any other key starts the run. Naming the keys was the wrong
           approach: the spacebar does not report a dependable `key` or
           `code` across every input path, so a check for " " / "Space" can
           silently miss. A start screen has no reason to be fussy – this is
           the arcade "press any key" convention. Modifiers and Tab are left
           alone so shortcuts and keyboard navigation still work. */
        const isModifier =
          e.metaKey ||
          e.ctrlKey ||
          e.altKey ||
          ["Shift", "Control", "Alt", "Meta", "Tab", "Escape"].includes(
            e.key,
          );
        if (!isModifier) {
          e.preventDefault();
          setIsPlaying(true);
          return;
        }
      }

      if (isSpace) {
        e.preventDefault();
        if (isGameOver) resetGame();
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setNextDirection((prev) =>
            prev !== "DOWN" ? "UP" : prev,
          );
          break;
        case "ArrowDown":
          e.preventDefault();
          setNextDirection((prev) =>
            prev !== "UP" ? "DOWN" : prev,
          );
          break;
        case "ArrowLeft":
          e.preventDefault();
          setNextDirection((prev) =>
            prev !== "RIGHT" ? "LEFT" : prev,
          );
          break;
        case "ArrowRight":
          e.preventDefault();
          setNextDirection((prev) =>
            prev !== "LEFT" ? "RIGHT" : prev,
          );
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () =>
      window.removeEventListener("keydown", handleKeyPress);
  }, [isPlaying, isGameOver, resetGame]);

  useEffect(() => {
    if (!isPlaying) return;

    const gameLoop = setInterval(moveSnake, gameSpeed);
    return () => clearInterval(gameLoop);
  }, [moveSnake, isPlaying, gameSpeed]);

  // Booster spawn timer
  useEffect(() => {
    if (!isPlaying || isGameOver) return;

    let boosterTimer: NodeJS.Timeout | null = null;
    let removeTimer: NodeJS.Timeout | null = null;

    const scheduleBooster = () => {
      const delay =
        Math.random() *
          (BOOSTER_SPAWN_MAX - BOOSTER_SPAWN_MIN) +
        BOOSTER_SPAWN_MIN;

      boosterTimer = setTimeout(() => {
        setBoosterFood(generateBoosterFood(snake, food));

        // Remove booster after lifetime, then reschedule the next one
        removeTimer = setTimeout(() => {
          setBoosterFood(null);
          scheduleBooster(); // recursively schedule next booster
        }, BOOSTER_LIFETIME);
      }, delay);
    };

    scheduleBooster();

    return () => {
      if (boosterTimer) clearTimeout(boosterTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, [isPlaying, isGameOver]);

  /* Sound is triggered from state changes, not from inside the move
     updater – React may run an updater more than once for a single tick. */
  const scoreBefore = useRef(score);
  useEffect(() => {
    const gained = score - scoreBefore.current;
    scoreBefore.current = score;
    if (gained <= 0) return;
    // The diamond is worth 50 before any multiplier and a coin 10, so a
    // gain of 50 or more can only have come from the diamond.
    if (gained >= 50) sfx.bonus();
    else sfx.eat();
    setGain({ id: Date.now(), amount: gained });
    setScoreFlash((count) => count + 1);
  }, [score]);

  /* Run the displayed number up to the real one. Kept on a ref so the
     effect doesn't restart on every frame it schedules. */
  useEffect(() => {
    const from = displayScoreRef.current;
    if (score <= from) {
      displayScoreRef.current = score;
      setDisplayScore(score);
      return;
    }
    const started = performance.now();
    const duration = 260;
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - started) / duration);
      const value = Math.round(from + (score - from) * progress);
      displayScoreRef.current = value;
      setDisplayScore(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [score]);

  useEffect(() => {
    if (isGameOver) sfx.die();
  }, [isGameOver]);

  useEffect(() => {
    if (multiplier > 1) sfx.powerUp();
  }, [multiplier]);

  /* The prompt says "CLICK", so any click should do – not just one that
     lands on the board. Buttons are excluded so quitting or muting doesn't
     kick off a run as a side effect. */
  useEffect(() => {
    if (isPlaying || isGameOver) return;
    const startOnClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest("button")) return;
      setIsPlaying(true);
    };
    window.addEventListener("click", startOnClick);
    return () =>
      window.removeEventListener("click", startOnClick);
  }, [isPlaying, isGameOver]);

  useEffect(() => {
    onBoostChange?.(multiplier > 1 && !isGameOver);
  }, [multiplier, isGameOver, onBoostChange]);

  useEffect(() => {
    if (isPlaying) sfx.start();
  }, [isPlaying]);

  // Bank the high score when a run ends
  useEffect(() => {
    if (!isGameOver) return;
    setHighScore((previous) => {
      if (score <= previous) return previous;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score));
      } catch {
        // storage unavailable – the score still shows for this session
      }
      return score;
    });
  }, [isGameOver, score]);

  // Multiplier timer
  useEffect(() => {
    if (!multiplierEndTime) return;

    const checkMultiplier = setInterval(() => {
      if (Date.now() >= multiplierEndTime) {
        setMultiplier(1);
        setMultiplierEndTime(null);
      }
    }, 100);

    return () => clearInterval(checkMultiplier);
  }, [multiplierEndTime]);

  // Touch swipe handling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const touchEnd = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = touchEnd.x - touchStartRef.current.x;
    const deltaY = touchEnd.y - touchStartRef.current.y;
    
    const minSwipeDistance = 30; // Minimum pixels to register as swipe
    
    // Only process if swipe is significant enough
    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      touchStartRef.current = null;
      return;
    }

    // Start game if not playing
    if (!isPlaying && !isGameOver) {
      setIsPlaying(true);
    }

    // Determine direction based on larger delta
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (deltaX > 0) {
        handleDirectionClick("RIGHT");
      } else {
        handleDirectionClick("LEFT");
      }
    } else {
      // Vertical swipe
      if (deltaY > 0) {
        handleDirectionClick("DOWN");
      } else {
        handleDirectionClick("UP");
      }
    }

    touchStartRef.current = null;
  }, [isPlaying, isGameOver, handleDirectionClick]);

  /* One 16px gap for the whole column, so the score row sits the same
     distance above the board as the d-pad sits below it. */
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div
        /* Stats stay centred whether or not the hint is showing – with
           justify-between the hint's presence shunted them left. */
        className="relative flex items-center justify-center w-full px-2 sm:px-0 text-[8px] sm:text-[16px]"
        style={{ maxWidth: frameWidth * boardScale }}
      >
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-muted-foreground">Score:</span>
            {/* The popup anchors to the number alone, not to the whole
                "Score: N" group, so it rises straight off the digits. */}
            <span className="relative">
              <span
                key={scoreFlash}
                /* Nothing scored yet is not worth highlighting. */
                className={`tabular-nums${
                  displayScore > 0 ? " score-value" : ""
                }${scoreFlash ? " score-value--flash" : ""}`}
              >
                {displayScore}
              </span>
              {/* Absolute so the number never shifts as it floats away. */}
              {gain && (
                <span
                  key={`gain-${gain.id}`}
                  className="score-gain"
                  onAnimationEnd={() => setGain(null)}
                >
                  +{gain.amount}
                </span>
              )}
            </span>
          </div>
          {/* `foreground` rather than a literal white: the divider has to
              stay visible on the light theme too, where the page is white.
              0.875em is this font's cap height, so it matches the "H" beside
              it instead of spanning the whole line box. */}
          <div className="w-0.5 h-[0.875em] bg-foreground/25" />
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-muted-foreground">High:</span>
            <span className="tabular-nums high-value">{highScore}</span>
          </div>
          <div className="w-0.5 h-[0.875em] bg-foreground/25" />
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-muted-foreground">Level:</span>
            <span className="tabular-nums level-value">{level}</span>
          </div>
        </div>
      </div>

      <div ref={boardFitRef} className="w-full flex justify-center">
      {/* Overlays live here rather than inside the board: the board is
          scaled to fit, so anything inside it shrinks with it – on a phone
          the game-over text came out at 11px and the hint at 4px. This box
          is already at screen scale. */}
      <div
        className="relative"
        style={{
          width: frameWidth * boardScale,
          height: frameHeight * boardScale,
        }}
      >
      <div
        /* The moulding. It carries `--frame-color` and the boost animation
           because it is what shows them – the screen inside only needs the
           dark line around its edge. */
        className={`tv-bezel${
          multiplier > 1 && !isGameOver ? " tv-bezel--boost" : ""
        }${isGameOver ? " tv-bezel--over" : ""}`}
        style={
          {
            width: frameWidth,
            height: frameHeight,
            paddingTop: FRAME_EDGE + FRAME_BAND,
            paddingLeft: FRAME_EDGE + FRAME_BAND,
            paddingRight: FRAME_EDGE + FRAME_BAND,
            paddingBottom: FRAME_EDGE + FRAME_BAND + FRAME_CHIN,
            transform: `scale(${boardScale})`,
            transformOrigin: "top left",
            "--frame-edge": `${FRAME_EDGE}px`,
            "--frame-inner": `${FRAME_INNER}px`,
          } as React.CSSProperties
        }
      >
        {/* The inner frame. The glass sits down inside it, which is what
            gives the set its two layers. */}
        <div
          className="tv-recess"
          style={
            {
              padding: FRAME_RECESS,
              "--tv-wall": `${FRAME_RECESS}px`,
            } as React.CSSProperties
          }
        >
        <div
          className={`relative bg-card touch-none board-frame${
            isGameOver ? " board-shake" : ""
          }`}
          style={{ width: boardWidth, height: boardHeight }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Grid background */}
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${grid.width}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${grid.height}, ${CELL_SIZE}px)`,
            }}
          >
            {Array.from({ length: grid.width * grid.height }).map(
              (_, i) => (
                <div
                  key={i}
                  className="border border-border/20"
                />
              ),
            )}
          </div>

          {/* Snake – sprite head and tail, bevelled blocks in between.
              No position transition: easing between cells would put the
              sprites on fractional pixels and blur them. */}
          {snake.map((segment, index) => {
            const color =
              snakeColors[index] || INITIAL_SNAKE_COLOR;
            const box = {
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            };
            const isHead = index === 0;
            const isTail =
              index === snake.length - 1 && snake.length > 1;

            if (isHead || isTail) {
              const rotate = isHead
                ? HEAD_ROTATION[direction]
                : tailRotation(segment, snake[index - 1]);
              return (
                <div
                  key={index}
                  className="absolute"
                  style={box}
                >
                  <PixelArt
                    sprite={isHead ? SNAKE_HEAD : SNAKE_TAIL}
                    unit={SPRITE_UNIT}
                    palette={{ B: color, D: segDark(color) }}
                    style={
                      rotate
                        ? { transform: `rotate(${rotate}deg)` }
                        : undefined
                    }
                  />
                </div>
              );
            }

            return (
              <div
                key={index}
                className="snake-seg"
                style={
                  {
                    ...box,
                    "--seg-base": color,
                    "--seg-dark": segDark(color),
                    "--seg-light": segLight(color),
                  } as React.CSSProperties
                }
              />
            );
          })}

          {/* Food – normal pickup */}
          <div
            className="absolute flex items-center justify-center pixel-bob"
            style={{
              left: food.x * CELL_SIZE,
              top: food.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            }}
          >
            <PixelArt
              sprite={COIN}
              unit={SPRITE_UNIT}
              palette={coinPalette(
                COIN_COLORS[coinColorIndex].color,
              )}
            />
          </div>

          {/* Booster – rare pickup: 5x a heart, plus the 2x multiplier */}
          {boosterFood && (
            <div
              className="absolute flex items-center justify-center pixel-bob"
              style={{
                left: boosterFood.x * CELL_SIZE,
                top: boosterFood.y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            >
              {/* halo spills outside the cell so it reads around the gem */}
              <div
                className="absolute inset-[-30%] rounded-full blur-sm pixel-glow"
                style={{ background: DIAMOND.glow }}
              />
              <PixelArt
                sprite={DIAMOND}
                unit={SPRITE_UNIT}
                className="relative z-10"
              />
            </div>
          )}
        </div>
      </div>

          {!isPlaying && !isGameOver && (
            /* The two lines straddle the snake, which always starts on the
               middle cell. Each is anchored to the centre line on its own
               rather than centred as one column: the top line wraps to two
               rows on a phone, and a single centred column shifts the gap
               downwards by half that extra height, dropping the wrapped word
               onto the head. Anchoring separately holds three quarters of a
               cell of clearance either side of the head at any board
               scale. */
            <div className="absolute inset-0 pointer-events-none [--play-u:1px] sm:[--play-u:2px]">
              {/* The sprite flows inline with the text rather than sitting in
                  a flex row, so it stays glued to the first word when the
                  prompt wraps onto two lines on a phone. */}
              <span
                className="arcade-blink absolute inset-x-0 px-2 text-center text-[16px] sm:text-[24px] [word-spacing:-0.375em] leading-[1.6]"
                style={{
                  bottom: `calc(50% + ${CELL_SIZE * boardScale * 0.75}px)`,
                }}
              >
                <PixelArt
                  sprite={PLAY}
                  unit="var(--play-u)"
                  className="mr-2 sm:mr-3"
                  style={{ display: "inline-block", verticalAlign: "middle" }}
                />
                PRESS ARROW KEY TO START
              </span>
              <span
                className="absolute inset-x-0 px-2 text-center text-[8px] sm:text-[10px] text-muted-foreground [word-spacing:-0.25em]"
                style={{
                  top: `calc(50% + ${CELL_SIZE * boardScale * 1.75}px)`,
                }}
              >
                [ CLICK · OR PRESS ARROW KEY ]
              </span>
            </div>
          )}

          {isGameOver && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="game-over-panel">
                <p className="text-[16px] sm:text-[32px] leading-none [word-spacing:-0.375em]">
                  GAME OVER
                </p>
                {/* Fixed equal columns: `flex-1` sizes them off the panel's
                    width, which is narrower than "FINAL SCORE" and wraps it.
                    w-44 is 176px – exactly 11 characters at 16px in this
                    monospace face – so both labels fit on one line and the
                    divider sits on the centre line. */}
                <div className="flex gap-4 sm:gap-8 mt-3 sm:mt-6 py-3 sm:py-5 border-y-2 border-solid border-black/25">
                  <div className="w-[88px] sm:w-44 whitespace-nowrap">
                    <p className="text-[8px] sm:text-[16px] leading-none [word-spacing:-0.375em]">
                      FINAL SCORE
                    </p>
                    <p className="text-[16px] sm:text-[32px] leading-none mt-2 sm:mt-3 tabular-nums">
                      {score}
                    </p>
                  </div>
                  <div className="w-0.5 bg-black/25" />
                  <div className="w-[88px] sm:w-44 whitespace-nowrap">
                    <p className="text-[8px] sm:text-[16px] leading-none [word-spacing:-0.375em]">
                      HIGH SCORE
                    </p>
                    <p className="text-[16px] sm:text-[32px] leading-none mt-2 sm:mt-3 tabular-nums">
                      {highScore}
                    </p>
                  </div>
                </div>
                <p className="text-[8px] sm:text-[12px] leading-none mt-3 sm:mt-6 [word-spacing:-0.375em]">
                  PRESS SPACE TO RESTART
                </p>
              </div>
            </div>
      )}

        {/* Moulded into the chin, the way a monitor's is. Part of the
            casing, not a control – nothing to press. */}
        <span className="tv-power" aria-hidden="true">
          <PixelIcon sprite="power" />
        </span>
        </div>
      </div>
      </div>

      {/* Mobile Controls */}
      <div className="flex gap-3 min-[375px]:gap-4 above-crt">
        {DPAD.map(({ direction, rotate, label, color }) => (
          <PixelButton
            key={direction}
            color={color}
            onClick={() => handleDirectionClick(direction)}
            className="w-11 h-11 min-[375px]:w-12 min-[375px]:h-12 sm:w-11 sm:h-11"
            aria-label={label}
          >
            <PixelIcon sprite="arrow" rotate={rotate} />
          </PixelButton>
        ))}
      </div>
    </div>
  );
});

SnakeGame.displayName = "SnakeGame";