import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ROWS = 6;
const COLS = 22;
const CELL_COUNT = ROWS * COLS;
const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$()-+&=;:'\"%,./?°".split("");
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMBERS = "1234567890".split("");
const SYMBOLS = "!@#$()-+&=;:'\"%,./?°".split("");
const COLOR_MAP = {
  "{R}": "#E8342C",
  "{O}": "#EF7D24",
  "{Y}": "#F5C829",
  "{G}": "#49A347",
  "{B}": "#2F73E0",
  "{V}": "#8B3FB8",
  "{W}": "#EEEAE2",
};
const STORAGE_KEY = "flippybord-state-v3";
const SAVED_SCREENS_KEY = "flippybord-saved-screens-v1";
const DEFAULT_MESSAGE = "YOUR STORY HERE\nCLICK A TILE\nAND START TYPING";
const STAGGER_COL = 14;
const STAGGER_ROW = 22;

const BACKGROUNDS = [
  {
    id: "gallery-plaster",
    label: "Gallery Plaster",
    css: {
      background:
        "radial-gradient(circle at top, rgba(255,255,255,0.25), transparent 28%), linear-gradient(180deg, #f3e3cb 0%, #dcc5a8 100%)",
    },
  },
];

const FEATURED_SCENES = [
  {
    id: "lobby",
    name: "Lobby Welcome",
    blurb: "Hospitality arrivals and concierge moments.",
    message: "GOOD EVENING\nCHECK IN AT 4\nLOBBY BAR OPEN",
    background: "gallery-plaster",
    frame: "black",
  },
  {
    id: "launch",
    name: "Launch Night",
    blurb: "Retail drops, openings, and release countdowns.",
    message: "LAUNCH NIGHT\nDOORS AT 8 PM\nSEE YOU INSIDE",
    background: "gallery-plaster",
    frame: "black",
  },
  {
    id: "home",
    name: "Home Ritual",
    blurb: "A calmer board for kitchens, hallways, and studios.",
    message: "DINNER AT 7\nDOG WALK AT 8\nMOVIE NIGHT",
    background: "gallery-plaster",
    frame: "black",
  },
];

const audioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;

  const getContext = () => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }

      ctx = new AudioContextClass();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.09;
      masterGain.connect(ctx.destination);
    }

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    return { ctx, masterGain };
  };

  return {
    setEnabled(value) {
      enabled = value;
    },
    click() {
      if (!enabled) {
        return;
      }

      try {
        const contextData = getContext();
        if (!contextData) {
          return;
        }

        const { ctx: audioContext, masterGain: gain } = contextData;
        const startAt = audioContext.currentTime;
        const burstLength = Math.floor(audioContext.sampleRate * 0.022);
        const burst = audioContext.createBuffer(1, burstLength, audioContext.sampleRate);
        const burstData = burst.getChannelData(0);

        for (let index = 0; index < burstLength; index += 1) {
          const progress = index / burstLength;
          const decay = Math.exp(-progress * 13);
          const grit = (Math.random() * 2 - 1) * decay;
          const chatter = Math.sin(index * 0.34) * 0.14 * decay;
          burstData[index] = grit + chatter;
        }

        const playNoiseHit = ({ time, volume, band, low }) => {
          const source = audioContext.createBufferSource();
          source.buffer = burst;

          const highPass = audioContext.createBiquadFilter();
          highPass.type = "highpass";
          highPass.frequency.value = 720;
          highPass.Q.value = 0.75;

          const bandPass = audioContext.createBiquadFilter();
          bandPass.type = "bandpass";
          bandPass.frequency.value = band;
          bandPass.Q.value = 1.35;

          const lowPass = audioContext.createBiquadFilter();
          lowPass.type = "lowpass";
          lowPass.frequency.value = low;
          lowPass.Q.value = 0.6;

          const hitGain = audioContext.createGain();
          hitGain.gain.setValueAtTime(0.0001, time);
          hitGain.gain.linearRampToValueAtTime(volume, time + 0.0012);
          hitGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.024);

          source.connect(highPass).connect(bandPass).connect(lowPass).connect(hitGain).connect(gain);
          source.start(time);
          source.stop(time + 0.026);
        };

        playNoiseHit({
          time: startAt,
          volume: 0.18 + Math.random() * 0.03,
          band: 1900 + Math.random() * 240,
          low: 4300,
        });

        playNoiseHit({
          time: startAt + 0.007 + Math.random() * 0.0015,
          volume: 0.09 + Math.random() * 0.02,
          band: 1320 + Math.random() * 180,
          low: 3100,
        });

        const bodyOscillator = audioContext.createOscillator();
        bodyOscillator.type = "triangle";
        bodyOscillator.frequency.setValueAtTime(210 + Math.random() * 22, startAt);
        bodyOscillator.frequency.exponentialRampToValueAtTime(160, startAt + 0.045);

        const bodyGain = audioContext.createGain();
        bodyGain.gain.setValueAtTime(0.0001, startAt);
        bodyGain.gain.linearRampToValueAtTime(0.016, startAt + 0.0016);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.048);

        bodyOscillator.connect(bodyGain).connect(gain);
        bodyOscillator.start(startAt);
        bodyOscillator.stop(startAt + 0.05);
      } catch {
        // Ignore audio failures in browsers with stricter autoplay policies.
      }
    },
  };
})();

