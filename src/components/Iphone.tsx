import type { ReactNode } from "react";
import "./iphone.css";

/**
 * An iPhone 17 drawn to its real proportions: a 149.6 × 71.5 mm body around a
 * 6.3" 1206 × 2622 display, the Dynamic Island, the action button and volume
 * keys on the left, the side button and Camera Control on the right. Sized by
 * width; every measurement scales from it (container query units).
 */
export default function Iphone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`iphone ${className ?? ""}`}>
      <span className="ip-key ip-action" aria-hidden />
      <span className="ip-key ip-vol-up" aria-hidden />
      <span className="ip-key ip-vol-down" aria-hidden />
      <span className="ip-key ip-side" aria-hidden />
      <span className="ip-key ip-camera" aria-hidden />
      <div className="ip-body">
        <div className="ip-screen">
          {children}
          <span className="ip-island" aria-hidden />
        </div>
      </div>
    </div>
  );
}
