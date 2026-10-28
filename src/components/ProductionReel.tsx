import { useEffect, useRef } from "react";
import "./production-reel.css";
import type { ProductionAd } from "../demo/production";
import Iphone from "./Iphone";

/**
 * Finished ads from production in a row of phones, each playing only while
 * it is on screen. The ads are published silent: their music came from the
 * Meta Sound Collection, which is licensed for Meta placements only.
 */
export default function ProductionReel({ ads }: { ads: ProductionAd[] }) {
  return (
    <div className="reel" role="list">
      {ads.map((a) => <ReelPhone key={a.id} ad={a} />)}
    </div>
  );
}

function ReelPhone({ ad }: { ad: ProductionAd }) {
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
  return (
    <figure className="reel-item" role="listitem">
      <div className="reel-phone">
        <Iphone>
          <video ref={ref} src={ad.video} poster={ad.poster} muted loop playsInline preload="none" />
        </Iphone>
      </div>
      <figcaption>
        {ad.favorite && <span className="reel-fav">★ Team favourite</span>}
        {ad.hook}
      </figcaption>
    </figure>
  );
}
