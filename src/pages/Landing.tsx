import { useMemo, useState } from "react";
import "./landing.css";
import Logo from "../components/Logo";
import StudioWindow from "../components/StudioWindow";
import ProductionReel from "../components/ProductionReel";
import Portrait from "../components/Portrait";
import { CAST_GROUPS, DEMO_BRAND, detailOf, HAS_PRODUCTION, PRODUCTION, who } from "../demo/library";
import { takesFor } from "../demo/production";
import { castCombinations, dealTakes, DIRECTION_OPTIONS, HOOKS } from "../engine";
import { SOUNDS, TEMPO_SCREENS } from "../compose";

const DOCTRINE = [
  {
    rule: "The camera is their phone.",
    why: "No phone, screen or device may appear in frame. The first live batch kept drawing the phone the person was reacting to, which no real selfie video ever shows.",
  },
  {
    rule: "Amateur beats polished.",
    why: "Even lighting and clean framing read as AI. Mundane, slightly-off, lived-in rooms read as real.",
  },
  {
    rule: "The gesture carries the beat.",
    why: "The face stays relaxed, close to deadpan. Wide eyes, raised brows and gasps are what killed the first batch.",
  },
  {
    rule: "Ordinary faces.",
    why: "Casting is believably ordinary people in their 20s and 30s. A model's face is the strongest AI tell there is.",
  },
  {
    rule: "Sameness is a defect.",
    why: "Every take must read as a different person in a different room. That is why identity lives in a cast bank, not in a prompt.",
  },
];

const STAGES = [
  { n: "01", title: "Cast", body: "A person is dealt from decks: name, heritage, bone structure, colouring and one distinguishing mark. Typed casting narrows the decks to an archetype your audience responds to without collapsing onto one face." },
  { n: "02", title: "Posed still", body: "The still shows the pose already landed. A deterministic prompt builder writes it from the cast member and the direction; no language model is involved, so every frame is auditable." },
  { n: "03", title: "Four-second clip", body: "Image-to-video adds near-stillness on top of the pose. Animating a hand travelling across the face is the highest-artifact move in video models, so the pipeline never asks for it." },
  { n: "04", title: "Hard cut to the app", body: "At about three seconds the ad cuts straight into a real screen recording of the product. The reaction earns the stop; the app earns the install." },
  { n: "05", title: "Sound and copy", body: "Hook text in the platform's own native style, a sound bed or the brand's track, and a loudness target so it plays at the level of the feed around it." },
];

