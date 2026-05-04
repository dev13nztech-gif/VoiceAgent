import { useState, useRef, useCallback } from "react";
import styles from "./AudioUploader.module.css";

const ACCEPTED = ".mp3,.wav,.m4a,.ogg,.webm,.flac,.aac,.opus,.wma";

export default function AudioUploader({ onTranscribe, onReset, status, progress }) {
  const [dragOver, setDragOver] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const isActive = status === "uploading" || status === "processing";

  const setFile = (file) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    onReset();
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setFile(file);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setFile(file);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleSubmit = () => {
    if (audioFile && !isActive) {
      onTranscribe(audioFile, audioFile.name);
    }
  };

  const handleClear = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(null);
    setAudioUrl(null);
    onReset();
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const formatSize = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className={styles.wrapper}>
      {!audioFile ? (
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dragOver : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !recording && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            onChange={handleFileChange}
            className={styles.fileInput}
          />

          <div className={styles.dropContent}>
            {recording ? (
              <>
                <div className={styles.recordingPulse}>
                  <div className={styles.recordingDot} />
                </div>
                <p className={styles.recordingLabel}>Recording — {formatTime(recordSeconds)}</p>
                <button
                  className={styles.stopBtn}
                  onClick={(e) => { e.stopPropagation(); stopRecording(); }}
                >
                  Stop Recording
                </button>
              </>
            ) : (
              <>
                <div className={styles.uploadIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className={styles.dropLabel}>
                  Drop an audio file here, or <span className={styles.browseLink}>browse</span>
                </p>
                <p className={styles.dropHint}>MP3, WAV, M4A, OGG, FLAC, WEBM, AAC · up to any size</p>
                <div className={styles.orDivider}><span>or</span></div>
                <button
                  className={styles.micBtn}
                  onClick={(e) => { e.stopPropagation(); startRecording(); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="currentColor" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Record from Microphone
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.fileCard}>
          <div className={styles.fileInfo}>
            <div className={styles.fileIconWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div className={styles.fileMeta}>
              <span className={styles.fileName}>{audioFile.name}</span>
              <span className={styles.fileSize}>{formatSize(audioFile.size)}</span>
            </div>
            {!isActive && (
              <button className={styles.clearBtn} onClick={handleClear} title="Remove file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {audioUrl && (
            <audio controls src={audioUrl} className={styles.player} />
          )}

          {isActive && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className={styles.progressLabel}>
                {status === "uploading" ? "Uploading…" : "Transcribing with Whisper…"}
              </span>
            </div>
          )}

          {!isActive && status !== "done" && (
            <button className={styles.transcribeBtn} onClick={handleSubmit}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
              </svg>
              Transcribe
            </button>
          )}

          {status === "done" && !isActive && (
            <button className={styles.againBtn} onClick={handleClear}>
              Transcribe another file
            </button>
          )}
        </div>
      )}
    </div>
  );
}
