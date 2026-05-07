import { useState, useEffect } from "react";
import styles from "./ModelSelector.module.css";

// Metadata for every possible model — only downloaded ones are rendered.
const MODEL_META = {
  tiny:       { label: "Tiny",     desc: "~39M params · fastest · lower accuracy" },
  base:       { label: "Base",     desc: "~74M params · fast · good accuracy" },
  small:      { label: "Small",    desc: "~244M params · balanced" },
  medium:     { label: "Medium",   desc: "~769M params · high accuracy" },
  "large-v2": { label: "Large v2", desc: "~1.5B params · best quality (stable)" },
  "large-v3": { label: "Large v3", desc: "~1.5B params · latest · best quality" },
};

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "bn",   label: "Bengali (বাংলা)" },
  { value: "en",   label: "English" },
  { value: "hi",   label: "Hindi (हिन्दी)" },
  { value: "ar",   label: "Arabic" },
  { value: "zh",   label: "Chinese" },
  { value: "de",   label: "German" },
  { value: "es",   label: "Spanish" },
  { value: "fr",   label: "French" },
  { value: "ja",   label: "Japanese" },
  { value: "ko",   label: "Korean" },
  { value: "pt",   label: "Portuguese" },
  { value: "ru",   label: "Russian" },
  { value: "it",   label: "Italian" },
  { value: "nl",   label: "Dutch" },
  { value: "pl",   label: "Polish" },
  { value: "tr",   label: "Turkish" },
  { value: "id",   label: "Indonesian" },
  { value: "sv",   label: "Swedish" },
  { value: "uk",   label: "Ukrainian" },
];

export default function ModelSelector({
  model,
  onModelChange,
  language,
  onLanguageChange,
  disabled,
}) {
  const [availableModels, setAvailableModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Fetch the list of downloaded models from the backend on mount.
  useEffect(() => {
    fetch("/api/models")
      .then((r) => {
        if (!r.ok) throw new Error("models endpoint error");
        return r.json();
      })
      .then((data) => {
        setAvailableModels(data.models ?? []);
        // If the currently selected model isn't in the downloaded set,
        // switch to the server-recommended default.
        if (data.models && !data.models.includes(model)) {
          onModelChange(data.default ?? data.models[0]);
        }
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMeta = MODEL_META[model];

  return (
    <div className={styles.wrapper}>
      {/* ── Whisper Model ── */}
      <div className={styles.group}>
        <label className={styles.label}>Whisper Model</label>

        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.spinner} />
            <span className={styles.loadingText}>Detecting available models…</span>
          </div>
        )}

        {fetchError && !loading && (
          <p className={styles.errorText}>
            Could not load model list — backend may still be starting up.
          </p>
        )}

        {!loading && !fetchError && (
          <>
            <div className={styles.modelGrid}>
              {availableModels.map((m) => (
                <button
                  key={m}
                  className={`${styles.modelBtn} ${model === m ? styles.active : ""}`}
                  onClick={() => onModelChange(m)}
                  disabled={disabled}
                  title={MODEL_META[m]?.desc ?? m}
                >
                  {MODEL_META[m]?.label ?? m}
                </button>
              ))}
            </div>

            {selectedMeta && (
              <p className={styles.modelDesc}>{selectedMeta.desc}</p>
            )}
          </>
        )}
      </div>

      <div className={styles.divider} />

      {/* ── Language ── */}
      <div className={styles.group}>
        <label className={styles.label} htmlFor="lang-select">
          Language
        </label>
        <select
          id="lang-select"
          className={styles.select}
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={disabled}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p className={styles.modelDesc}>
          Auto-detect identifies the spoken language automatically.
        </p>
      </div>
    </div>
  );
}