function createCell(char = " ", color = null) {
  return { char, color };
}

function emptyGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => createCell()),
  );
}

function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function getCharIndex(character) {
  const matchIndex = CHARS.indexOf(character.toUpperCase());
  return matchIndex >= 0 ? matchIndex : 0;
}

function centerMessage(text) {
  const lines = (text || "").split("\n").slice(0, ROWS);
  const grid = emptyGrid();
  const startRow = Math.floor((ROWS - lines.length) / 2);

  lines.forEach((line, lineIndex) => {
    const rowIndex = startRow + lineIndex;
    if (rowIndex < 0 || rowIndex >= ROWS) {
      return;
    }

    const tokens = [];
    let cursor = 0;

    while (cursor < line.length) {
      let colorToken = null;

      for (const key of Object.keys(COLOR_MAP)) {
        if (line.slice(cursor, cursor + key.length).toUpperCase() === key) {
          colorToken = key;
          break;
        }
      }

      if (colorToken) {
        tokens.push(createCell(" ", COLOR_MAP[colorToken]));
        cursor += colorToken.length;
      } else {
        tokens.push(createCell(line[cursor].toUpperCase(), null));
        cursor += 1;
      }
    }

    const trimmed = tokens.slice(0, COLS);
    const startCol = Math.floor((COLS - trimmed.length) / 2);

    trimmed.forEach((token, tokenIndex) => {
      const columnIndex = startCol + tokenIndex;
      if (columnIndex >= 0 && columnIndex < COLS) {
        grid[rowIndex][columnIndex] = token;
      }
    });
  });

  return grid;
}

function toFlatIndex(position) {
  return position.row * COLS + position.col;
}

function fromFlatIndex(index) {
  return {
    row: Math.floor(index / COLS),
    col: index % COLS,
  };
}

function advancePosition(position) {
  const nextIndex = Math.min(CELL_COUNT - 1, toFlatIndex(position) + 1);
  return fromFlatIndex(nextIndex);
}

function retreatPosition(position) {
  const nextIndex = Math.max(0, toFlatIndex(position) - 1);
  return fromFlatIndex(nextIndex);
}

function movePosition(position, rowDelta, colDelta) {
  return {
    row: Math.min(ROWS - 1, Math.max(0, position.row + rowDelta)),
    col: Math.min(COLS - 1, Math.max(0, position.col + colDelta)),
  };
}

function nextLinePosition(position) {
  return {
    row: Math.min(ROWS - 1, position.row + 1),
    col: 0,
  };
}

function setGridCell(grid, position, cell) {
  const nextGrid = cloneGrid(grid);
  nextGrid[position.row][position.col] = { ...cell };
  return nextGrid;
}

function sanitizeGrid(candidate) {
  if (!Array.isArray(candidate) || candidate.length !== ROWS) {
    return centerMessage(DEFAULT_MESSAGE);
  }

  return candidate.map((row) =>
    Array.from({ length: COLS }, (_, columnIndex) => {
      const sourceCell = Array.isArray(row) ? row[columnIndex] : null;

      if (!sourceCell || typeof sourceCell !== "object") {
        return createCell();
      }

      const nextChar =
        typeof sourceCell.char === "string" && CHARS.includes(sourceCell.char.toUpperCase())
          ? sourceCell.char.toUpperCase()
          : " ";
      const nextColor = typeof sourceCell.color === "string" ? sourceCell.color : null;

      return createCell(nextColor ? " " : nextChar, nextColor);
    }),
  );
}

function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value === "1" || value === "true";
}

function sanitizeBackground() {
  return "gallery-plaster";
}

function sanitizeFrame() {
  return "black";
}

function encodeData(payload) {
  if (typeof window === "undefined") {
    return "";
  }

  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function decodeData(value) {
  if (!value || typeof window === "undefined") {
    return null;
  }

  try {
    const binary = window.atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const COLOR_VALUES = Object.values(COLOR_MAP);

function encodeGridCompact(grid) {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const charIdx = CHARS.indexOf(cell.char) >= 0 ? CHARS.indexOf(cell.char) : 0;
      const colorIdx = cell.color ? COLOR_VALUES.indexOf(cell.color) + 1 : 0;
      cells.push(charIdx * 8 + colorIdx);
    }
  }

  const bytes = new Uint8Array(cells);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeGridCompact(encoded) {
  if (!encoded) return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    if (bytes.length !== CELL_COUNT) return null;

    const grid = emptyGrid();
    for (let i = 0; i < CELL_COUNT; i++) {
      const val = bytes[i];
      const charIdx = Math.floor(val / 8);
      const colorIdx = val % 8;
      const char = charIdx < CHARS.length ? CHARS[charIdx] : " ";
      const color = colorIdx > 0 && colorIdx <= COLOR_VALUES.length ? COLOR_VALUES[colorIdx - 1] : null;
      grid[Math.floor(i / COLS)][i % COLS] = createCell(color ? " " : char, color);
    }
    return { grid };
  } catch {
    return null;
  }
}

function readStoredState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readSavedScreens() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_SCREENS_KEY);
    return raw ? JSON.parse(raw).map((screen) => ({ ...screen, grid: sanitizeGrid(screen.grid) })) : [];
  } catch {
    return [];
  }
}

