import { useMemo, useRef, useState } from "react";
import "./hero-phone.css";
import SpotPlayer from "./SpotPlayer";
import Portrait from "./Portrait";
import { showcaseSpecs, who } from "../demo/library";

/**
 * The hero: one ad playing on an iPhone, with the cast down its left side.
 * Each loop moves to the next person; picking one plays their take.
 */
export default function HeroPhone() {
  const takes = useMemo(() => showcaseSpecs(), []);
  const [idx, setIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const lastT = useRef(0);
  const current = takes[idx];

  const onTime = (t: number) => {
    if (t + 0.25 < lastT.current) setIdx((i) => (i + 1) % takes.length);
    lastT.current = t;
  };
  const pick = (i: number) => {
    lastT.current = 0;
    setIdx(i);
  };

  return (
    <div className="hp">
      <div className="hp-list" role="tablist" aria-label="Cast">
        <div className="hp-eyebrow">Now on camera</div>
        {takes.map((t, i) => (
          <button key={t.member.id} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => pick(i)}>
            <Portrait member={t.member} size={80} />
            <span>{t.member.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <div className="hp-device">
        <div className="hp-phone">
          <SpotPlayer spec={current.spec} onTime={onTime} muted={!soundOn} width={540} />
          <button className="sound-toggle hp-sound" onClick={() => setSoundOn((s) => !s)} aria-pressed={soundOn}>
            {soundOn ? "Sound on" : "Sound off"}
          </button>
        </div>
        <div className="hp-caption">{who(current.member)} · take {current.take} of {takes.length}</div>
      </div>
    </div>
  );
}
