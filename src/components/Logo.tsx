/** The Castline mark: a phone with a person in it. */
export default function Logo() {
  return (
    <a href="#/" className="wordmark" aria-label="Castline home">
      <svg viewBox="0 0 32 32" aria-hidden>
        <rect x="7" y="2" width="18" height="28" rx="5.5" fill="currentColor" />
        <circle cx="16" cy="13" r="4" fill="#fff" />
        <path d="M10 24.5c1.3-3.6 3.5-5.2 6-5.2s4.7 1.6 6 5.2" fill="#fff" />
      </svg>
      Castline
    </a>
  );
}
