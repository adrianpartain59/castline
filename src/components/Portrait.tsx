import { useMemo } from "react";
import type { CastMember } from "../contracts";
import { renderPortraitDataUrl } from "../compose";
import { portraitFor, who } from "../demo/library";

/** The member's real or rendered face when there is one, else the drawn stand-in. */
export default function Portrait({ member, size = 240, className }: { member: CastMember; size?: number; className?: string }) {
  const rendered = portraitFor(member);
  const src = useMemo(() => rendered ?? renderPortraitDataUrl(member, size), [rendered, member, size]);
  return <img className={className} src={src} alt={who(member)} width={size} height={Math.round(size * 4 / 3)} loading="lazy" />;
}
