import { useMemo, useRef, useState } from "react";
import "./studio-window.css";
import type { ComposeSpec, SoundKey, TextStyle, TempoScreenKey } from "../contracts";
import SpotPlayer from "./SpotPlayer";
import Portrait from "./Portrait";
import { showcaseSpecs, DEMO_BRAND } from "../demo/library";
import { HOOKS } from "../engine";
import { SOUNDS, TEMPO_SCREENS } from "../compose";

const TEXT_STYLES: { key: TextStyle; label: string }[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "reels", label: "Reels" },
  { key: "minimal", label: "Minimal" },
];

const NAV = ["Cast", "Stills", "Clips", "Compose", "Ads"];

/**
 * The studio's compose screen, live, for the hero's laptop. The phone cycles
 * through finished takes of one ad (a different person each loop), and the
 * controls on the right genuinely restyle it.
 */
export default function StudioWindow() {
  const takes = useMemo(() => showcaseSpecs(), []);
  const [idx, setIdx] = useState(0);
  const [hook, setHook] = useState(HOOKS[0]);
  const [textStyle, setTextStyle] = useState<TextStyle>("tiktok");
  const [screen, setScreen] = useState<TempoScreenKey | null>(null);
  const [sound, setSound] = useState<SoundKey>("lofi");
  const [soundOn, setSoundOn] = useState(false);
  const lastT = useRef(0);
  const current = takes[idx];

  const spec: ComposeSpec = useMemo(
    () => ({
      ...current.spec,
      hook,
      textStyle,
      appScreen: screen ?? current.spec.appScreen,
      sound: { kind: "preset", key: sound },
    }),
    [current, hook, textStyle, screen, sound],
  );

  const onTime = (t: number) => {
    if (t + 0.25 < lastT.current) setIdx((i) => (i + 1) % takes.length);
    lastT.current = t;
  };
  const pick = (i: number) => {
    lastT.current = 0;
    setIdx(i);
  };

  return (
    <div className="sw">
      <aside className="sw-side">
        <div className="sw-ws"><i />{DEMO_BRAND.name}<span>Workspace</span></div>
        <nav>
          {NAV.map((n) => (
            <span key={n} className={n === "Compose" ? "on" : ""}>{n}</span>
          ))}
        </nav>
        <div className="sw-side-foot">
          <div className="sw-eyebrow">Library</div>
          <span>Sounds</span>
          <span>App recordings</span>
        </div>
      </aside>

      <section className="sw-main">
        <header className="sw-head">
          <div>
            <div className="sw-crumb">Compose · Morning run hook</div>
            <b>{takes.length} takes, {takes.length} different people</b>
          </div>
          <span className="sw-pill"><i />Live preview</span>
        </header>
        <div className="sw-stage">
          <div className="sw-phone">
            <SpotPlayer spec={spec} onTime={onTime} muted={!soundOn} width={420} />
            <button className="sound-toggle" onClick={() => setSoundOn((s) => !s)} aria-pressed={soundOn}>
              {soundOn ? "Sound on" : "Sound off"}
            </button>
          </div>
          <div className="sw-takes" role="tablist" aria-label="Takes">
            {takes.map((t, i) => (
              <button key={t.member.id} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => pick(i)}>
                <Portrait member={t.member} size={80} />
                <span>{t.member.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="sw-panel">
        <label className="sw-eyebrow" htmlFor="sw-hook">Hook</label>
        <input id="sw-hook" value={hook} maxLength={90} onChange={(e) => setHook(e.target.value)} />
        <div className="sw-eyebrow">Text style</div>
        <div className="sw-chips">
          {TEXT_STYLES.map((s) => (
            <button key={s.key} className="chip" aria-pressed={textStyle === s.key} onClick={() => setTextStyle(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className="sw-eyebrow">Cuts to</div>
        <div className="sw-chips">
          {TEMPO_SCREENS.map((s) => (
            <button key={s.key} className="chip" aria-pressed={spec.appScreen === s.key} onClick={() => setScreen(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className="sw-eyebrow">Sound</div>
        <div className="sw-chips">
          {SOUNDS.map((s) => (
            <button key={s.key} className="chip" aria-pressed={sound === s.key} onClick={() => setSound(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className="sw-eyebrow">Timeline</div>
        <div className="sw-timeline">
          <div style={{ flex: spec.reactionSeconds }}>{current.member.name.split(" ")[0]}</div>
          <div style={{ flex: spec.appSeconds }}>{DEMO_BRAND.name}</div>
        </div>
        <a href="#/studio" className="btn btn-primary sw-cta">Open the full studio →</a>
      </aside>
    </div>
  );
}
