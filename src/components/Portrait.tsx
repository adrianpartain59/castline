import { useMemo } from "react";
import type { CastMember } from "../contracts";
import { renderPortraitDataUrl } from "../compose";
import { portraitFor } from "../demo/library";

/** The rendered cast portrait when the library has one, else the drawn stand-in. */
export default function Portrait({ member, size = 240, className }: { member: CastMember; size?: number; className?: string }) {
  const rendered = portraitFor(member.id);
  const src = useMemo(() => rendered ?? renderPortraitDataUrl(member, size), [rendered, member, size]);
  return <img className={className} src={src} alt={`${member.name}, ${member.age}`} width={size} height={Math.round(size * 4 / 3)} loading="lazy" />;
}