function buildFeaturedScene(scene) {
  return {
    ...scene,
    grid: centerMessage(scene.message),
  };
}

function readInitialState() {
  const fallback = {
    grid: centerMessage(DEFAULT_MESSAGE),
    background: BACKGROUNDS[0].id,
    frame: "black",
    sound: true,
    hover: true,
    present: false,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const params = new URLSearchParams(window.location.search);
  const stored = readStoredState();
  const compactPayload = decodeGridCompact(params.get("b"));
  const legacyPayload = decodeData(params.get("board"));
  const queryPayload = compactPayload ?? legacyPayload;
  const gridFromStoredMessage = stored?.message ? centerMessage(stored.message) : null;

  return {
    grid: sanitizeGrid(queryPayload?.grid ?? stored?.grid ?? gridFromStoredMessage ?? fallback.grid),
    background: sanitizeBackground(params.get("bg") ?? stored?.background ?? fallback.background),
    frame: sanitizeFrame(params.get("frame") ?? stored?.frame ?? fallback.frame),
    sound: parseBoolean(params.get("sound"), stored?.sound ?? fallback.sound),
    hover: parseBoolean(params.get("hover"), stored?.hover ?? fallback.hover),
    present: parseBoolean(params.get("d") ?? params.get("display"), stored?.present ?? fallback.present),
  };
}

function buildShareUrl({ grid, background, frame, sound, hover, present }) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("b", encodeGridCompact(grid));
  url.searchParams.set("d", present ? "1" : "0");
  return url.toString();
}

function normalizeTypedCharacter(key) {
  if (key.length !== 1) {
    return null;
  }

  if (key === " ") {
    return " ";
  }

  const upper = key.toUpperCase();
  return CHARS.includes(upper) ? upper : null;
}

function getPreviewLines(grid) {
  return grid
    .map((row) => row.map((cell) => (cell.color ? "■" : cell.char)).join("").trimEnd())
    .filter(Boolean)
    .slice(0, 2);
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function describeCell(cell) {
  if (!cell) {
    return "Blank";
  }

  if (cell.color) {
    const colorEntry = Object.entries(COLOR_MAP).find(([, value]) => value === cell.color);
    return colorEntry ? `Signal ${colorEntry[0]}` : "Color tile";
  }

  return cell.char === " " ? "Blank" : cell.char;
}

function getSelectionRange(start, end) {
  if (!start || !end) return null;
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  return { minRow, maxRow, minCol, maxCol };
}

function isInRange(row, col, range) {
  if (!range) return false;
  return row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol;
}

function gridsEqual(a, b) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (a[r][c].char !== b[r][c].char || a[r][c].color !== b[r][c].color) return false;
    }
  }
  return true;
}

const MAX_UNDO = 50;

function useUndoHistory(grid, setGrid) {
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const lastSnapshot = useRef(grid);

  const snapshot = useCallback(() => {
    if (!gridsEqual(lastSnapshot.current, grid)) {
      undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), cloneGrid(lastSnapshot.current)];
      redoStack.current = [];
      lastSnapshot.current = cloneGrid(grid);
    }
  }, [grid]);

  useEffect(() => {
    snapshot();
  }, [snapshot]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return false;
    redoStack.current = [...redoStack.current, cloneGrid(grid)];
    const prev = undoStack.current.pop();
    lastSnapshot.current = cloneGrid(prev);
    setGrid(prev);
    return true;
  }, [grid, setGrid]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return false;
    undoStack.current = [...undoStack.current, cloneGrid(grid)];
    const next = redoStack.current.pop();
    lastSnapshot.current = cloneGrid(next);
    setGrid(next);
    return true;
  }, [grid, setGrid]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  return { undo, redo, canUndo, canRedo };
}

