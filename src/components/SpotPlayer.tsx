import { useEffect, useRef } from "react";
import type { ComposeSpec } from "../contracts";
import { Compositor } from "../compose";
import Iphone from "./Iphone";

interface Props {
  spec: ComposeSpec;
  playing?: boolean;
  /** Called with the playhead; a drop in t means the ad looped. */
  onTime?: (t: number) => void;
  /** Canvas backing resolution (CSS size comes from the parent). */
  width?: number;
  className?: string;
  /** Sound is opt-in: a looping preview must never play audio nobody asked for. */
  muted?: boolean;
}

/** A phone-shaped live preview of one ad, drawn by the real compositor. */
export default function SpotPlayer({ spec, playing = true, onTime, width = 540, className, muted = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const comp = new Compositor(canvas);
    comp.muted = true;
    compRef.current = comp;
    const off = comp.onTime((t) => onTimeRef.current?.(t));
    // A hidden tab stops playing entirely, sound included.
    const onVisibility = () => {
      if (document.hidden) comp.pause();
      else if (playingRef.current) comp.play();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      off();
      comp.destroy();
      compRef.current = null;
    };
  }, []);

  useEffect(() => {
    const comp = compRef.current;
    if (!comp) return;
    comp.setSpec(spec);
    if (playing) comp.play();
  }, [spec]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const comp = compRef.current;
    if (!comp) return;
    if (playing && !document.hidden) comp.play();
    else comp.pause();
  }, [playing]);

  useEffect(() => {
    if (compRef.current) compRef.current.muted = muted;
  }, [muted]);

  return (
    <Iphone className={className}>
      {/* Drawn at the iPhone 17 screen's own 1206:2622 shape, as the ad plays in a feed. */}
      <canvas ref={canvasRef} width={width} height={Math.round((width * 2622) / 1206)} />
    </Iphone>
  );
}
