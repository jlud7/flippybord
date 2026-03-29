import { useEffect, useMemo, useRef, useState } from "react";

const ROWS = 6;
const COLS = 22;
const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$()-+&=;:'\"%,./?°".split("");
const COLOR_MAP = {
  "{R}": "#E8342C",
  "{O}": "#EF7D24",
  "{Y}": "#F5C829",
  "{G}": "#49A347",
  "{B}": "#2F73E0",
  "{V}": "#8B3FB8",
  "{W}": "#EEEAE2",
};
const COLOR_KEYS = Object.keys(COLOR_MAP);
const STAGGER_COL = 32;
const STAGGER_ROW = 50;
const DEFAULT_MESSAGE = "FLIPPY BORD\n{W}{W}{W}{W}{W}{W}{W}{W}{W}{W}\nREADY TO DISPLAY";

const BACKGROUNDS = [
  {
    id: "gallery-plaster",
    label: "Gallery Plaster",
    css: {
      background:
        "radial-gradient(circle at top, rgba(255,255,255,0.22), transparent 28%), linear-gradient(180deg, #f0e4d3 0%, #ddcfba 100%)",
    },
  },
  {
    id: "white-brick",
    label: "White Brick",
    css: {
      backgroundColor: "#e2ded6",
      backgroundImage:
        "repeating-linear-gradient(0deg, transparent, transparent 29px, #ccc8c0 29px, #ccc8c0 31px), repeating-linear-gradient(90deg, transparent, transparent 59px, #ccc8c0 59px, #ccc8c0 61px)",
      backgroundSize: "122px 31px",
    },
  },
  {
    id: "dark-wall",
    label: "Dark Wall",
    css: {
      background:
        "radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 26%), linear-gradient(170deg, #171717 0%, #0a0a0a 100%)",
    },
  },
  {
    id: "walnut",
    label: "Walnut",
    css: {
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 20%), repeating-linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 2px, transparent 2px, transparent 84px), linear-gradient(175deg, #4a3728 0%, #3d2e22 40%, #332518 100%)",
    },
  },
  {
    id: "concrete",
    label: "Concrete",
    css: {
      background:
        "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 24%), linear-gradient(180deg, #979289 0%, #8a857e 100%)",
    },
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

function getCharIndex(character) {
  const matchIndex = CHARS.indexOf(character.toUpperCase());
  return matchIndex >= 0 ? matchIndex : 0;
}

function emptyGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ char: " ", color: null })),
  );
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

      for (const key of COLOR_KEYS) {
        if (line.slice(cursor, cursor + key.length).toUpperCase() === key) {
          colorToken = key;
          break;
        }
      }

      if (colorToken) {
        tokens.push({ char: " ", color: COLOR_MAP[colorToken] });
        cursor += colorToken.length;
      } else {
        tokens.push({ char: line[cursor], color: null });
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

function formatTimePreset() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function parseBoolean(value, fallback = false) {
  if (value === null) {
    return fallback;
  }

  return value === "1" || value === "true";
}

function readStoredState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("flippybord-state");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sanitizeBackground(id) {
  return BACKGROUNDS.some((entry) => entry.id === id) ? id : BACKGROUNDS[0].id;
}

function sanitizeFrame(value) {
  return value === "white" ? "white" : "black";
}

function readInitialState() {
  const fallback = {
    message: DEFAULT_MESSAGE,
    background: BACKGROUNDS[0].id,
    frame: "black",
    sound: true,
    hover: false,
    present: false,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const params = new URLSearchParams(window.location.search);
  const hasQueryState =
    params.has("message") ||
    params.has("bg") ||
    params.has("frame") ||
    params.has("sound") ||
    params.has("hover") ||
    params.has("display");
  const stored = readStoredState();
  const source = hasQueryState ? null : stored;

  return {
    message: params.get("message") ?? source?.message ?? fallback.message,
    background: sanitizeBackground(params.get("bg") ?? source?.background ?? fallback.background),
    frame: sanitizeFrame(params.get("frame") ?? source?.frame ?? fallback.frame),
    sound: parseBoolean(params.get("sound"), source?.sound ?? fallback.sound),
    hover: parseBoolean(params.get("hover"), source?.hover ?? fallback.hover),
    present: parseBoolean(params.get("display"), source?.present ?? fallback.present),
  };
}

function buildShareUrl({ message, background, frame, sound, hover, present }) {
  const url = new URL(window.location.href);
  url.searchParams.set("message", message);
  url.searchParams.set("bg", background);
  url.searchParams.set("frame", frame);
  url.searchParams.set("sound", sound ? "1" : "0");
  url.searchParams.set("hover", hover ? "1" : "0");
  url.searchParams.set("display", present ? "1" : "0");
  return url.toString();
}

function SplitFlap({ targetChar, delay, color, hoverActive }) {
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
    <div className="flap-unit" onMouseEnter={handleHover}>
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

export default function DigitalVestaboard() {
  const initialState = useMemo(readInitialState, []);
  const [displayText, setDisplayText] = useState(initialState.message);
  const [inputText, setInputText] = useState(initialState.message);
  const [bgId, setBgId] = useState(initialState.background);
  const [frameStyle, setFrameStyle] = useState(initialState.frame);
  const [soundOn, setSoundOn] = useState(initialState.sound);
  const [hoverMode, setHoverMode] = useState(initialState.hover);
  const [presentMode, setPresentMode] = useState(initialState.present);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef(null);

  const grid = useMemo(() => centerMessage(displayText), [displayText]);
  const background = BACKGROUNDS.find((entry) => entry.id === bgId) || BACKGROUNDS[0];
  const isDarkWall = ["dark-wall", "walnut"].includes(bgId);
  const colorEntries = Object.entries(COLOR_MAP);

  const presets = useMemo(
    () => [
      { label: "WELCOME", text: "WELCOME HOME\nJAMES" },
      { label: "STATUS", text: "SYSTEM STATUS\n{G}{G}{G}{G}{G}{G}{G}{G}\nALL SYSTEMS GO" },
      { label: "QUOTE", text: "THE BEST WAY TO\nPREDICT THE FUTURE\nIS TO BUILD IT" },
      {
        label: "RAINBOW",
        text: "{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{V}\n{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}\n{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}\n{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}\n{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}\n{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}{G}{B}{V}{R}{O}{Y}",
      },
      { label: "TIME", text: formatTimePreset, dynamic: true },
    ],
    [],
  );

  useEffect(() => {
    audioEngine.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (editMode && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editMode]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    updateFullscreenState();
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    if (!presentMode) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPresentMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [presentMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const serializedState = {
      message: displayText,
      background: bgId,
      frame: frameStyle,
      sound: soundOn,
      hover: hoverMode,
      present: presentMode,
    };

    window.localStorage.setItem("flippybord-state", JSON.stringify(serializedState));
    window.history.replaceState({}, "", buildShareUrl(serializedState));
  }, [bgId, displayText, frameStyle, hoverMode, presentMode, soundOn]);

  const handleSend = () => {
    setDisplayText(inputText);
    setEditMode(false);
  };

  const handleClear = () => {
    setDisplayText("");
    setInputText("");
    setEditMode(false);
  };

  const handlePreset = (preset) => {
    const nextText = preset.dynamic ? preset.text() : preset.text;
    setDisplayText(nextText);
    setInputText(nextText);
    setEditMode(false);
  };

  const handleCopyLink = async () => {
    try {
      const url = buildShareUrl({
        message: displayText,
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
    setEditMode(false);
  };

  return (
    <div className={`app-shell${presentMode ? " is-present" : ""}`}>
      <div className="ambient-glow ambient-glow-left" />
      <div className="ambient-glow ambient-glow-right" />

      {!presentMode && (
        <header className="app-header">
          <div>
            <p className="eyebrow">Digital split-flap display</p>
            <h1>Flippy Bord</h1>
            <p className="lede">
              A Vestaboard-inspired browser display with responsive layouts, presentation mode, and shareable state for TV, phone, or desktop screens.
            </p>
          </div>
        </header>
      )}

      <main className="studio-shell">
        <section className="studio-stage">
          <div className="stage-wall" style={background.css} />
          <div className="stage-content">
            {presentMode && (
              <div className="present-toolbar">
                <button className="ghost-button" onClick={togglePresentMode}>
                  Back to Studio
                </button>
                <button className="ghost-button" onClick={handleFullscreenToggle}>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
                <button className="ghost-button" onClick={handleCopyLink}>
                  Copy Link
                </button>
              </div>
            )}

            {presentMode && (
              <div className="present-exit-dock">
                <button className="present-exit-button" onClick={togglePresentMode}>
                  Back to Studio
                </button>
                <span>Press Esc on desktop to leave display mode.</span>
              </div>
            )}

            <div className={`vb-frame frame-${frameStyle}`}>
              <div className="vb-board-body">
                <div className="vb-board" role="img" aria-label="Digital split flap display">
                  {grid.map((row, rowIndex) => (
                    <div className="vb-row" key={rowIndex}>
                      {row.map((cell, columnIndex) => (
                        <SplitFlap
                          key={`${rowIndex}-${columnIndex}`}
                          targetChar={cell.char}
                          color={cell.color}
                          delay={columnIndex * STAGGER_COL + rowIndex * STAGGER_ROW}
                          hoverActive={hoverMode}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!presentMode && (
              <div className="stage-caption">
                <span>{COLS} columns</span>
                <span>{ROWS} rows</span>
                <span>Shareable display link</span>
              </div>
            )}
          </div>
        </section>

        {!presentMode && (
          <aside className="control-panel">
            <section className="panel-card panel-intro">
              <div className="panel-copy">
                <p className="eyebrow">Studio</p>
                <h2>Compose once, open anywhere.</h2>
                <p>
                  Use <strong>Display Mode</strong> for a clean presentation screen. <strong>Copy Display Link</strong> creates a URL that opens the same board state without the editor chrome.
                </p>
              </div>
              <div className="action-grid">
                <button className="primary-button" onClick={() => setEditMode(true)}>
                  Compose
                </button>
                <button className="secondary-button" onClick={togglePresentMode}>
                  Display Mode
                </button>
                <button className="secondary-button" onClick={handleCopyLink}>
                  Copy Display Link
                </button>
                <button className="secondary-button" onClick={handleFullscreenToggle}>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
              </div>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <h3>Quick presets</h3>
                <button className="mini-button" onClick={handleClear}>
                  Clear
                </button>
              </div>
              <div className="preset-grid">
                {presets.map((preset) => (
                  <button key={preset.label} className="chip-button" onClick={() => handlePreset(preset)}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <h3>Stage styling</h3>
              </div>
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
              <div className="toggle-row">
                <button className={`icon-toggle${soundOn ? " active" : ""}`} onClick={() => setSoundOn((current) => !current)}>
                  <ToggleIcon enabled={soundOn} />
                  <span>Mechanical sound</span>
                </button>
                <button className={`icon-toggle${hoverMode ? " active accent" : ""}`} onClick={() => setHoverMode((current) => !current)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
                  </svg>
                  <span>Hover cycle</span>
                </button>
              </div>
              <p className={`panel-note${isDarkWall ? " note-light" : ""}`}>
                Darker wall presets keep the board high-contrast for living-room and TV viewing.
              </p>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <h3>Message editor</h3>
                <span className="character-meta">
                  {ROWS} lines · {COLS} chars
                </span>
              </div>
              <textarea
                ref={textareaRef}
                className="message-input"
                rows={6}
                placeholder={`Type up to ${ROWS} lines.\nUse color tiles with ${COLOR_KEYS.join(" ")}`}
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    handleSend();
                  }
                }}
              />
              <div className="color-row">
                {colorEntries.map(([key, value]) => (
                  <button
                    key={key}
                    className="color-chip"
                    style={{ background: value }}
                    onClick={() => setInputText((current) => `${current}${key}`)}
                    title={`Insert ${key}`}
                  >
                    {key[1]}
                  </button>
                ))}
                <span className="character-meta">Tap a color tile to insert it into the message.</span>
              </div>
              <div className="editor-actions">
                <button className="secondary-button" onClick={() => setEditMode((current) => !current)}>
                  {editMode ? "Hide Editor Focus" : "Focus Editor"}
                </button>
                <button className="primary-button" onClick={handleSend}>
                  Display Message
                </button>
              </div>
            </section>
          </aside>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