export default function Landing() {
  const [promptOpen, setPromptOpen] = useState(false);
  // From production: a real take with a clip and the prompts it was made from.
  const sample = CAST_GROUPS.flatMap((g) => g.members).find((m) => !HAS_PRODUCTION || takesFor(m.id).some((t) => t.clip)) ?? CAST_GROUPS[0].members[0];
  const sampleTake = useMemo(() => {
    const real = HAS_PRODUCTION ? takesFor(sample.id).find((t) => t.clip) : undefined;
    if (real) return { prompts: { still: real.stillPrompt, motion: real.motionPrompt }, clip: real.clip, still: real.still };
    const dealtTake = dealTakes({ cast: [sample], count: 1, pins: { adType: DIRECTION_OPTIONS.adTypes[0].key }, extraNotes: "", seed: 7 })[0];
    return { prompts: dealtTake.prompts, clip: null, still: null };
  }, [sample]);
  const combos = castCombinations("male").toLocaleString("en-US");
  const tiles = CAST_GROUPS.flatMap((g) => g.members.slice(0, 2)).slice(0, 4);
  // The text tile shows three styles side by side, so it needs the short hooks.
  const shortHooks = [...HOOKS].sort((a, b) => a.length - b.length).slice(0, 3);

  return (
    <div className="landing">
      <div className="top">
        <div className="guides wrap" aria-hidden><i /><i /><i /><i /></div>
        <header className="nav wrap">
          <Logo />
          <nav className="nav-pill">
            <a href="#/" className="on">Home</a>
            <a href="#how">How it works</a>
            <a href="#yours">Make it yours</a>
            {HAS_PRODUCTION && <a href="#ads">Real ads</a>}
            <a href="#cast">The cast</a>
          </nav>
          <a href="#/studio" className="btn btn-ghost btn-sm nav-cta">Open the demo</a>
        </header>

        <section className="hero wrap">
          <a href="#how" className="badge"><i />Built on the UGC pipeline we run in production<span>›</span></a>
          <h1>UGC ads that look like<br />a friend filmed them.</h1>
          <p className="lede">
            Every take is a different person in a different room, reacting to your app, then cut
            straight into a real screen recording of it. Your characters, your words, your sound.
          </p>
          <div className="hero-ctas">
            <a href="#/studio" className="btn btn-primary">Make one in the demo →</a>
            <a href="#how" className="btn btn-ghost">See how it works</a>
          </div>
        </section>

        <div className="laptop wrap">
          <div className="laptop-lid">
            <div className="laptop-screen">
              <div className="browser-bar">
                <span className="lights"><i /><i /><i /></span>
                <span className="url">castline.app/studio/{DEMO_BRAND.name.toLowerCase()}</span>
              </div>
              <div className="laptop-app"><StudioWindow /></div>
            </div>
          </div>
          <div className="laptop-base"><i /></div>
          <p className="laptop-note faint">
            Live: the controls restyle the ad.{" "}
            {HAS_PRODUCTION ? `Real cast and clips from production; the app half is ${DEMO_BRAND.name}, ${DEMO_BRAND.tagline}.` : `Demo brand ${DEMO_BRAND.name}, ${DEMO_BRAND.tagline}.`}
          </p>
        </div>
      </div>

      <section className="stats wrap">
        <div><b>{combos}</b><span>distinct faces per gender in the cast decks</span></div>
        <div><b>0</b><span>language-model calls in casting or prompting</span></div>
        <div><b>1 : 1</b><span>every take stores the exact prompts it came from</span></div>
        {HAS_PRODUCTION
          ? <div><b>{PRODUCTION.ads.length}</b><span>finished ads made with it in production</span></div>
          : <div><b>~3s</b><span>reaction, then a hard cut to the product</span></div>}
      </section>

      {HAS_PRODUCTION && (
        <section id="ads" className="real-ads wrap">
          <div className="section-head">
            <div className="eyebrow">Made with it</div>
            <h2>Real ads, straight from production.</h2>
            <p className="muted">
              Every one of these was cast, posed, animated and cut by this pipeline for a live app. Tap a phone for sound.
            </p>
          </div>
          <ProductionReel ads={PRODUCTION.ads.slice(0, 16)} />
        </section>
      )}

      <section id="yours" className="yours wrap">
        <div className="section-head">
          <div className="eyebrow">Make it yours</div>
          <h2>Same pipeline, your brand.</h2>
          <p className="muted">The machinery is identical for every brand. Three things change, and each one takes a few clicks.</p>
        </div>
        <div className="tri">
          <article className="tile panel">
            <div className="tile-art faces">
              {tiles.map((m) => <Portrait key={m.id} member={m} size={120} />)}
            </div>
            <h3>Characters</h3>
            <p className="muted">Describe the person in your own words, or deal a whole cast of the archetype your audience responds to. Eight takes are eight different people, never one face eight times.</p>
            <div className="tags"><span>age</span><span>look</span><span>wardrobe</span><span>setting</span><span>archetype</span></div>
          </article>
          <article className="tile panel">
            <div className="tile-art texts">
              <span className="t-tiktok">{shortHooks[0]}</span>
              <span className="t-reels">{shortHooks[1]}</span>
              <span className="t-min">{shortHooks[2].toLowerCase()}</span>
            </div>
            <h3>Text</h3>
            <p className="muted">Hook line, captions and end card in your voice, set in the platform's own native text styles so the ad reads as a post, not a spot.</p>
            <div className="tags"><span>hook</span><span>caption style</span><span>end card</span></div>
          </article>
          <article className="tile panel">
            <div className="tile-art sounds">
              {SOUNDS.map((s, i) => (
                <div key={s.key} className="sound-row"><i style={{ animationDelay: `${i * 0.3}s` }} />{s.label}</div>
              ))}
              <div className="sound-row"><i />Your own track</div>
            </div>
            <h3>Audio</h3>
            <p className="muted">Pick a sound bed, keep only the room tone, or drop in your brand's track. It is mixed under the cut at a feed-level loudness.</p>
            <div className="tags"><span>music</span><span>room tone</span><span>voice</span><span>upload</span></div>
          </article>
        </div>
      </section>

      <section id="how" className="how wrap">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>Five stages, one ad.</h2>
          <p className="muted">Each stage is a cheap checkpoint before the next one spends money. A person reviews stills before any video is generated.</p>
        </div>
        <ol className="stages">
          {STAGES.map((s) => (
            <li key={s.n} className="stage">
              <span className="num">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p className="muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="prompt-card panel">
          <div className="prompt-head">
            <Portrait member={sample} size={96} className="prompt-face" />
            <div>
              <div className="eyebrow">{HAS_PRODUCTION ? "A real take from production, with the exact prompts it was made from" : "A real take, from the engine running in this page"}</div>
              <div className="who">{who(sample)}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setPromptOpen((o) => !o)}>{promptOpen ? "Hide prompts" : "Show the exact prompts"}</button>
          </div>
          {promptOpen && (
            <div className="prompts">
              {sampleTake.clip && <video className="prompt-clip" src={sampleTake.clip} poster={sampleTake.still ?? undefined} muted loop playsInline autoPlay />}
              <div><div className="eyebrow">Still</div><pre>{sampleTake.prompts.still}</pre></div>
              <div><div className="eyebrow">Motion</div><pre>{sampleTake.prompts.motion}</pre></div>
            </div>
          )}
        </div>
      </section>

      <section className="doctrine wrap">
        <div className="section-head">
          <div className="eyebrow">What the first batch taught us</div>
          <h2>Five rules every prompt obeys.</h2>
          <p className="muted">General principles, not micro-rules, so they hold across styles, genders and brands.</p>
        </div>
        <div className="rules">
          {DOCTRINE.map((d, i) => (
            <div key={d.rule} className="rule"><span className="num">{i + 1}</span><h3>{d.rule}</h3><p className="muted">{d.why}</p></div>
          ))}
        </div>
      </section>

      <section id="cast" className="cast wrap">
        <div className="section-head">
          <div className="eyebrow">The cast</div>
          <h2>{CAST_GROUPS.reduce((n, g) => n + g.members.length, 0)} people, ready to shoot.</h2>
          <p className="muted">None of them exist. {HAS_PRODUCTION ? "This is the production cast bank: every face was dealt by the engine and approved by a person before it was ever used." : "Each was dealt by the engine, and each one can be cast into any setting, wardrobe and ad type."}</p>
        </div>
        {CAST_GROUPS.map((g) => (
          <div key={g.type.key} className="cast-group">
            <div className="cast-label"><b className="cap">{g.type.plural}</b><span className="faint">{g.type.blurb}</span></div>
            <div className="cast-row">
              {g.members.map((m) => (
                <figure key={m.id}>
                  <Portrait member={m} size={180} />
                  <figcaption><b>{who(m)}</b><span className="faint">{detailOf(m)}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="cta wrap">
        <div className="cta-card panel">
          <h2>Make an ad yourself.</h2>
          <p className="muted">Pick who's on camera, set the direction, write the hook, choose the sound and the app screen it cuts to. {TEMPO_SCREENS.length} screens, {SOUNDS.length} sound beds, {DIRECTION_OPTIONS.settings.length} settings.</p>
          <a href="#/studio" className="btn btn-primary">Open the demo studio →</a>
        </div>
      </section>

      <footer className="foot wrap">
        <span className="foot-brand"><Logo /><span className="faint">built by Adrian Partain and Lucas Bennett</span></span>
        <span className="faint">A demo of the UGC pipeline we run in production. The cast are not real people; {DEMO_BRAND.name} is a fictional app.</span>
      </footer>
    </div>
  );
}
