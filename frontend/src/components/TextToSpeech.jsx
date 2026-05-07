import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./TextToSpeech.module.css";

const MAX_CHARS = 5000;

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

export default function TextToSpeech({ initialText = "" }) {
  const [text, setText] = useState(initialText);
  const [voices, setVoices] = useState([]);
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
      if (!v.length) return;
      setVoices(v);
      setVoiceURI((prev) => {
        if (prev) return prev;
        // Prefer a default or English voice
        const def = v.find((x) => x.default) || v.find((x) => x.lang.startsWith("en")) || v[0];
        return def?.voiceURI ?? "";
      });
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  // Sync external text prop (e.g. passed from transcription result)
  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  // --- Playback --------------------------------------------------------------
  const speak = useCallback(() => {
    if (!synth || !text.trim()) return;
    synth.cancel();

    const chunks = splitIntoChunks(text);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      const voice = voices.find((v) => v.voiceURI === voiceURI);
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = pitch;
      if (i === 0) u.onstart = () => setStatus("speaking");
      if (i === chunks.length - 1) {
        u.onend = () => setStatus("idle");
        u.onerror = () => setStatus("idle");
      }
      synth.speak(u);
    });
  }, [synth, text, voices, voiceURI, rate, pitch]);

  const pause = () => { synth?.pause(); setStatus("paused"); };
  const resume = () => { synth?.resume(); setStatus("speaking"); };
  const stop = () => { synth?.cancel(); setStatus("idle"); };

  const isSpeaking = status === "speaking";
  const isPaused  = status === "paused";
  const isActive  = isSpeaking || isPaused;

  // Group voices by language code for <optgroup>
  const voicesByLang = voices.reduce((acc, v) => {
    const lang = v.lang || "Unknown";
    (acc[lang] = acc[lang] || []).push(v);
    return acc;
  }, {});
  const sortedLangs = Object.keys(voicesByLang).sort((a, b) =>
    a.startsWith("en") ? -1 : b.startsWith("en") ? 1 : a.localeCompare(b)
  );

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

        {/* Voice selector */}
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Voice</label>
          {voices.length === 0 ? (
            <p className={styles.hint}>Loading voices…</p>
          ) : (
            <select
              className={styles.select}
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
              disabled={isActive}
            >
              {sortedLangs.map((lang) => (
                <optgroup key={lang} label={lang}>
                  {voicesByLang[lang].map((v) => (
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
              disabled={!text.trim() || voices.length === 0}
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
