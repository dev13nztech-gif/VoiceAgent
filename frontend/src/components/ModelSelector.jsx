import styles from "./ModelSelector.module.css";

const MODELS = [
  { value: "tiny",     label: "Tiny",     desc: "~39M params · fastest · lower accuracy" },
  { value: "base",     label: "Base",     desc: "~74M params · fast · good accuracy" },
  { value: "small",    label: "Small",    desc: "~244M params · balanced" },
  { value: "medium",   label: "Medium",   desc: "~769M params · high accuracy · slower" },
  { value: "large-v2", label: "Large v2", desc: "~1.5B params · best quality" },
  { value: "large-v3", label: "Large v3", desc: "~1.5B params · latest · best quality" },
];

const LANGUAGES = [
  { value: "auto",  label: "Auto-detect" },
  { value: "en",    label: "English" },
  { value: "zh",    label: "Chinese" },
  { value: "de",    label: "German" },
  { value: "es",    label: "Spanish" },
  { value: "ru",    label: "Russian" },
  { value: "fr",    label: "French" },
  { value: "ja",    label: "Japanese" },
  { value: "pt",    label: "Portuguese" },
  { value: "ko",    label: "Korean" },
  { value: "ar",    label: "Arabic" },
  { value: "hi",    label: "Hindi" },
  { value: "it",    label: "Italian" },
  { value: "nl",    label: "Dutch" },
  { value: "pl",    label: "Polish" },
  { value: "tr",    label: "Turkish" },
  { value: "bn",    label: "Bengali" },
  { value: "id",    label: "Indonesian" },
  { value: "sv",    label: "Swedish" },
  { value: "uk",    label: "Ukrainian" },
];

export default function ModelSelector({ model, onModelChange, language, onLanguageChange, disabled }) {
  const selected = MODELS.find((m) => m.value === model);

  return (
    <div className={styles.wrapper}>
      <div className={styles.group}>
        <label className={styles.label}>Whisper Model</label>
        <div className={styles.modelGrid}>
          {MODELS.map((m) => (
            <button
              key={m.value}
              className={`${styles.modelBtn} ${model === m.value ? styles.active : ""}`}
              onClick={() => onModelChange(m.value)}
              disabled={disabled}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>
        {selected && (
          <p className={styles.modelDesc}>{selected.desc}</p>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <label className={styles.label} htmlFor="lang-select">Language</label>
        <select
          id="lang-select"
          className={styles.select}
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={disabled}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <p className={styles.modelDesc}>
          Auto-detect identifies the spoken language automatically.
        </p>
      </div>
    </div>
  );
}
