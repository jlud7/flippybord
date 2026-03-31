import { useEffect, useMemo, useRef, useState } from "react";

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
const STAGGER_COL = 32;
const STAGGER_ROW = 50;

const BACKGROUNDS = [
  {
    id: "gallery-plaster",
    label: "Gallery Plaster",
    css: {
      background:
        "radial-gradient(circle at top, rgba(255,255,255,0.25), transparent 28%), linear-gradient(180deg, #f3e3cb 0%, #dcc5a8 100%)",
    },
  },
  {
    id: "sunlit-brick",
    label: "Sunlit Brick",
    css: {
      backgroundColor: "#e9ded1",
      backgroundImage:
        "repeating-linear-gradient(0deg, transparent, transparent 27px, #cfc1b3 27px, #cfc1b3 29px), repeating-linear-gradient(90deg, transparent, transparent 55px, #cfc1b3 55px, #cfc1b3 57px)",
      backgroundSize: "114px 29px",
    },
  },
  {
    id: "night-studio",
    label: "Night Studio",
    css: {
      background:
        "radial-gradient(circle at top, rgba(255,255,255,0.06), transparent 26%), linear-gradient(170deg, #171717 0%, #090909 100%)",
    },
  },
  {
    id: "walnut-panel",
    label: "Walnut Panel",
    css: {
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 18%), repeating-linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 2px, transparent 2px, transparent 84px), linear-gradient(175deg, #4a3728 0%, #3b2b1e 40%, #2e2218 100%)",
    },
  },
  {
    id: "stone-loft",
    label: "Stone Loft",
    css: {
      background:
        "radial-gradient(circle at top, rgba(255,255,255,0.09), transparent 24%), linear-gradient(180deg, #9b958c 0%, #888178 100%)",
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
    background: "night-studio",
    frame: "black",
  },
  {
    id: "home",
    name: "Home Ritual",
    blurb: "A calmer board for kitchens, hallways, and studios.",
    message: "DINNER AT 7\nDOG WALK AT 8\nMOVIE NIGHT",
    background: "walnut-panel",
    frame: "white",
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

function sanitizeBackground(id) {
  return BACKGROUNDS.some((entry) => entry.id === id) ? id : BACKGROUNDS[0].id;
}

function sanitizeFrame(value) {
  return value === "white" ? "white" : "black";
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
  const queryPayload = decodeData(params.get("board"));
  const gridFromStoredMessage = stored?.message ? centerMessage(stored.message) : null;

  return {
    grid: sanitizeGrid(queryPayload?.grid ?? stored?.grid ?? gridFromStoredMessage ?? fallback.grid),
    background: sanitizeBackground(params.get("bg") ?? stored?.background ?? fallback.background),
    frame: sanitizeFrame(params.get("frame") ?? stored?.frame ?? fallback.frame),
    sound: parseBoolean(params.get("sound"), stored?.sound ?? fallback.sound),
    hover: parseBoolean(params.get("hover"), stored?.hover ?? fallback.hover),
    present: parseBoolean(params.get("display"), stored?.present ?? fallback.present),
  };
}

function buildShareUrl({ grid, background, frame, sound, hover, present }) {
  const url = new URL(window.location.href);
  url.searchParams.set("board", encodeData({ grid }));
  url.searchParams.set("bg", background);
  url.searchParams.set("frame", frame);
  url.searchParams.set("sound", sound ? "1" : "0");
  url.searchParams.set("hover", hover ? "1" : "0");
  url.searchParams.set("display", present ? "1" : "0");
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

function SplitFlap({ targetChar, delay, color, hoverActive, selected, onSelect, onDoubleClick, label }) {
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
  const baseDuration = useRef(130 + Math.random() * 50);
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
      const duration = Math.round(baseDuration.current + (Math.random() - 0.5) * 30);

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

        gapTimerRef.current = window.setTimeout(processQueueRef.current, 8 + Math.random() * 20);
      }, duration);
    };
  }, []);

  useEffect(() => {
    if (disturbedRef.current) {
      return undefined;
    }

    const jitter = Math.random() * 40;
    const timer = window.setTimeout(() => {
      if (color) {
        if (curColorRef.current === color && curCharRef.current === " ") {
          return;
        }

        queueRef.current = [{ char: " ", color }];
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
      className={`flap-unit${selected ? " is-selected" : ""}`}
      onMouseEnter={handleHover}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
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

function ComposerModal({ position, cell, onClose, onPickCharacter, onPickBlank, onPickColor }) {
  const positionLabel = `Row ${position.row + 1}, Tile ${position.col + 1}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="composer-modal" onClick={(event) => event.stopPropagation()}>
        <div className="composer-header">
          <div>
            <p className="eyebrow">Tile Composer</p>
            <h3>{positionLabel}</h3>
          </div>
          <button className="mini-icon-button" onClick={onClose} aria-label="Close tile composer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="composer-preview">
          <div className="composer-tile">
            <div className="composer-mini composer-mini-top" style={cell.color ? { background: cell.color } : {}}>
              {!cell.color && <span>{cell.char === " " ? "\u00A0" : cell.char}</span>}
            </div>
            <div className="composer-mini composer-mini-bottom" style={cell.color ? { background: cell.color } : {}}>
              {!cell.color && <span>{cell.char === " " ? "\u00A0" : cell.char}</span>}
            </div>
          </div>
          <div className="composer-copy">
            <strong>{describeCell(cell)}</strong>
            <span>Keyboard typing is live. Each choice advances the cursor to the next flap.</span>
          </div>
        </div>

        <div className="composer-section">
          <div className="composer-section-title">
            <span>Letters</span>
          </div>
          <div className="palette-grid letters">
            {LETTERS.map((character) => (
              <button
                key={character}
                className={`palette-chip${cell.char === character && !cell.color ? " active" : ""}`}
                onClick={() => onPickCharacter(character)}
              >
                {character}
              </button>
            ))}
          </div>
        </div>

        <div className="composer-section">
          <div className="composer-section-title">
            <span>Numbers & symbols</span>
          </div>
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
          <div className="composer-section-title">
            <span>Signal tiles</span>
          </div>
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
      </div>
    </div>
  );
}

export default function DigitalVestaboard() {
  const initialState = useMemo(readInitialState, []);
  const featuredScenes = useMemo(() => FEATURED_SCENES.map(buildFeaturedScene), []);
  const [grid, setGrid] = useState(initialState.grid);
  const [bgId, setBgId] = useState(initialState.background);
  const [frameStyle, setFrameStyle] = useState(initialState.frame);
  const [soundOn, setSoundOn] = useState(initialState.sound);
  const [hoverMode, setHoverMode] = useState(initialState.hover);
  const [presentMode, setPresentMode] = useState(initialState.present);
  const [savedScreens, setSavedScreens] = useState(() => readSavedScreens());
  const [activeCell, setActiveCell] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [toast, setToast] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const boardStageRef = useRef(null);
  const savedSectionRef = useRef(null);

  const background = BACKGROUNDS.find((entry) => entry.id === bgId) || BACKGROUNDS[0];
  const isDarkWall = ["night-studio", "walnut-panel"].includes(bgId);
  const selectedCell = activeCell ? grid[activeCell.row][activeCell.col] : null;
  const selectedLabel = activeCell ? `R${activeCell.row + 1} · C${activeCell.col + 1}` : "No tile selected";

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
      background: bgId,
      frame: frameStyle,
      sound: soundOn,
      hover: hoverMode,
      present: presentMode,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedState));
    window.history.replaceState({}, "", buildShareUrl(serializedState));
  }, [bgId, frameStyle, grid, hoverMode, presentMode, soundOn]);

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

      if (event.key === "Delete") {
        event.preventDefault();
        setGrid((currentGrid) => setGridCell(currentGrid, activeCell, createCell()));
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();

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
      setGrid((currentGrid) => setGridCell(currentGrid, activeCell, createCell(character, null)));
      setActiveCell(advancePosition(activeCell));
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
  }, [activeCell, composerOpen, presentMode, selectedCell]);

  const selectTile = (row, col) => {
    setActiveCell({ row, col });
  };

  const openComposerForTile = (row, col) => {
    setActiveCell({ row, col });
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setActiveCell(null);
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

  const loadScene = (scene) => {
    setGrid(cloneGrid(scene.grid));
    setBgId(scene.background);
    setFrameStyle(scene.frame);
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
      background: bgId,
      frame: frameStyle,
      createdAt: new Date().toISOString(),
      grid,
    };

    setSavedScreens((currentScreens) => [nextScreen, ...currentScreens].slice(0, 8));
    setSaveName("");
    setToast(`${name} saved`);
  };

  const loadSavedScreen = (screen) => {
    setGrid(cloneGrid(screen.grid));
    setBgId(sanitizeBackground(screen.background));
    setFrameStyle(sanitizeFrame(screen.frame));
    setPresentMode(false);
    setActiveCell(null);
    setComposerOpen(false);
    setToast(`${screen.name} loaded`);
  };

  const deleteSavedScreen = (screenId) => {
    setSavedScreens((currentScreens) => currentScreens.filter((screen) => screen.id !== screenId));
  };

  const scrollToBoard = () => {
    boardStageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToSavedScreens = () => {
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
        background: bgId,
        frame: frameStyle,
        sound: soundOn,
        hover: hoverMode,
        present: true,
      });
      await navigator.clipboard.writeText(url);
      setToast("Display link copied");
    } catch {
      setToast("Clipboard unavailable in this browser");
    }
  };

  const handleFullscreenToggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setToast("Fullscreen is not available here");
    }
  };

  const togglePresentMode = () => {
    setPresentMode((current) => !current);
    setComposerOpen(false);
  };

  const boardMarkup = (
    <div className={`board-stage-shell${presentMode ? " is-present" : ""}`} ref={boardStageRef}>
      <div className="board-stage-wall" style={background.css} />
      <div className="board-stage-overlay" />

      {!presentMode && (
        <>
          <div className="floating-badge floating-badge-left">Interactive demo board</div>
          <div className="floating-badge floating-badge-right">Hover mode on</div>
        </>
      )}

      {presentMode && (
        <div className="present-toolbar">
          <button className="glass-button" onClick={togglePresentMode}>
            Back to Site
          </button>
          <button className="glass-button" onClick={handleFullscreenToggle}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
          <button className="glass-button" onClick={handleCopyLink}>
            Copy Link
          </button>
        </div>
      )}

      <div className="board-stage-content">
        {!presentMode && (
          <div className="board-stage-copy">
            <p className="eyebrow">Live board editor</p>
            <h2>Click any tile. Type immediately. Save the screen when it feels right.</h2>
            <p>
              The board is the product. Every flap is clickable, keyboard capture advances tile by tile, and saved scenes let you build a library for home, retail, and events.
            </p>
          </div>
        )}

        <div className={`vb-frame frame-${frameStyle}`}>
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
                      onSelect={() => selectTile(rowIndex, columnIndex)}
                      onDoubleClick={() => openComposerForTile(rowIndex, columnIndex)}
                      label={`Row ${rowIndex + 1} column ${columnIndex + 1} ${describeCell(cell)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {!presentMode && (
          <div className="board-instruction-bar">
            <span>{selectedLabel}</span>
            {activeCell ? (
              <>
                <span>Type to enter characters. Arrow keys to navigate.</span>
                <span className="instruction-action" onClick={() => setComposerOpen(true)} role="button" tabIndex={0}>Open Tile Picker</span>
              </>
            ) : (
              <span>Click any tile to start typing</span>
            )}
          </div>
        )}
      </div>

      {presentMode && (
        <div className="present-exit-dock">
          <button className="present-exit-button" onClick={togglePresentMode}>
            Back to Site
          </button>
          <span>Press Esc to exit display mode.</span>
        </div>
      )}
    </div>
  );

  if (presentMode) {
    return (
      <div className="app-shell is-present">
        {boardMarkup}
        {composerOpen && activeCell && selectedCell && (
          <ComposerModal
            position={activeCell}
            cell={selectedCell}
            onClose={closeComposer}
            onPickCharacter={insertCharacterAtCursor}
            onPickBlank={() => insertCharacterAtCursor(" ")}
            onPickColor={insertColorAtCursor}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient-glow ambient-glow-left" />
      <div className="ambient-glow ambient-glow-right" />

      <header className="site-nav animate-in">
        <div className="brand-lockup">
          <span className="brand-mark">FB</span>
          <div>
            <strong>Flippy Bord</strong>
            <span>Digital split-flap display</span>
          </div>
        </div>

        <div className="nav-actions">
          <button className="ghost-button" onClick={scrollToSavedScreens}>
            Saved Screens
          </button>
          <button className="primary-button" onClick={startEditing}>
            Start Creating
          </button>
        </div>
      </header>

      <main className="landing-shell">
        <section className="hero-grid animate-in">
          <div className="hero-copy">
            <p className="eyebrow">Vestaboard-inspired browser signage</p>
            <h1>The split-flap board <span className="gradient-text">you can touch.</span></h1>
            <p className="hero-text">
              Click any tile and start typing. Every letter flips into place with mechanical precision. No hardware required — just a browser and something worth saying.
            </p>

            <div className="hero-actions">
              <button className="primary-button" onClick={startEditing}>
                <span>Start Creating</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              <button className="secondary-button" onClick={togglePresentMode}>
                Display Mode
              </button>
            </div>

            <div className="metric-strip">
              <div className="metric-card">
                <strong>132</strong>
                <span>Clickable flaps</span>
              </div>
              <div className="metric-card">
                <strong>Inline</strong>
                <span>Click & type editing</span>
              </div>
              <div className="metric-card">
                <strong>Scenes</strong>
                <span>Save & share boards</span>
              </div>
            </div>
          </div>

          <div className="hero-board">{boardMarkup}</div>
        </section>

        <section className="studio-grid animate-in delay-1">
          <article className="panel-card panel-tall">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Control deck</p>
                <h3>Board access</h3>
              </div>
            </div>

            <div className="button-cluster">
              <button className="secondary-button" onClick={handleCopyLink}>
                Copy Display Link
              </button>
              <button className="secondary-button" onClick={handleFullscreenToggle}>
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <button className="secondary-button" onClick={clearBoard}>
                Clear Board
              </button>
              <button className="secondary-button" onClick={togglePresentMode}>
                Enter Display Mode
              </button>
            </div>

            <div className="option-stack">
              <div className="option-group">
                <span className="field-label">Wall</span>
                <div className="chip-grid">
                  {BACKGROUNDS.map((entry) => (
                    <button
                      key={entry.id}
                      className={`chip-button${bgId === entry.id ? " active" : ""}`}
                      onClick={() => setBgId(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="option-group">
                <span className="field-label">Frame</span>
                <div className="chip-grid compact">
                  <button className={`chip-button${frameStyle === "black" ? " active" : ""}`} onClick={() => setFrameStyle("black")}>
                    Black
                  </button>
                  <button className={`chip-button${frameStyle === "white" ? " active" : ""}`} onClick={() => setFrameStyle("white")}>
                    White
                  </button>
                </div>
              </div>
            </div>

            <div className="toggle-row">
              <button className={`icon-toggle${soundOn ? " active" : ""}`} onClick={() => setSoundOn((current) => !current)}>
                <ToggleIcon enabled={soundOn} />
                <span>Mechanical sound</span>
              </button>
              <button className={`icon-toggle${hoverMode ? " active accent" : ""}`} onClick={() => setHoverMode((current) => !current)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
                </svg>
                <span>Cursor hover effect</span>
              </button>
            </div>

            <p className={`panel-note${isDarkWall ? " note-light" : ""}`}>
              Click any tile and start typing. Characters advance automatically. Double-click a tile for the full picker with colors and symbols.
            </p>

            <div className="save-card">
              <div className="section-heading tight">
                <div>
                  <p className="eyebrow">Save scene</p>
                  <h3>Store this board</h3>
                </div>
              </div>
              <div className="save-row">
                <input
                  className="save-input"
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  placeholder="Night menu, launch screen, front door..."
                />
                <button className="primary-button" onClick={saveScreen}>
                  Save Screen
                </button>
              </div>
            </div>
          </article>

          <article className="panel-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Tile focus</p>
                <h3>{selectedLabel}</h3>
              </div>
            </div>

            {selectedCell ? (
              <>
                <p className="panel-note">
                  Current tile: <strong>{describeCell(selectedCell)}</strong>. Just type on your keyboard to enter characters. Arrow keys move between tiles, paste works too.
                </p>
                <div className="composer-shortcuts">
                  <button className="secondary-button" onClick={() => setComposerOpen(true)}>
                    Open Tile Picker
                  </button>
                  <button className="secondary-button" onClick={() => insertCharacterAtCursor(" ")}>
                    Insert Blank
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <strong>Click any tile to begin.</strong>
                <span>Select a tile on the board and start typing. Double-click for the full tile picker with colors and symbols.</span>
              </div>
            )}

            <div className="mini-feature-list">
              <div>
                <strong>Sequential typing</strong>
                <span>Starts from the tile you clicked.</span>
              </div>
              <div>
                <strong>Symbol support</strong>
                <span>Numbers, punctuation, and blank flaps included.</span>
              </div>
              <div>
                <strong>Signal tiles</strong>
                <span>Drop colored flaps into the composition when needed.</span>
              </div>
            </div>
          </article>

          <article className="panel-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Featured scenes</p>
                <h3>Built to sell access</h3>
              </div>
            </div>

            <div className="scene-list">
              {featuredScenes.map((scene) => (
                <div className="scene-card" key={scene.id}>
                  <div>
                    <strong>{scene.name}</strong>
                    <p>{scene.blurb}</p>
                  </div>
                  <button className="secondary-button" onClick={() => loadScene(scene)}>
                    Load Scene
                  </button>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="selling-grid animate-in delay-2">
          <article className="marketing-card">
            <div className="marketing-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <p className="eyebrow">Click & type</p>
            <h3>Direct inline editing on every tile.</h3>
            <p>
              No forms, no modals by default. Click a flap, start typing, and watch each letter flip into place with satisfying mechanical precision.
            </p>
          </article>

          <article className="marketing-card">
            <div className="marketing-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <p className="eyebrow">Display ready</p>
            <h3>From browser to big screen in one click.</h3>
            <p>
              Switch to display mode and go fullscreen. The same board you designed becomes clean signage for TVs, lobbies, and events.
            </p>
          </article>

          <article className="marketing-card">
            <div className="marketing-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            </div>
            <p className="eyebrow">Save & share</p>
            <h3>Build a library of scenes you can reload anytime.</h3>
            <p>
              Save your favorite boards locally. Build a collection for home rituals, restaurant menus, event signage, and more.
            </p>
          </article>
        </section>

        <section className="saved-shell animate-in delay-3" ref={savedSectionRef}>
          <div className="saved-header">
            <div>
              <p className="eyebrow">Saved screens</p>
              <h2>Your board library</h2>
            </div>
            <button className="ghost-button" onClick={scrollToBoard}>
              Back to Board
            </button>
          </div>

          {savedScreens.length === 0 ? (
            <div className="empty-saved">
              <strong>No saved screens yet.</strong>
              <span>Build a board above, name it, and hit Save Screen to start collecting scenes.</span>
            </div>
          ) : (
            <div className="saved-grid">
              {savedScreens.map((screen) => {
                const previewLines = getPreviewLines(screen.grid);
                return (
                  <article className="saved-card" key={screen.id}>
                    <div className="saved-card-head">
                      <div>
                        <strong>{screen.name}</strong>
                        <span>{formatTimestamp(screen.createdAt)}</span>
                      </div>
                      <div className="saved-card-actions">
                        <button className="mini-button" onClick={() => loadSavedScreen(screen)}>
                          Load
                        </button>
                        <button className="mini-button destructive" onClick={() => deleteSavedScreen(screen.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="saved-preview">
                      {previewLines.length > 0 ? previewLines.map((line) => <span key={line}>{line}</span>) : <span>Blank board</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer animate-in delay-3">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="brand-mark">FB</span>
            <span>Flippy Bord</span>
          </div>
          <p className="footer-tagline">A digital split-flap display for browsers, TVs, and phones. Click a tile, type your message, flip.</p>
          <div className="footer-links">
            <button className="footer-link" onClick={startEditing}>Start Creating</button>
            <button className="footer-link" onClick={togglePresentMode}>Display Mode</button>
            <button className="footer-link" onClick={scrollToSavedScreens}>Saved Screens</button>
          </div>
        </div>
      </footer>

      {composerOpen && activeCell && selectedCell && (
        <ComposerModal
          position={activeCell}
          cell={selectedCell}
          onClose={closeComposer}
          onPickCharacter={insertCharacterAtCursor}
          onPickBlank={() => insertCharacterAtCursor(" ")}
          onPickColor={insertColorAtCursor}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
