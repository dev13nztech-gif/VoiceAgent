import { useState, useCallback } from "react";
import Header from "./components/Header";
import AudioUploader from "./components/AudioUploader";
import TranscriptionResult from "./components/TranscriptionResult";
import ModelSelector from "./components/ModelSelector";
import TextToSpeech from "./components/TextToSpeech";
import styles from "./App.module.css";

const API_BASE = "/api";

export default function App() {
  // ── Tab ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("stt"); // "stt" | "tts"

  // ── STT state ─────────────────────────────────────────────────────────────
  const [model, setModel] = useState("medium");
  const [language, setLanguage] = useState("auto");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  // ── TTS state (text to pass to the TTS tab) ───────────────────────────────
  const [ttsText, setTtsText] = useState("");

  // ── STT handlers ──────────────────────────────────────────────────────────
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

  // Send transcription text to TTS tab
  const handleSendToTTS = (text) => {
    setTtsText(text);
    setActiveTab("tts");
  };

  return (
    <div className={styles.app}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>

          {/* ── Page title ── */}
          <div className={styles.intro}>
            <h1 className={styles.title}>VoiceAgent</h1>
            <p className={styles.subtitle}>
              Speech to Text · Text to Speech — powered by Whisper, runs 100% on your machine.
            </p>
          </div>

          {/* ── Tab bar ── */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "stt" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("stt")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="currentColor"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Speech → Text
            </button>
            <button
              className={`${styles.tab} ${activeTab === "tts" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("tts")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              Text → Speech
            </button>
          </div>

          {/* ── STT tab ── */}
          {activeTab === "stt" && (
            <>
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

              {result && (
                <TranscriptionResult
                  result={result}
                  onSendToTTS={handleSendToTTS}
                />
              )}
            </>
          )}

          {/* ── TTS tab ── */}
          {activeTab === "tts" && (
            <TextToSpeech key={ttsText} initialText={ttsText} />
          )}

        </div>
      </main>

      <footer className={styles.footer}>
        <p>
          VoiceAgent · Powered by{
          }
          <a href="https://github.com/SYSTRAN/faster-whisper" target="_blank" rel="noreferrer">
            faster-whisper
          </a>{
          } · 100% local
        </p>
      </footer>
    </div>
  );
}