function SplitFlap({ targetChar, delay, color, hoverActive, selected, inRange, onSelect, onDragStart, onDragOver, label }) {
  const [currentChar, setCurrentChar] = useState(" ");
  const [currentColor, setCurrentColor] = useState(null);
  const [flipping, setFlipping] = useState(false);
  const [nextChar, setNextChar] = useState(" ");
  const [nextColor, setNextColor] = useState(null);
  const [flipMs, setFlipMs] = useState(150);

  const queueRef = useRef([]);
  const animatingRef = useRef(false);
  const curCharRef = useRef(" ");
  const curColorRef = useRef(null);
  const targetRef = useRef(targetChar);
  const colorRef = useRef(color);
  const disturbedRef = useRef(false);
  const baseDuration = useRef(50 + Math.random() * 20);
  const flipTimerRef = useRef(null);
  const gapTimerRef = useRef(null);
  const processQueueRef = useRef(() => {});

  useEffect(() => {
    targetRef.current = targetChar;
  }, [targetChar]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    processQueueRef.current = () => {
      const nextItem = queueRef.current[0];

      if (!nextItem) {
        animatingRef.current = false;
        return;
      }

      if (typeof nextItem === "object" && nextItem.char === "__DONE__") {
        queueRef.current.shift();
        disturbedRef.current = false;
        animatingRef.current = false;
        return;
      }

      animatingRef.current = true;
      const item = queueRef.current.shift();
      const nextCharacter = typeof item === "object" ? item.char : item;
      const nextCharacterColor = typeof item === "object" ? item.color : null;
      const duration = Math.round(baseDuration.current + (Math.random() - 0.5) * 16);

      setFlipMs(duration);
      setNextChar(nextCharacter);
      setNextColor(nextCharacterColor);
      setFlipping(true);
      audioEngine.click();

      flipTimerRef.current = window.setTimeout(() => {
        setFlipping(false);
        setCurrentChar(nextCharacter);
        setCurrentColor(nextCharacterColor);
        curCharRef.current = nextCharacter;
        curColorRef.current = nextCharacterColor;

        gapTimerRef.current = window.setTimeout(processQueueRef.current, 2 + Math.random() * 5);
      }, duration);
    };
  }, []);

  useEffect(() => {
    if (disturbedRef.current) {
      return undefined;
    }

    const jitter = Math.random() * 12;
    const timer = window.setTimeout(() => {
      if (color) {
        if (curColorRef.current === color && curCharRef.current === " ") {
          return;
        }

        const steps = [];
        const startIdx = curColorRef.current ? 0 : getCharIndex(curCharRef.current);
        const flipCount = 3 + Math.floor(Math.random() * 4);
        for (let i = 1; i <= flipCount; i++) {
          steps.push(CHARS[(startIdx + i) % CHARS.length]);
        }
        steps.push({ char: " ", color });

        queueRef.current = steps;
        if (!animatingRef.current) {
          processQueueRef.current();
        }
        return;
      }

      const normalizedTarget = targetChar.toUpperCase();
      const validTarget = CHARS.includes(normalizedTarget) ? normalizedTarget : " ";
      if (validTarget === curCharRef.current && !curColorRef.current) {
        return;
      }

      const startIndex = curColorRef.current ? 0 : getCharIndex(curCharRef.current);
      const endIndex = getCharIndex(validTarget);
      const steps = [];

      if (curColorRef.current) {
        steps.push({ char: " ", color: null });
      }

      if (endIndex >= startIndex) {
        for (let index = startIndex + 1; index <= endIndex; index += 1) {
          steps.push(CHARS[index]);
        }
      } else {
        for (let index = startIndex + 1; index < CHARS.length; index += 1) {
          steps.push(CHARS[index]);
        }

        for (let index = 0; index <= endIndex; index += 1) {
          steps.push(CHARS[index]);
        }
      }

      if (steps.length === 0 && !curColorRef.current) {
        steps.push(validTarget);
      }

      queueRef.current = steps;
      if (!animatingRef.current) {
        processQueueRef.current();
      }
    }, delay + jitter);

    return () => window.clearTimeout(timer);
  }, [color, delay, targetChar]);

  useEffect(() => {
    return () => {
      window.clearTimeout(flipTimerRef.current);
      window.clearTimeout(gapTimerRef.current);
    };
  }, []);

  const handleHover = () => {
    if (!hoverActive || disturbedRef.current) {
      return;
    }

    disturbedRef.current = true;

    const currentIndex = getCharIndex(curCharRef.current);
    const isColorTile = Boolean(curColorRef.current);
    const targetCharacter = targetRef.current?.toUpperCase() || " ";
    const normalizedTarget = CHARS.includes(targetCharacter) ? targetCharacter : " ";
    const targetIndex = getCharIndex(normalizedTarget);
    const targetColor = colorRef.current;
    const steps = [];

    if (isColorTile) {
      steps.push({ char: " ", color: null });
    }

    const startFrom = isColorTile ? 0 : currentIndex;
    for (let index = startFrom + 1; index < CHARS.length; index += 1) {
      steps.push(CHARS[index]);
    }

    for (let index = 0; index <= targetIndex; index += 1) {
      steps.push(CHARS[index]);
    }

    if (targetColor) {
      steps.push({ char: " ", color: targetColor });
    }

    if (steps.length === 0) {
      disturbedRef.current = false;
      return;
    }

    steps.push({ char: "__DONE__", color: null });
    queueRef.current = steps;

    if (!animatingRef.current) {
      processQueueRef.current();
    }
  };

  const activeColor = flipping ? null : currentColor;
  const queuedColor = flipping ? nextColor : currentColor;
  const visibleChar = currentChar === " " ? "\u00A0" : currentChar;
  const visibleNextChar = (flipping ? nextChar : currentChar) === " " ? "\u00A0" : flipping ? nextChar : currentChar;
  const flipStyle = {
    "--flip-dur": `${flipMs}ms`,
    "--flip-bot-delay": `${Math.round(flipMs * 0.3)}ms`,
  };

  return (
    <div
      className={`flap-unit${selected ? " is-selected" : ""}${inRange ? " is-in-range" : ""}`}
      onMouseEnter={(e) => { handleHover(); onDragOver?.(e); }}
      onMouseDown={onDragStart}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <div className={`flap-box${flipping ? " flipping" : ""}`} style={flipStyle}>
        <div className="flap bottom-new" style={queuedColor ? { background: queuedColor, filter: "brightness(0.85)" } : {}}>
          {!queuedColor && <span className="fc bc">{visibleNextChar}</span>}
        </div>
        <div className="flap top-static" style={queuedColor ? { background: queuedColor } : {}}>
          {!queuedColor && <span className="fc tc">{visibleNextChar}</span>}
        </div>
        <div className="flap bottom-old" style={activeColor ? { background: activeColor, filter: "brightness(0.85)" } : {}}>
          {!activeColor && <span className="fc bc">{visibleChar}</span>}
        </div>
        <div className="flap top-flip" style={activeColor ? { background: activeColor } : {}}>
          {!activeColor && <span className="fc tc">{visibleChar}</span>}
        </div>
        <div className="flap bottom-flip" style={queuedColor ? { background: queuedColor, filter: "brightness(0.85)" } : {}}>
          {!queuedColor && <span className="fc bc">{visibleNextChar}</span>}
        </div>
      </div>
    </div>
  );
}

