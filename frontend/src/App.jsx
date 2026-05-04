import { useState, useCallback } from "react";
import Header from "./components/Header";
import AudioUploader from "./components/AudioUploader";
import TranscriptionResult from "./components/TranscriptionResult";
import ModelSelector from "./components/ModelSelector";
import styles from "./App.module.css";

const API_BASE = "/api";

export default function App() {
  const [model, setModel] = useState("medium");
  const [language, setLanguage] = useState("auto");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleTranscribe = useCallback(
    async (audioBlob, filename) => {
      setStatus("uploading");
      setResult(null);
      setError(null);
      setProgress(10);

      const formData = new FormData();
      formData.append("file", audioBlob, filename);
      formData.append("model", model);
      formData.append("language", language);

      try {
        setStatus("processing");
        setProgress(40);

        const res = await fetch(`${API_BASE}/transcribe`, {
          method: "POST",
          body: formData,
        });

        setProgress(90);

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || "Transcription failed");
        }

        const data = await res.json();
        setResult(data);
        setStatus("done");
        setProgress(100);
      } catch (e) {
        setError(e.message);
        setStatus("error");
        setProgress(0);
      }
    },
    [model, language]
  );

  const handleReset = () => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className={styles.app}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.intro}>
            <h1 className={styles.title}>Speech to Text</h1>
            <p className={styles.subtitle}>
              Upload an audio file or record from your microphone. Powered by
              Whisper — runs entirely on your machine, no data leaves your device.
            </p>
          </div>

          <div className={styles.controls}>
            <ModelSelector
              model={model}
              onModelChange={setModel}
              language={language}
              onLanguageChange={setLanguage}
              disabled={status === "processing" || status === "uploading"}
            />
          </div>

          <AudioUploader
            onTranscribe={handleTranscribe}
            onReset={handleReset}
            status={status}
            progress={progress}
          />

          {error && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {result && <TranscriptionResult result={result} />}
        </div>
      </main>

      <footer className={styles.footer}>
        <p>VoiceAgent · Powered by <a href="https://github.com/SYSTRAN/faster-whisper" target="_blank" rel="noreferrer">faster-whisper</a> · 100% local</p>
      </footer>
    </div>
  );
}
