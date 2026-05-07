import { useState, useEffect } from "react";
import styles from "./TranscriptionResult.module.css";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

// Language code → { font: Google Font name, dir: text direction, gfont: URL param }
// Latin-script languages use Inter (already loaded); others get a Noto font.
const LANG_FONT = {
  // ── Latin (Inter handles these natively) ──────────────────────────────────
  en: { font: "Inter",                dir: "ltr" },
  fr: { font: "Inter",                dir: "ltr" },
  de: { font: "Inter",                dir: "ltr" },
  es: { font: "Inter",                dir: "ltr" },
  pt: { font: "Inter",                dir: "ltr" },
  it: { font: "Inter",                dir: "ltr" },
  nl: { font: "Inter",                dir: "ltr" },
  pl: { font: "Inter",                dir: "ltr" },
  sv: { font: "Inter",                dir: "ltr" },
  tr: { font: "Inter",                dir: "ltr" },
  id: { font: "Inter",                dir: "ltr" },
  ms: { font: "Inter",                dir: "ltr" },
  ro: { font: "Inter",                dir: "ltr" },
  cs: { font: "Inter",                dir: "ltr" },
  sk: { font: "Inter",                dir: "ltr" },
  hr: { font: "Inter",                dir: "ltr" },
  fi: { font: "Inter",                dir: "ltr" },
  da: { font: "Inter",                dir: "ltr" },
  no: { font: "Inter",                dir: "ltr" },
  hu: { font: "Inter",                dir: "ltr" },

  // ── Cyrillic ──────────────────────────────────────────────────────────────
  ru: { font: "Noto Sans",            dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  uk: { font: "Noto Sans",            dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  bg: { font: "Noto Sans",            dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  sr: { font: "Noto Sans",            dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  mk: { font: "Noto Sans",            dir: "ltr", gfont: "Noto+Sans:wght@400;600" },

  // ── CJK ───────────────────────────────────────────────────────────────────
  ja: { font: "Noto Sans JP",         dir: "ltr", gfont: "Noto+Sans+JP:wght@400;700" },
  zh: { font: "Noto Sans SC",         dir: "ltr", gfont: "Noto+Sans+SC:wght@400;700" },
  ko: { font: "Noto Sans KR",         dir: "ltr", gfont: "Noto+Sans+KR:wght@400;700" },

  // ── Arabic-script (RTL) ───────────────────────────────────────────────────
  ar: { font: "Noto Sans Arabic",     dir: "rtl", gfont: "Noto+Sans+Arabic:wght@400;700" },
  fa: { font: "Noto Sans Arabic",     dir: "rtl", gfont: "Noto+Sans+Arabic:wght@400;700" },
  ur: { font: "Noto Nastaliq Urdu",   dir: "rtl", gfont: "Noto+Nastaliq+Urdu:wght@400;700" },

  // ── Hebrew (RTL) ──────────────────────────────────────────────────────────
  he: { font: "Noto Sans Hebrew",     dir: "rtl", gfont: "Noto+Sans+Hebrew:wght@400;700" },
  yi: { font: "Noto Sans Hebrew",     dir: "rtl", gfont: "Noto+Sans+Hebrew:wght@400;700" },

  // ── Devanagari ────────────────────────────────────────────────────────────
  hi: { font: "Noto Sans Devanagari", dir: "ltr", gfont: "Noto+Sans+Devanagari:wght@400;700" },
  mr: { font: "Noto Sans Devanagari", dir: "ltr", gfont: "Noto+Sans+Devanagari:wght@400;700" },
  ne: { font: "Noto Sans Devanagari", dir: "ltr", gfont: "Noto+Sans+Devanagari:wght@400;700" },

  // ── Bengali ───────────────────────────────────────────────────────────────
  bn: { font: "Noto Sans Bengali",    dir: "ltr", gfont: "Noto+Sans+Bengali:wght@400;700" },

  // ── Tamil ─────────────────────────────────────────────────────────────────
  ta: { font: "Noto Sans Tamil",      dir: "ltr", gfont: "Noto+Sans+Tamil:wght@400;700" },

  // ── Telugu ────────────────────────────────────────────────────────────────
  te: { font: "Noto Sans Telugu",     dir: "ltr", gfont: "Noto+Sans+Telugu:wght@400;700" },

  // ── Kannada ───────────────────────────────────────────────────────────────
  kn: { font: "Noto Sans Kannada",    dir: "ltr", gfont: "Noto+Sans+Kannada:wght@400;700" },

  // ── Malayalam ─────────────────────────────────────────────────────────────
  ml: { font: "Noto Sans Malayalam",  dir: "ltr", gfont: "Noto+Sans+Malayalam:wght@400;700" },

  // ── Gujarati ──────────────────────────────────────────────────────────────
  gu: { font: "Noto Sans Gujarati",   dir: "ltr", gfont: "Noto+Sans+Gujarati:wght@400;700" },

  // ── Punjabi / Gurmukhi ────────────────────────────────────────────────────
  pa: { font: "Noto Sans Gurmukhi",   dir: "ltr", gfont: "Noto+Sans+Gurmukhi:wght@400;700" },

  // ── Sinhala ───────────────────────────────────────────────────────────────
  si: { font: "Noto Sans Sinhala",    dir: "ltr", gfont: "Noto+Sans+Sinhala:wght@400;700" },

  // ── Thai ──────────────────────────────────────────────────────────────────
  th: { font: "Noto Sans Thai",       dir: "ltr", gfont: "Noto+Sans+Thai:wght@400;700" },

  // ── Myanmar ───────────────────────────────────────────────────────────────
  my: { font: "Noto Sans Myanmar",    dir: "ltr", gfont: "Noto+Sans+Myanmar:wght@400;700" },

  // ── Khmer ─────────────────────────────────────────────────────────────────
  km: { font: "Noto Sans Khmer",      dir: "ltr", gfont: "Noto+Sans+Khmer:wght@400;700" },

  // ── Georgian ──────────────────────────────────────────────────────────────
  ka: { font: "Noto Sans Georgian",   dir: "ltr", gfont: "Noto+Sans+Georgian:wght@400;700" },

  // ── Armenian ──────────────────────────────────────────────────────────────
  hy: { font: "Noto Sans Armenian",   dir: "ltr", gfont: "Noto+Sans+Armenian:wght@400;700" },

  // ── Ethiopic ──────────────────────────────────────────────────────────────
  am: { font: "Noto Sans Ethiopic",   dir: "ltr", gfont: "Noto+Sans+Ethiopic:wght@400;700" },
};

const loadedFonts = new Set();

function loadGoogleFont(gfont) {
  if (!gfont || loadedFonts.has(gfont)) return;
  loadedFonts.add(gfont);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${gfont}&display=swap`;
  document.head.appendChild(link);
}

function getLangStyle(langCode) {
  const info = LANG_FONT[langCode] ?? { font: "Inter", dir: "ltr" };
  return { fontConfig: info };
}

function getLanguageName(code) {
  try {
    return LANGUAGE_NAMES.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function TranscriptionResult({ result, onSendToTTS }) {
  const [copied, setCopied] = useState(false);
  const [showSegments, setShowSegments] = useState(false);

  const { fontConfig } = getLangStyle(result.language);

  // Dynamically load the Google Font when language is detected
  useEffect(() => {
    if (fontConfig.gfont) loadGoogleFont(fontConfig.gfont);
  }, [fontConfig.gfont]);

  const transcriptStyle = {
    fontFamily: `"${fontConfig.font}", system-ui, sans-serif`,
    direction: fontConfig.dir,
    textAlign: fontConfig.dir === "rtl" ? "right" : "left",
    lineHeight: fontConfig.dir === "rtl" ? "2.1" : "1.85", // RTL scripts need more leading
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confidence = Math.round(result.language_probability * 100);

  return (
    <div className={styles.card}>
      {/* ── Meta row ── */}
      <div className={styles.meta}>
        <div className={styles.badges}>
          <span className={styles.badge}>
            <span className={styles.badgeDot} style={{ background: confidenceColor(confidence) }} />
            {getLanguageName(result.language)}
            <span className={styles.badgeSub}>{confidence}% confidence</span>
          </span>
          <span className={styles.badgePlain}>
            {formatDuration(result.duration)} audio
          </span>
          <span className={styles.badgePlain}>
            {result.processing_time_seconds}s to process
          </span>
          <span className={styles.badgePlain}>
            Whisper {result.model}
          </span>
          {fontConfig.font !== "Inter" && (
            <span className={styles.badgeFont} title={`Rendering in ${fontConfig.font}`}>
              {fontConfig.font}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          {onSendToTTS && result.text && (
            <button className={styles.ttsBtn} onClick={() => onSendToTTS(result.text)} title="Open in Text → Speech tab">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              Read aloud
            </button>
          )}
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Full transcript ── */}
      <div className={styles.transcript} style={transcriptStyle}>
        {result.text || <span className={styles.empty}>No speech detected.</span>}
      </div>

      {/* ── Segments toggle ── */}
      {result.segments?.length > 0 && (
        <div className={styles.segmentsSection}>
          <button
            className={styles.toggleBtn}
            onClick={() => setShowSegments((v) => !v)}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showSegments ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {showSegments ? "Hide" : "Show"} segments ({result.segments.length})
          </button>

          {showSegments && (
            <div className={styles.segments}>
              {result.segments.map((seg) => (
                <div key={seg.id} className={styles.segment} style={{ direction: fontConfig.dir }}>
                  <span className={styles.timestamp} style={{ direction: "ltr" }}>
                    {formatTs(seg.start)} → {formatTs(seg.end)}
                  </span>
                  <span className={styles.segText} style={{ fontFamily: `"${fontConfig.font}", system-ui, sans-serif` }}>
                    {seg.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTs(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${sec}`;
}

function confidenceColor(pct) {
  if (pct >= 85) return "#22c55e";
  if (pct >= 60) return "#f59e0b";
  return "#ef4444";
}
