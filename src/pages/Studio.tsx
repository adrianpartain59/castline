import { useEffect, useMemo, useRef, useState } from "react";
import "./studio.css";
import type { CastMember, ComposeSpec, Gender, SoundChoice, Take, TempoScreenKey, TextStyle } from "../contracts";
import { dealTakes, DIRECTION_OPTIONS, GESTURE_OPTIONS, HOOKS } from "../engine";
import { exportVideo, SOUNDS, TEMPO_SCREENS } from "../compose";
import { CAST_GROUPS, castById, DEMO_BRAND, reactionFor } from "../demo/library";
import SpotPlayer from "../components/SpotPlayer";
import Portrait from "../components/Portrait";
import Logo from "../components/Logo";
import { ClipLoop, StillFrame } from "../components/ReactionView";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { n: Step; label: string; sub: string }[] = [
  { n: 1, label: "Cast & direction", sub: "who's on camera" },
  { n: 2, label: "Stills", sub: "posed frames" },
  { n: 3, label: "Clips", sub: "4-second motion" },
  { n: 4, label: "Compose", sub: "text, sound, cut" },
  { n: 5, label: "Ads", sub: "finished files" },
];

const MAX_TAKES = 8;
const TEXT_STYLES: { key: TextStyle; label: string }[] = [
  { key: "tiktok", label: "TikTok native" },
  { key: "reels", label: "Reels" },
  { key: "minimal", label: "Minimal" },
];

interface Job {
  title: string;
  lines: string[];
  done: number;
  total: number;
}

interface FinishedAd {
  id: string;
  url: string;
  extension: string;
  hook: string;
  member: CastMember;
}