function ToggleIcon({ enabled }) {
  return enabled ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function MiniBoard({ grid }) {
  return (
    <div className="mini-board">
      {grid.map((row, ri) => (
        <div className="mini-board-row" key={ri}>
          {row.map((cell, ci) => (
            <div
              key={ci}
              className="mini-board-cell"
              style={cell.color ? { background: cell.color } : undefined}
            >
              {!cell.color && cell.char !== " " ? cell.char : ""}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const QWERTY_ROWS = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  "ZXCVBNM".split(""),
];

function ComposerPanel({ cell, onClose, onPickCharacter, onPickBlank, onPickColor }) {
  return (
    <div className="composer-panel">
      <div className="composer-panel-inner">
        <div className="composer-section">
          <div className="composer-section-title"><span>Letters</span></div>
          <div className="qwerty-keyboard">
            {QWERTY_ROWS.map((row, ri) => (
              <div className="qwerty-row" key={ri}>
                {row.map((character) => (
                  <button
                    key={character}
                    className={`palette-chip${cell.char === character && !cell.color ? " active" : ""}`}
                    onClick={() => onPickCharacter(character)}
                  >
                    {character}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="composer-section">
          <div className="composer-section-title"><span>Numbers & symbols</span></div>
          <div className="palette-grid compact">
            {[" ", ...NUMBERS, ...SYMBOLS].map((character) => (
              <button
                key={character === " " ? "blank" : character}
                className={`palette-chip${cell.char === character && !cell.color ? " active" : ""}`}
                onClick={() => (character === " " ? onPickBlank() : onPickCharacter(character))}
              >
                {character === " " ? "Blank" : character}
              </button>
            ))}
          </div>
        </div>

        <div className="composer-section">
          <div className="composer-section-title"><span>Colors</span></div>
          <div className="color-palette">
            {Object.entries(COLOR_MAP).map(([key, value]) => (
              <button
                key={key}
                className={`color-picker${cell.color === value ? " active" : ""}`}
                style={{ background: value }}
                onClick={() => onPickColor(value)}
                title={key}
              >
                {key[1]}
              </button>
            ))}
          </div>
        </div>

        <button className="composer-close" onClick={onClose} aria-label="Close composer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function DigitalVestaboard() {
  const initialState = useMemo(readInitialState, []);
  const featuredScenes = useMemo(() => FEATURED_SCENES.map(buildFeaturedScene), []);
  const [grid, setGrid] = useState(initialState.grid);
  const [soundOn, setSoundOn] = useState(initialState.sound);
  const [hoverMode, setHoverMode] = useState(initialState.hover);
  const [presentMode, setPresentMode] = useState(initialState.present);
  const [savedScreens, setSavedScreens] = useState(() => readSavedScreens());
  const [activeCell, setActiveCell] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [toast, setToast] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messageMode, setMessageMode] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const isDragging = useRef(false);

  const boardRef = useRef(null);
  const savedSectionRef = useRef(null);
  const composerRef = useRef(null);

  const background = BACKGROUNDS[0];
  const { undo, redo, canUndo, canRedo } = useUndoHistory(grid, setGrid);
  const selectedCell = activeCell ? grid[activeCell.row][activeCell.col] : null;

  useEffect(() => {
    audioEngine.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    updateFullscreenState();
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const serializedState = {
      grid,
      background: "gallery-plaster",
      frame: "black",
      sound: soundOn,
      hover: hoverMode,
      present: presentMode,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedState));
    window.history.replaceState({}, "", buildShareUrl(serializedState));
  }, [grid, hoverMode, presentMode, soundOn]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SAVED_SCREENS_KEY, JSON.stringify(savedScreens));
  }, [savedScreens]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (composerOpen || activeCell) {
          event.preventDefault();
          setComposerOpen(false);
          setActiveCell(null);
          return;
        }
        if (presentMode) {
          event.preventDefault();
          setPresentMode(false);
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        const target = event.target;
        if (target instanceof HTMLElement &&
          (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) {
          return;
        }
        event.preventDefault();
        if (event.shiftKey) { redo(); } else { undo(); }
        return;
      }

      if (!activeCell) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveCell(movePosition(activeCell, 0, 1));
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveCell(movePosition(activeCell, 0, -1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCell(movePosition(activeCell, -1, 0));
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCell(movePosition(activeCell, 1, 0));
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        setActiveCell(event.shiftKey ? retreatPosition(activeCell) : advancePosition(activeCell));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        setActiveCell(nextLinePosition(activeCell));
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const range = getSelectionRange(dragStart, dragEnd);
        if (range) {
          setGrid((currentGrid) => {
            const nextGrid = cloneGrid(currentGrid);
            for (let r = range.minRow; r <= range.maxRow; r++) {
              for (let c = range.minCol; c <= range.maxCol; c++) {
                nextGrid[r][c] = createCell();
              }
            }
            return nextGrid;
          });
          setActiveCell({ row: range.minRow, col: range.minCol });
          clearSelection();
          return;
        }

        if (event.key === "Delete") {
          setGrid((currentGrid) => setGridCell(currentGrid, activeCell, createCell()));
          return;
        }

        if (selectedCell && (selectedCell.color || selectedCell.char !== " ")) {
          setGrid((currentGrid) => setGridCell(currentGrid, activeCell, createCell()));
          return;
        }

        const previousCell = retreatPosition(activeCell);
        setGrid((currentGrid) => setGridCell(currentGrid, previousCell, createCell()));
        setActiveCell(previousCell);
        return;
      }

      const character = normalizeTypedCharacter(event.key);
      if (!character) {
        return;
      }

      event.preventDefault();
      const range = getSelectionRange(dragStart, dragEnd);
      if (range) {
        setGrid((currentGrid) => {
          const nextGrid = cloneGrid(currentGrid);
          for (let r = range.minRow; r <= range.maxRow; r++) {
            for (let c = range.minCol; c <= range.maxCol; c++) {
              nextGrid[r][c] = createCell(character, null);
            }
          }
          return nextGrid;
        });
        setActiveCell({ row: range.minRow, col: range.maxCol + 1 < COLS ? range.maxCol + 1 : range.maxCol });
        clearSelection();
      } else {
        setGrid((currentGrid) => setGridCell(currentGrid, activeCell, createCell(character, null)));
        setActiveCell(advancePosition(activeCell));
      }
    };

    const handlePaste = (event) => {
      if (!activeCell) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      const pastedText = event.clipboardData?.getData("text");
      if (!pastedText) {
        return;
      }

      event.preventDefault();

      let cursor = activeCell;
      setGrid((currentGrid) => {
        const nextGrid = cloneGrid(currentGrid);

        for (const character of pastedText.replace(/\r/g, "")) {
          if (character === "\n") {
            cursor = nextLinePosition(cursor);
            continue;
          }

          const normalized = normalizeTypedCharacter(character);
          if (!normalized) {
            continue;
          }

          nextGrid[cursor.row][cursor.col] = createCell(normalized, null);
          cursor = advancePosition(cursor);
        }

        return nextGrid;
      });
      setActiveCell(cursor);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePaste);
    };
  }, [activeCell, composerOpen, presentMode, selectedCell, undo, redo, dragStart, dragEnd]);

  const selectTile = (row, col) => {
    setActiveCell({ row, col });
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
  };

  const insertCharacterAtCursor = (character) => {
    if (!activeCell) {
      return;
    }
    setGrid((currentGrid) => setGridCell(currentGrid, activeCell, createCell(character, null)));
    setActiveCell(advancePosition(activeCell));
    setComposerOpen(true);
  };

  const insertColorAtCursor = (color) => {
    if (!activeCell) {
      return;
    }
    setGrid((currentGrid) => setGridCell(currentGrid, activeCell, createCell(" ", color)));
    setActiveCell(advancePosition(activeCell));
    setComposerOpen(true);
  };

  const clearBoard = () => {
    setGrid(emptyGrid());
    setActiveCell(null);
    setComposerOpen(false);
  };

  const applyMessage = () => {
    if (!messageText.trim()) return;
    setGrid(centerMessage(messageText));
    setMessageMode(false);
    setMessageText("");
    setActiveCell(null);
    setComposerOpen(false);
    setToast("Message applied");
  };

  const loadScene = (scene) => {
    setGrid(cloneGrid(scene.grid));
    setPresentMode(false);
    setActiveCell(null);
    setComposerOpen(false);
    setToast(`${scene.name} loaded`);
  };

  const saveScreen = () => {
    const name = saveName.trim() || `Screen ${savedScreens.length + 1}`;
    const nextScreen = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      background: "gallery-plaster",
      frame: "black",
      createdAt: new Date().toISOString(),
      grid,
    };
    setSavedScreens((currentScreens) => [nextScreen, ...currentScreens].slice(0, 8));
    setSaveName("");
    setToast(`${name} saved`);
  };

  const loadSavedScreen = (screen) => {
    setGrid(cloneGrid(screen.grid));
    setPresentMode(false);
    setActiveCell(null);
    setComposerOpen(false);
    setToast(`${screen.name} loaded`);
  };

  const deleteSavedScreen = (screenId) => {
    setSavedScreens((currentScreens) => currentScreens.filter((screen) => screen.id !== screenId));
  };

  const scrollToBoard = () => {
    boardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToSaved = () => {
    savedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startEditing = () => {
    scrollToBoard();
    setActiveCell({ row: 1, col: 0 });
  };

  const handleCopyLink = async () => {
    try {
      const url = buildShareUrl({
        grid,
        background: "gallery-plaster",
        frame: "black",
        sound: soundOn,
        hover: hoverMode,
        present: true,
      });
      await navigator.clipboard.writeText(url);
      setToast("Display link copied");
    } catch {
      setToast("Clipboard unavailable");
    }
  };

  const handleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setToast("Fullscreen unavailable");
    }
  };

  const togglePresent = () => {
    setPresentMode((current) => !current);
    setComposerOpen(false);
  };

  const handleBoardBackgroundClick = (event) => {
    if (!event.target.closest(".flap-unit")) {
      setActiveCell(null);
      setComposerOpen(false);
      setDragStart(null);
      setDragEnd(null);
    }
  };

  const selectionRange = getSelectionRange(dragStart, dragEnd);

  const handleTileDragStart = (row, col) => (event) => {
    if (event.button !== 0) return;
    isDragging.current = true;
    setDragStart({ row, col });
    setDragEnd({ row, col });
    setActiveCell({ row, col });
    setComposerOpen(true);
  };

  const handleTileDragOver = (row, col) => () => {
    if (!isDragging.current) return;
    setDragEnd({ row, col });
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        if (dragStart && dragEnd && dragStart.row === dragEnd.row && dragStart.col === dragEnd.col) {
          setDragStart(null);
          setDragEnd(null);
        }
      }
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [dragStart, dragEnd]);

  const clearSelection = () => {
    setDragStart(null);
    setDragEnd(null);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!composerOpen && !activeCell) return;
      const clickedBoard = boardRef.current?.contains(event.target);
      const clickedComposer = composerRef.current?.contains(event.target);
      if (!clickedBoard && !clickedComposer) {
        setComposerOpen(false);
        setActiveCell(null);
        clearSelection();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [composerOpen, activeCell]);

  const boardContent = (
    <div className="vb-frame frame-black" onClick={handleBoardBackgroundClick}>
      <div className="vb-board-body">
        <div className="vb-board" role="img" aria-label="Interactive digital split flap board">
          {grid.map((row, rowIndex) => (
            <div className="vb-row" key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <SplitFlap
                  key={`${rowIndex}-${columnIndex}`}
                  targetChar={cell.char}
                  color={cell.color}
                  delay={columnIndex * STAGGER_COL + rowIndex * STAGGER_ROW}
                  hoverActive={hoverMode}
                  selected={activeCell?.row === rowIndex && activeCell?.col === columnIndex}
                  inRange={isInRange(rowIndex, columnIndex, selectionRange)}
                  onSelect={() => selectTile(rowIndex, columnIndex)}
                  onDragStart={handleTileDragStart(rowIndex, columnIndex)}
                  onDragOver={handleTileDragOver(rowIndex, columnIndex)}
                  label={`Row ${rowIndex + 1} column ${columnIndex + 1} ${describeCell(cell)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (presentMode) {
    return (
      <div className="app-shell is-present">
        <div className="board-stage-shell is-present" ref={boardRef}>
          <div className="board-stage-wall" style={background.css} />
          <div className="board-stage-overlay" />
          <div className="present-toolbar">
            <button className="glass-button" onClick={togglePresent}>Back to Site</button>
            <button className="glass-button" onClick={handleFullscreen}>
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button className="glass-button" onClick={handleCopyLink}>Copy Link</button>
          </div>
          <div className="board-stage-content">
            {boardContent}
          </div>
          <div className="present-exit-dock">
            <button className="present-exit-button" onClick={togglePresent}>Exit Display</button>
            <span>Press Esc to exit</span>
          </div>
        </div>
        {composerOpen && activeCell && selectedCell && (
          <div ref={composerRef}>
            <ComposerPanel
              cell={selectedCell}
              onClose={closeComposer}
              onPickCharacter={insertCharacterAtCursor}
              onPickBlank={() => insertCharacterAtCursor(" ")}
              onPickColor={insertColorAtCursor}
            />
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-nav animate-in">
        <div className="brand-lockup">
          <span className="brand-mark">FB</span>
          <strong>Flippy Bord</strong>
        </div>
        <div className="nav-actions">
          <button className="nav-link" onClick={scrollToSaved}>Screens</button>
          <button className="primary-button" onClick={startEditing}>
            <span>Start Creating</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </header>

      <main>
        <section className="hero animate-in">
          <p className="hero-eyebrow">Digital split-flap display</p>
          <h1>The board <span className="gradient-text">you can touch.</span></h1>
          <p className="hero-subtitle">Click any tile. Start typing. Watch every letter flip into place.</p>
        </section>

        <section className="board-section animate-in delay-1">
          <div className="board-stage-shell" ref={boardRef}>
            <div className="board-stage-wall" style={background.css} />
            <div className="board-stage-overlay" />
            <div className="board-stage-content">
              {boardContent}
            </div>
          </div>
        </section>

        {composerOpen && activeCell && selectedCell && (
          <div ref={composerRef}>
            <ComposerPanel
              cell={selectedCell}
              onClose={closeComposer}
              onPickCharacter={insertCharacterAtCursor}
              onPickBlank={() => insertCharacterAtCursor(" ")}
              onPickColor={insertColorAtCursor}
            />
          </div>
        )}

        {messageMode && (
          <div className="message-mode-panel animate-in">
            <div className="message-mode-inner">
              <label className="message-mode-label">Type your message (up to {ROWS} lines, {COLS} chars wide)</label>
              <textarea
                className="message-mode-textarea"
                rows={ROWS}
                maxLength={ROWS * (COLS + 1)}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={"HELLO WORLD"}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); applyMessage(); } }}
              />
              <div className="message-mode-actions">
                <button className="ghost-button" onClick={() => { setMessageMode(false); setMessageText(""); }}>Cancel</button>
                <button className="primary-button compact" onClick={applyMessage} disabled={!messageText.trim()}>Apply to Board</button>
              </div>
            </div>
          </div>
        )}

        <section className="toolbar animate-in delay-1">
          <div className="toolbar-inner">
            <div className="toolbar-group">
              <button className={`tool-btn${soundOn ? " active" : ""}`} onClick={() => setSoundOn((v) => !v)} title={soundOn ? "Mute sound" : "Enable sound"}>
                <ToggleIcon enabled={soundOn} />
              </button>
              <button className={`tool-btn${hoverMode ? " active" : ""}`} onClick={() => setHoverMode((v) => !v)} title={hoverMode ? "Disable hover effect" : "Enable hover effect"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
                </svg>
              </button>
              <span className="toolbar-sep" />
              <button className={`tool-btn${canUndo ? "" : " disabled"}`} onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
              <button className={`tool-btn${canRedo ? "" : " disabled"}`} onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
                </svg>
              </button>
              <span className="toolbar-sep" />
              <button className={`tool-btn${messageMode ? " active" : ""}`} onClick={() => setMessageMode((v) => !v)} title="Message mode">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="17" y1="10" x2="3" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="17" y1="18" x2="3" y2="18" />
                </svg>
              </button>
              <button className="tool-btn" onClick={clearBoard} title="Clear board">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
            <div className="toolbar-group save-group">
              <input
                className="toolbar-input"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Scene name..."
                onKeyDown={(event) => { if (event.key === "Enter") saveScreen(); }}
              />
              <button className="primary-button compact" onClick={saveScreen}>Save</button>
            </div>
            <div className="toolbar-group">
              <button className="tool-btn" onClick={togglePresent} title="Enter display mode">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>
              <button className="tool-btn" onClick={handleCopyLink} title="Copy display link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
              <button className="tool-btn" onClick={handleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        <section className="scenes-section animate-in delay-2">
          <div className="section-label">Featured scenes</div>
          <div className="scenes-grid">
            {featuredScenes.map((scene) => (
              <button className="scene-card" key={scene.id} onClick={() => loadScene(scene)}>
                <strong>{scene.name}</strong>
                <span>{scene.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="features-section animate-in delay-2">
          <div className="features-grid">
            <article className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <h3>Click & type</h3>
              <p>Click any tile and start typing. Characters advance automatically with satisfying mechanical flip animations.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h3>Display ready</h3>
              <p>Switch to display mode and go fullscreen. Your board becomes clean signage for TVs, lobbies, and events.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </div>
              <h3>Save & share</h3>
              <p>Save your boards locally. Build a collection for home rituals, restaurant menus, event signage, and more.</p>
            </article>
          </div>
        </section>

        <section className="saved-section animate-in delay-3" ref={savedSectionRef}>
          <div className="saved-header">
            <h2>Saved Screens</h2>
            <button className="ghost-button" onClick={scrollToBoard}>Back to Board</button>
          </div>
          {savedScreens.length === 0 ? (
            <div className="empty-state">
              <p>No saved screens yet. Create a board and save it to start collecting scenes.</p>
            </div>
          ) : (
            <div className="saved-grid">
              {savedScreens.map((screen) => (
                <article className="saved-card saved-card-clickable" key={screen.id} onClick={(e) => { if (!e.target.closest(".saved-card-actions")) loadSavedScreen(screen); }}>
                  <div className="saved-card-head">
                    <div>
                      <strong>{screen.name}</strong>
                      <span>{formatTimestamp(screen.createdAt)}</span>
                    </div>
                    <div className="saved-card-actions">
                      <button className="mini-btn" onClick={() => loadSavedScreen(screen)}>Load</button>
                      <button className="mini-btn destructive" onClick={() => deleteSavedScreen(screen.id)}>Delete</button>
                    </div>
                  </div>
                  <MiniBoard grid={screen.grid} />
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <span className="footer-brand">Flippy Bord</span>
          <span className="footer-sep">&middot;</span>
          <span className="footer-text">Digital split-flap display</span>
        </div>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
