import { useEffect, useRef, useState } from "react";
import "./production-reel.css";
import type { ProductionAd } from "../demo/production";

/**
 * Finished ads from production in a row of phones. Each one plays muted only
 * while it is on screen; clicking a phone turns its sound on.
 */
export default function ProductionReel({ ads }: { ads: ProductionAd[] }) {
  const [audible, setAudible] = useState<string | null>(null);
  return (
    <div className="reel" role="list">
      {ads.map((a) => (
        <ReelPhone key={a.id} ad={a} audible={audible === a.id} onToggle={() => setAudible((cur) => (cur === a.id ? null : a.id))} />
      ))}
    </div>
  );
}

function ReelPhone({ ad, audible, onToggle }: { ad: ProductionAd; audible: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.muted = !audible;
  }, [audible]);

  return (
    <figure className="reel-item" role="listitem">
      <button className="reel-phone" onClick={onToggle} aria-label={audible ? "Mute" : "Play with sound"}>
        <video ref={ref} src={ad.video} poster={ad.poster} muted loop playsInline preload="none" />
        <span className="reel-sound">{audible ? "Sound on" : "Sound off"}</span>
        {ad.favorite && <span className="reel-fav">★ Team favourite</span>}
      </button>
      <figcaption>{ad.hook}</figcaption>
    </figure>
  );
}
