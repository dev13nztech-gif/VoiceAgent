import { useState, useEffect } from "react";
import styles from "./TranscriptionResult.module.css";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

const LANG_FONT = {
  en: { font: "Inter", dir: "ltr" }, fr: { font: "Inter", dir: "ltr" },
  de: { font: "Inter", dir: "ltr" }, es: { font: "Inter", dir: "ltr" },
  pt: { font: "Inter", dir: "ltr" }, it: { font: "Inter", dir: "ltr" },
  nl: { font: "Inter", dir: "ltr" }, pl: { font: "Inter", dir: "ltr" },
  sv: { font: "Inter", dir: "ltr" }, tr: { font: "Inter", dir: "ltr" },
  id: { font: "Inter", dir: "ltr" }, ms: { font: "Inter", dir: "ltr" },
  ro: { font: "Inter", dir: "ltr" }, cs: { font: "Inter", dir: "ltr" },
  sk: { font: "Inter", dir: "ltr" }, hr: { font: "Inter", dir: "ltr" },
  fi: { font: "Inter", dir: "ltr" }, da: { font: "Inter", dir: "ltr" },
  no: { font: "Inter", dir: "ltr" }, hu: { font: "Inter", dir: "ltr" },
  ru: { font: "Noto Sans", dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  uk: { font: "Noto Sans", dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  bg: { font: "Noto Sans", dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  sr: { font: "Noto Sans", dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  mk: { font: "Noto Sans", dir: "ltr", gfont: "Noto+Sans:wght@400;600" },
  ja: { font: "Noto Sans JP",  dir: "ltr", gfont: "Noto+Sans+JP:wght@400;700" },
  zh: { font: "Noto Sans SC",  dir: "ltr", gfont: "Noto+Sans+SC:wght@400;700" },
  ko: { font: "Noto Sans KR",  dir: "ltr", gfont: "Noto+Sans+KR:wght@400;700" },
  ar: { font: "Noto Sans Arabic",     dir: "rtl", gfont: "Noto+Sans+Arabic:wght@400;700" },
  fa: { font: "Noto Sans Arabic",     dir: "rtl", gfont: "Noto+Sans+Arabic:wght@400;700" },
  ur: { font: "Noto Nastaliq Urdu",   dir: "rtl", gfont: "Noto+Nastaliq+Urdu:wght@400;700" },
  he: { font: "Noto Sans Hebrew",     dir: "rtl", gfont: "Noto+Sans+Hebrew:wght@400;700" },
  yi: { font: "Noto Sans Hebrew",     dir: "rtl", gfont: "Noto+Sans+Hebrew:wght@400;700" },
  hi: { font: "Noto Sans Devanagari", dir: "ltr", gfont: "Noto+Sans+Devanagari:wght@400;700" },
  mr: { font: "Noto Sans Devanagari", dir: "ltr", gfont: "Noto+Sans+Devanagari:wght@400;700" },
  ne: { font: "Noto Sans Devanagari", dir: "ltr", gfont: "Noto+Sans+Devanagari:wght@400;700" },
  bn: { font: "Noto Sans Bengali",    dir: "ltr", gfont: "Noto+Sans+Bengali:wght@400;700" },
  ta: { font: "Noto Sans Tamil",      dir: "ltr", gfont: "Noto+Sans+Tamil:wght@400;700" },
  te: { font: "Noto Sans Telugu",     dir: "ltr", gfont: "Noto+Sans+Telugu:wght@400;700" },
  kn: { font: "Noto Sans Kannada",    dir: "ltr", gfont: "Noto+Sans+Kannada:wght@400;700" },
  ml: { font: "Noto Sans Malayalam",  dir: "ltr", gfont: "Noto+Sans+Malayalam:wght@400;700" },
  gu: { font: "Noto Sans Gujarati",   dir: "ltr", gfont: "Noto+Sans+Gujarati:wght@400;700" },
  pa: { font: "Noto Sans Gurmukhi",   dir: "ltr", gfont: "Noto+Sans+Gurmukhi:wght@400;700" },
  si: { font: "Noto Sans Sinhala",    dir: "ltr", gfont: "Noto+Sans+Sinhala:wght@400;700" },
  th: { font: "Noto Sans Thai",       dir: "ltr", gfont: "Noto+Sans+Thai:wght@400;700" },
  my: { font: "Noto Sans Myanmar",    dir: "ltr", gfont: "Noto+Sans+Myanmar:wght@400;700" },
  km: { font: "Noto Sans Khmer",      dir: "ltr", gfont: "Noto+Sans+Khmer:wght@400;700" },
  ka: { font: "Noto Sans Georgian",   dir: "ltr", gfont: "Noto+Sans+Georgian:wght@400;700" },
  hy: { font: "Noto Sans Armenian",   dir: "ltr", gfont: "Noto+Sans+Armenian:wght@400;700" },
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

function getLanguageName(code) {
  try { return LANGUAGE_NAMES.of(code) || code.toUpperCase(); }
  catch { return code.toUpperCase(); }
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function TranscriptionResult({ result }) {
  const [copied, setCopied] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  const fontConfig = LANG_FONT[result.language] ?? { font: "Inter", dir: "ltr" };

  useEffect(() => {
    if (fontConfig.gfont) loadGoogleFont(fontConfig.gfont);
  }, [fontConfig.gfont]);

  const transcriptStyle = {
    fontFamily: `"${fontConfig.font}", system-ui, sans-serif`,
    direction: fontConfig.dir,
    textAlign: fontConfig.dir === "rtl" ? "right" : "left",
    lineHeight: fontConfig.dir === "rtl" ? "2.1" : "1.85",
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confidence = Math.round(result.language_probability * 100);

  return (
    <div className={styles.card}>
      <div className={styles.meta}>
        <div className={styles.badges}>
          <span className={styles.badge}>
            <span className={styles.badgeDot} style={{ background: confidenceColor(confidence) }} />
            {getLanguageName(result.language)}
            <span className={styles.badgeSub}>{confidence}% confidence</span>
          </span>
          <span className={styles.badgePlain}>{formatDuration(result.duration)} audio</span>
          <span className={styles.badgePlain}>{result.processing_time_seconds}s to process</span>
          <span className={styles.badgePlain}>Whisper {result.model}</span>
          {fontConfig.font !== "Inter" && (
            <span className={styles.badgeFont} title={`Rendering in ${fontConfig.font}`}>
              {fontConfig.font}
            </span>
          )}
        </div>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Copied</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy</>
          )}
        </button>
      </div>

      <div className={styles.transcript} style={transcriptStyle}>
        {result.text || <span className={styles.empty}>No speech detected.</span>}
      </div>

      {result.segments?.length > 0 && (
        <div className={styles.segmentsSection}>
          <button className={styles.toggleBtn} onClick={() => setShowSegments((v) => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showSegments ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {showSegments ? "Hide" : "Show"} segments ({result.segments.length})
          </button>
          {showSegments && (
            <div className={styles.segments}>
              {result.segments.map((seg) => (
                <div key={seg.id} className={styles.segment} style={{ direction: fontConfig.dir }}>
                  <span className={styles.timestamp} style={{ direction: "ltr" }}>{formatTs(seg.start)} → {formatTs(seg.end)}</span>
                  <span className={styles.segText} style={{ fontFamily: `"${fontConfig.font}", system-ui, sans-serif` }}>{seg.text}</span>
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
