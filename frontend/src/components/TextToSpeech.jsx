import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./TextToSpeech.module.css";

const MAX_CHARS = 5000;

// Same set the STT panel exposes — keep them in sync so Bangla is reachable
// from both tabs without surprises.
const LANGUAGES = [
  { value: "",   label: "All languages" },
  { value: "bn", label: "Bengali (বাংলা)" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिन्दी)" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "tr", label: "Turkish" },
  { value: "id", label: "Indonesian" },
  { value: "sv", label: "Swedish" },
  { value: "uk", label: "Ukrainian" },
];

const LANG_LABEL = Object.fromEntries(LANGUAGES.map((l) => [l.value, l.label]));

// Chrome cuts off long utterances; splitting by sentence avoids the bug.
function splitIntoChunks(text, maxWords = 180) {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).split(/\s+/).length > maxWords) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

const isSynthSupported = "speechSynthesis" in window;

export default function TextToSpeech({ initialText = "", initialLang = "" }) {
  const [text, setText] = useState(initialText);
  const [voices, setVoices] = useState([]);
  const [lang, setLang] = useState(initialLang);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [status, setStatus] = useState("idle"); // idle | speaking | paused
  const synth = isSynthSupported ? window.speechSynthesis : null;

  // --- Voice loading ---------------------------------------------------------
  useEffect(() => {
    if (!synth) return;
    const load = () => {
      const v = synth.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  // Sync external props (e.g. from a transcription result)
  useEffect(() => { if (initialText) setText(initialText); }, [initialText]);
  useEffect(() => { if (initialLang) setLang(initialLang); }, [initialLang]);

  // Voices that match the selected language (prefix match: "bn" matches
  // "bn-IN", "bn-BD" etc).  Empty `lang` means "show all".
  const filteredVoices = useMemo(() => {
    if (!lang) return voices;
    const l = lang.toLowerCase();
    return voices.filter((v) => (v.lang || "").toLowerCase().startsWith(l));
  }, [voices, lang]);

  // Whenever the filtered list changes, make sure the selected voice is still
  // valid; if not, default to the first available voice (or English fallback).
  useEffect(() => {
    if (filteredVoices.length === 0) {
      setVoiceURI("");
      return;
    }
    const stillValid = filteredVoices.some((v) => v.voiceURI === voiceURI);
    if (!stillValid) {
      const def =
        filteredVoices.find((v) => v.default) ||
        filteredVoices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
        filteredVoices[0];
      setVoiceURI(def.voiceURI);
    }
  }, [filteredVoices]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Playback --------------------------------------------------------------
  const speak = useCallback(() => {
    if (!synth || !text.trim()) return;
    synth.cancel();

    const voice = voices.find((v) => v.voiceURI === voiceURI);
    const chunks = splitIntoChunks(text);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      if (voice) u.voice = voice;
      // Hint the engine what language to use — helps prosody & fallback.
      if (voice?.lang) u.lang = voice.lang;
      else if (lang) u.lang = lang;
      u.rate = rate;
      u.pitch = pitch;
      if (i === 0) u.onstart = () => setStatus("speaking");
      if (i === chunks.length - 1) {
        u.onend = () => setStatus("idle");
        u.onerror = () => setStatus("idle");
      }
      synth.speak(u);
    });
  }, [synth, text, voices, voiceURI, lang, rate, pitch]);

  const pause = () => { synth?.pause(); setStatus("paused"); };
  const resume = () => { synth?.resume(); setStatus("speaking"); };
  const stop = () => { synth?.cancel(); setStatus("idle"); };

  const isSpeaking = status === "speaking";
  const isPaused  = status === "paused";
  const isActive  = isSpeaking || isPaused;

  // Group filtered voices by full lang tag for <optgroup>
  const voicesByLang = filteredVoices.reduce((acc, v) => {
    const l = v.lang || "Unknown";
    (acc[l] = acc[l] || []).push(v);
    return acc;
  }, {});
  const sortedLangs = Object.keys(voicesByLang).sort();

  // --- Not supported guard --------------------------------------------------
  if (!isSynthSupported) {
    return (
      <div className={styles.unsupported}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
        </svg>
        <p>Text-to-speech is not supported in this browser.</p>
        <p className={styles.unsupportedHint}>Try Chrome, Edge, or Safari for full support.</p>
      </div>
    );
  }

  const noVoiceForLang = lang && voices.length > 0 && filteredVoices.length === 0;

  return (
    <div className={styles.card}>

      {/* ── Textarea ── */}
      <div className={styles.textareaWrap}>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Type or paste text here to convert to speech…"
          disabled={isActive}
          rows={7}
        />
        <div className={styles.textareaFooter}>
          <button
            className={styles.clearBtn}
            onClick={() => setText("")}
            disabled={isActive || !text}
            title="Clear text"
          >
            Clear
          </button>
          <span className={`${styles.charCount} ${text.length > MAX_CHARS * 0.9 ? styles.charCountWarn : ""}`}>
            {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className={styles.controls}>

        {/* Language filter */}
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Language</label>
          <select
            className={styles.select}
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={isActive}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value || "all"} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Voice selector */}
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Voice</label>

          {voices.length === 0 ? (
            <p className={styles.hint}>Loading voices…</p>
          ) : noVoiceForLang ? (
            <p className={styles.hint} style={{ color: "var(--warning, #f59e0b)" }}>
              No system voice installed for {LANG_LABEL[lang] ?? lang}.
              {lang === "bn" && (
                <>
                  {" "}On Windows, install via <em>Settings → Time &amp; language → Language → Add a language → বাংলা</em>.
                  On Android/Chrome OS, Google&nbsp;TTS supports Bangla out of the box.
                </>
              )}
            </p>
          ) : (
            <select
              className={styles.select}
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
              disabled={isActive}
            >
              {sortedLangs.map((l) => (
                <optgroup key={l} label={l}>
                  {voicesByLang[l].map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}{v.default ? " ★" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>

        {/* Speed + Pitch sliders */}
        <div className={styles.sliders}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              Speed <span className={styles.sliderVal}>{rate.toFixed(1)}×</span>
            </label>
            <input
              type="range" min="0.5" max="2" step="0.1"
              value={rate}
              onChange={(e) => setRate(+e.target.value)}
              className={styles.slider}
              disabled={isActive}
            />
            <div className={styles.sliderTicks}>
              <span>Slow</span><span>Normal</span><span>Fast</span>
            </div>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              Pitch <span className={styles.sliderVal}>{pitch.toFixed(1)}</span>
            </label>
            <input
              type="range" min="0.5" max="2" step="0.1"
              value={pitch}
              onChange={(e) => setPitch(+e.target.value)}
              className={styles.slider}
              disabled={isActive}
            />
            <div className={styles.sliderTicks}>
              <span>Low</span><span>Normal</span><span>High</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Playback bar ── */}
      <div className={styles.playbar}>
        {isSpeaking && (
          <div className={styles.waveform} aria-label="Speaking">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.waveBar} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
            <span className={styles.waveLabel}>Speaking…</span>
          </div>
        )}
        {isPaused && (
          <span className={styles.pausedLabel}>⏸ Paused</span>
        )}

        <div className={styles.buttons}>
          {!isSpeaking && !isPaused && (
            <button
              className={styles.playBtn}
              onClick={speak}
              disabled={!text.trim() || filteredVoices.length === 0}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Speak
            </button>
          )}

          {isSpeaking && (
            <button className={styles.pauseBtn} onClick={pause}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
              Pause
            </button>
          )}

          {isPaused && (
            <button className={styles.playBtn} onClick={resume}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
            </button>
          )}

          {isActive && (
            <button className={styles.stopBtn} onClick={stop}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}