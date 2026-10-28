import { useEffect, useMemo, useRef } from "react";
import type { ReactionSource } from "../contracts";
import { drawPlaceholderReaction } from "../compose";

const W = 360;
const H = 640;

/** A still frame of a take: the posed frame the clip is animated from. */
export function StillFrame({ source, className }: { source: ReactionSource; className?: string }) {
  const src = useMemo(() => {
    if (source.kind === "video") return null;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    drawPlaceholderReaction(c.getContext("2d")!, source.member, source.setting, source.seed, 0, W, H);
    return c.toDataURL("image/jpeg", 0.86);
  }, [source]);
  if (source.kind === "video") return <video className={className} src={source.src} muted playsInline preload="metadata" />;
  return <img className={className} src={src!} alt="" />;
}

/** The animated clip on its own, looping, before it is cut into an ad. */
export function ClipLoop({ source, seconds, className }: { source: ReactionSource; seconds: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (source.kind === "video") return;
    const ctx = ref.current!.getContext("2d")!;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = ((now - t0) / 1000) % seconds;
      drawPlaceholderReaction(ctx, source.member, source.setting, source.seed, t, W, H);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source, seconds]);
  if (source.kind === "video") return <video className={className} src={source.src} muted playsInline autoPlay loop />;
  return <canvas ref={ref} className={className} width={W} height={H} />;
}
