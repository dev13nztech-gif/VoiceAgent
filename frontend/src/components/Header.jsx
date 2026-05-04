import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                fill="currentColor"
              />
              <path
                d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className={styles.logoText}>VoiceAgent</span>
        </div>

        <nav className={styles.nav}>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className={styles.navLink}
          >
            API Docs
          </a>
          <a
            href="https://github.com/SYSTRAN/faster-whisper"
            target="_blank"
            rel="noreferrer"
            className={styles.navLink}
          >
            faster-whisper
          </a>
        </nav>
      </div>
    </header>
  );
}
