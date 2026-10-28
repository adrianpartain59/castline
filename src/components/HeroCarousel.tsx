import { useMemo, useRef, useState } from "react";
import SpotPlayer from "./SpotPlayer";
import { showcaseSpecs } from "../demo/library";

/**
 * One ad, a different person every take. Advances when the ad loops, so each
 * take plays in full: the reaction, the hard cut, the app.
 */
export default function HeroCarousel() {
  const takes = useMemo(() => showcaseSpecs(), []);
  const [idx, setIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const lastT = useRef(0);
  const current = takes[idx];

  const onTime = (t: number) => {
    if (t + 0.25 < lastT.current) setIdx((i) => (i + 1) % takes.length);
    lastT.current = t;
  };
  const go = (next: number) => {
    lastT.current = 0;
    setIdx((next + takes.length) % takes.length);
  };

  return (
    <div className="hero-carousel">
      <div className="hero-stack">
        <div className="hero-ghost left" aria-hidden />
        <div className="hero-ghost right" aria-hidden />
        <SpotPlayer spec={current.spec} onTime={onTime} muted={!soundOn} className="hero-phone" />
        <button className="sound-toggle" onClick={() => setSoundOn((s) => !s)} aria-pressed={soundOn}>
          {soundOn ? "Sound on" : "Sound off"}
        </button>
      </div>
      <div className="hero-caption">
        <button className="arrow" aria-label="Previous take" onClick={() => go(idx - 1)}>‹</button>
        <div>
          <div className="who">{current.member.name}, {current.member.age}</div>
          <div className="faint take">take {current.take} of {takes.length} · same ad, different person</div>
        </div>
        <button className="arrow" aria-label="Next take" onClick={() => go(idx + 1)}>›</button>
      </div>
      <div className="dots" role="tablist">
        {takes.map((t, i) => (
          <button
            key={t.member.id}
            role="tab"
            aria-selected={i === idx}
            aria-label={`Take ${t.take}`}
            className={i === idx ? "dot on" : "dot"}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