/** Plays the real pipeline's stages against footage that was rendered ahead of time. */
function useSimulatedJob() {
  const [job, setJob] = useState<Job | null>(null);
  const run = (title: string, lines: string[], perItemMs: number) =>
    new Promise<void>((resolve) => {
      setJob({ title, lines, done: 0, total: lines.length });
      let i = 0;
      const tick = () => {
        i += 1;
        setJob((j) => (j ? { ...j, done: i } : j));
        if (i >= lines.length) {
          setTimeout(() => {
            setJob(null);
            resolve();
          }, 350);
        } else setTimeout(tick, perItemMs * (0.75 + Math.random() * 0.5));
      };
      setTimeout(tick, perItemMs);
    });
  return { job, run };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export default function Studio() {
  const [step, setStep] = useState<Step>(1);
  const [reached, setReached] = useState<Step>(1);
  const { job, run } = useSimulatedJob();

  // step 1
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(4);
  const [adType, setAdType] = useState(DIRECTION_OPTIONS.adTypes[0].key);
  const [setting, setSetting] = useState<string | null>(DIRECTION_OPTIONS.settings[0].key);
  const [wardrobe, setWardrobe] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<string>("all");

  // steps 2–3
  const [takes, setTakes] = useState<Take[]>([]);
  const [keepers, setKeepers] = useState<string[]>([]);
  const [clips, setClips] = useState<Take[]>([]);
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);

  // step 4
  const [chosen, setChosen] = useState<Take | null>(null);
  const [hook, setHook] = useState(HOOKS[0]);
  const [textStyle, setTextStyle] = useState<TextStyle>("tiktok");
  const [screen, setScreen] = useState<TempoScreenKey>("pace");
  const [sound, setSound] = useState<SoundChoice>({ kind: "preset", key: "lofi" });
  const [reactionSeconds, setReactionSeconds] = useState(3.2);
  const [appSeconds, setAppSeconds] = useState(3.6);
  const [exporting, setExporting] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // step 5
  const [ads, setAds] = useState<FinishedAd[]>([]);
  useEffect(() => () => ads.forEach((a) => URL.revokeObjectURL(a.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const goto = (s: Step) => {
    setStep(s);
    setReached((r) => (s > r ? s : r));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedMembers = selected.map((id) => castById(id)!).filter(Boolean);
  const selectedGenders = new Set<Gender>(selectedMembers.map((m) => m.gender));
  const wardrobeOptions = DIRECTION_OPTIONS.wardrobe.filter(
    (w) => !w.gender || selectedGenders.size === 0 || selectedGenders.has(w.gender),
  );

  // Chip sentences live in the direction box, exactly as in the production tool:
  // a chip is on if and only if its sentence is in the text.
  const direction = [
    DIRECTION_OPTIONS.adTypes.find((o) => o.key === adType)?.sentence,
    setting ? DIRECTION_OPTIONS.settings.find((o) => o.key === setting)?.sentence : null,
    wardrobe ? DIRECTION_OPTIONS.wardrobe.find((o) => o.key === wardrobe)?.sentence : null,
  ].filter(Boolean).join(" ");

  const toggleCast = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= count ? cur : [...cur, id]));

  const summary =
    selected.length === 0
      ? `Pick up to ${count} people from the cast`
      : selected.length === 1
        ? `all ${count} takes use ${selectedMembers[0].name}`
        : `${count} takes across ${selected.length} faces, every face gets at least one`;

  const generateStills = async () => {
    const cast = selectedMembers;
    const seed = hashSeed([...selected, adType, setting, wardrobe, notes, count].join("|"));
    const dealt = dealTakes({
      cast,
      count,
      pins: { adType, setting: setting ?? undefined, wardrobe: wardrobe ?? undefined },
      extraNotes: notes,
      seed,
    });
    await run(
      "Rendering stills",
      dealt.map((t, i) => `Still ${i + 1} of ${dealt.length} · ${castById(t.persona.castId)?.name}`),
      650,
    );
    setTakes(dealt);
    setKeepers(dealt.slice(0, Math.min(2, dealt.length)).map((t) => t.id));
    setClips([]);
    goto(2);
  };

  const animate = async () => {
    const keep = takes.filter((t) => keepers.includes(t.id));
    await run("Animating clips", keep.map((_, i) => `Clip ${i + 1} of ${keep.length} · image to video, 4s`), 1100);
    setClips(keep);
    goto(3);
  };

  const sourceFor = (t: Take) => {
    const m = castById(t.persona.castId)!;
    return reactionFor(m, t.persona.setting, hashSeed(t.id));
  };

  const spec: ComposeSpec | null = useMemo(
    () =>
      chosen
        ? { reaction: sourceFor(chosen), reactionSeconds, appScreen: screen, appSeconds, hook, textStyle, sound }
        : null,
    [chosen, reactionSeconds, screen, appSeconds, hook, textStyle, sound],
  );

  const render = async () => {
    if (!spec || !chosen) return;
    setExporting(0);
    try {
      const out = await exportVideo(spec, { onProgress: (p) => setExporting(p) });
      const member = castById(chosen.persona.castId)!;
      setAds((a) => [{ id: `${Date.now()}`, url: URL.createObjectURL(out.blob), extension: out.extension, hook, member }, ...a]);
      goto(5);
    } finally {
      setExporting(null);
    }
  };

  const groups = CAST_GROUPS.filter((g) => filter === "all" || g.type.key === filter);

  return (
    <div className="studio">
      <header className="studio-top">
        <Logo />
        <span className="faint">Demo workspace</span>
        <span className="workspace"><i />{DEMO_BRAND.name}</span>
        <span className="pill-demo">Demo mode · nothing is billed</span>
      </header>

      <nav className="stepper wrap" aria-label="Steps">
        {STEPS.map((s, i) => (
          <div key={s.n} className="step-wrap">
            {i > 0 && <span className="chev" aria-hidden>›</span>}
            <button
              className={`step ${step === s.n ? "on" : ""}`}
              disabled={s.n > reached}
              onClick={() => goto(s.n)}
            >
              <span className="n">{s.n}</span>
              <span><b>{s.label}</b><small>{s.sub}</small></span>
            </button>
          </div>
        ))}
      </nav>

      <main className="wrap studio-body">
        {step === 1 && (
          <section>
            <div className="direction panel">
              <div className="row"><span className="lab">Ad type</span>
                {DIRECTION_OPTIONS.adTypes.map((o) => (
                  <button key={o.key} className="chip" aria-pressed={adType === o.key} onClick={() => setAdType(o.key)}>{o.label}</button>
                ))}
              </div>
              <div className="row"><span className="lab">Setting</span>
                {DIRECTION_OPTIONS.settings.map((o) => (
                  <button key={o.key} className="chip" aria-pressed={setting === o.key} onClick={() => setSetting(setting === o.key ? null : o.key)}>{o.label}</button>
                ))}
              </div>
              <div className="row"><span className="lab">Wardrobe</span>
                {wardrobeOptions.map((o) => (
                  <button key={o.key} className="chip" aria-pressed={wardrobe === o.key} onClick={() => setWardrobe(wardrobe === o.key ? null : o.key)}>{o.label}</button>
                ))}
              </div>
              <div className="direction-box">
                <div className="dir-sentences">{direction || <span className="faint">Unpinned fields randomize per take.</span>}</div>
                <textarea
                  value={notes}
                  maxLength={300}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else? e.g. still a little out of breath, hair tied back"
                />
              </div>
              <div className="generate">
                <button className="btn btn-primary" disabled={selected.length === 0 || !!job} onClick={generateStills}>Generate {count} stills</button>
                <div className="stepper-num">
                  <button
                    onClick={() => {
                      // Every picked face needs a take, so fewer takes drops the last pick.
                      const next = Math.max(1, count - 1);
                      setCount(next);
                      setSelected((cur) => cur.slice(0, next));
                    }}
                    aria-label="Fewer takes"
                  >−</button>
                  <span>{count}</span>
                  <button onClick={() => setCount((c) => Math.min(MAX_TAKES, c + 1))} aria-label="More takes">+</button>
                </div>
                <span className="faint">{summary}</span>
              </div>
            </div>

            <div className="cast-filter">
              <button className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Everyone</button>
              {CAST_GROUPS.map((g) => (
                <button key={g.type.key} className="chip" aria-pressed={filter === g.type.key} onClick={() => setFilter(g.type.key)}><span className="cap">{g.type.plural}</span></button>
              ))}
              <span className="faint" style={{ marginLeft: "auto" }}>{selected.length} of {count} picked</span>
            </div>
            {groups.map((g) => (
              <div key={g.type.key} className="cast-section">
                <div className="cast-head"><b className="cap">{g.type.plural}</b><span className="faint">{g.type.blurb}</span></div>
                <div className="cast-grid">
                  {g.members.map((m) => {
                    const order = selected.indexOf(m.id);
                    const full = order < 0 && selected.length >= count;
                    return (
                      <button key={m.id} className={`face ${order >= 0 ? "sel" : ""} ${full ? "dim" : ""}`} onClick={() => toggleCast(m.id)} aria-pressed={order >= 0}>
                        <Portrait member={m} size={200} />
                        {order >= 0 && <span className="order">{order + 1}</span>}
                        <span className="face-meta"><b>{m.name}, {m.age}</b><small>{m.distinguishingMark}</small></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="bar">
              <div><h2>Stills</h2><p className="faint">Cull before any video is generated. Stills are the cheap checkpoint.</p></div>
              <button className="btn btn-primary" disabled={keepers.length === 0 || !!job} onClick={animate}>Animate {keepers.length} keeper{keepers.length === 1 ? "" : "s"}</button>
            </div>
            <div className="take-grid">
              {takes.map((t) => {
                const m = castById(t.persona.castId)!;
                const keep = keepers.includes(t.id);
                return (
                  <article key={t.id} className={`take panel ${keep ? "keep" : ""}`}>
                    <button className="take-media" onClick={() => setKeepers((k) => (keep ? k.filter((x) => x !== t.id) : [...k, t.id]))}>
                      <StillFrame source={sourceFor(t)} />
                      <span className={`keep-badge ${keep ? "on" : ""}`}>{keep ? "Keeper ✓" : "Keep"}</span>
                    </button>
                    <div className="take-meta">
                      <b>{m.name}</b>
                      <span className="faint">{label(DIRECTION_OPTIONS.settings, t.persona.setting)} · {label(GESTURE_OPTIONS, t.persona.gesture).toLowerCase()}</span>
                      <button className="link" onClick={() => setOpenPrompt(openPrompt === t.id ? null : t.id)}>{openPrompt === t.id ? "Hide prompt" : "Exact prompt"}</button>
                    </div>
                    {openPrompt === t.id && <pre className="prompt">{t.prompts.still}</pre>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <div className="bar">
              <div><h2>Clips</h2><p className="faint">Near-stillness on top of the landed pose. Pick one to compose.</p></div>
            </div>
            <div className="take-grid">
              {clips.map((t) => {
                const m = castById(t.persona.castId)!;
                return (
                  <article key={t.id} className="take panel">
                    <div className="take-media"><ClipLoop source={sourceFor(t)} seconds={reactionSeconds} /></div>
                    <div className="take-meta">
                      <b>{m.name}</b>
                      <button className="link" onClick={() => setOpenPrompt(openPrompt === t.id ? null : t.id)}>{openPrompt === t.id ? "Hide prompt" : "Motion prompt"}</button>
                    </div>
                    {openPrompt === t.id && <pre className="prompt">{t.prompts.motion}</pre>}
                    <button className="btn btn-primary btn-sm full" onClick={() => { setChosen(t); goto(4); }}>Compose this one →</button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {step === 4 && spec && chosen && (
          <section className="compose">
            <div className="compose-preview">
              <div style={{ position: "relative" }}>
                <SpotPlayer spec={spec} muted={!soundOn} />
                <button className="sound-toggle" onClick={() => setSoundOn((s) => !s)} aria-pressed={soundOn}>
                  {soundOn ? "Sound on" : "Sound off"}
                </button>
              </div>
              <p className="faint center">Live preview. Every change below recomposes the ad in your browser.</p>
            </div>
            <div className="compose-controls panel">
              <label className="lab" htmlFor="hook">Hook text</label>
              <input id="hook" className="field" value={hook} maxLength={90} onChange={(e) => setHook(e.target.value)} />
              <div className="row wrap-chips">
                {HOOKS.slice(0, 6).map((h) => (
                  <button key={h} className="chip" aria-pressed={hook === h} onClick={() => setHook(h)}>{h}</button>
                ))}
              </div>

              <span className="lab">Text style</span>
              <div className="row">
                {TEXT_STYLES.map((s) => <button key={s.key} className="chip" aria-pressed={textStyle === s.key} onClick={() => setTextStyle(s.key)}>{s.label}</button>)}
              </div>

              <span className="lab">Cuts to</span>
              <div className="row">
                {TEMPO_SCREENS.map((s) => <button key={s.key} className="chip" aria-pressed={screen === s.key} onClick={() => setScreen(s.key)}>{s.label}</button>)}
              </div>

              <span className="lab">Sound</span>
              <div className="row">
                {SOUNDS.map((s) => (
                  <button key={s.key} className="chip" aria-pressed={sound.kind === "preset" && sound.key === s.key} onClick={() => setSound({ kind: "preset", key: s.key })}>{s.label}</button>
                ))}
                <button className="chip" aria-pressed={sound.kind === "upload"} onClick={() => fileRef.current?.click()}>
                  {sound.kind === "upload" ? sound.file.name : "Upload your own"}
                </button>
                <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setSound({ kind: "upload", file: f }); }} />
              </div>

              <span className="lab">Timeline</span>
              <div className="timeline">
                <div style={{ flex: reactionSeconds }} className="seg react">{castById(chosen.persona.castId)?.name} · {reactionSeconds.toFixed(1)}s</div>
                <div style={{ flex: appSeconds }} className="seg app">{DEMO_BRAND.name} · {appSeconds.toFixed(1)}s</div>
              </div>
              <div className="sliders">
                <label>Reaction <input type="range" min={2.4} max={4} step={0.1} value={reactionSeconds} onChange={(e) => setReactionSeconds(+e.target.value)} /></label>
                <label>App <input type="range" min={2.4} max={6} step={0.1} value={appSeconds} onChange={(e) => setAppSeconds(+e.target.value)} /></label>
              </div>

              <button className="btn btn-primary" disabled={exporting !== null} onClick={render}>
                {exporting === null ? "Render final ad" : `Rendering… ${Math.round(exporting * 100)}%`}
              </button>
              <p className="faint small">Renders a 1080×1920 video in your browser, in real time.</p>
            </div>
          </section>
        )}

        {step === 5 && (
          <section>
            <div className="bar">
              <div><h2>Ads</h2><p className="faint">Finished files, ready to traffic.</p></div>
              <button className="btn btn-ghost" onClick={() => goto(1)}>Make another</button>
            </div>
            {ads.length === 0 && <p className="faint">Nothing rendered yet.</p>}
            <div className="final-grid">
              {ads.map((a) => (
                <article key={a.id} className="panel final">
                  <video src={a.url} controls playsInline loop />
                  <div className="take-meta">
                    <b>{a.member.name}</b>
                    <span className="faint">{a.hook}</span>
                    <a className="btn btn-ghost btn-sm" href={a.url} download={`castline-${DEMO_BRAND.name.toLowerCase()}-${a.id}.${a.extension}`}>Download .{a.extension}</a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {job && (
        <div className="job-scrim" role="dialog" aria-label={job.title}>
          <div className="job panel">
            <b>{job.title}</b>
            <div className="job-bar"><i style={{ width: `${(job.done / job.total) * 100}%` }} /></div>
            <ul>
              {job.lines.map((l, i) => (
                <li key={l} className={i < job.done ? "done" : i === job.done ? "now" : ""}>{i < job.done ? "✓" : i === job.done ? "◌" : "·"} {l}</li>
              ))}
            </ul>
            <p className="faint small">Demo: these takes were rendered ahead of time from these exact prompts.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function label(opts: { key: string; label: string }[], key: string): string {
  return opts.find((o) => o.key === key)?.label ?? key;
}
