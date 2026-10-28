import { useMemo } from "react";
import type { CastMember } from "../contracts";
import { renderPortraitDataUrl } from "../compose";

export default function Portrait({ member, size = 240, className }: { member: CastMember; size?: number; className?: string }) {
  const src = useMemo(() => renderPortraitDataUrl(member, size), [member, size]);
  return <img className={className} src={src} alt={`${member.name}, ${member.age}`} width={size} height={Math.round(size * 4 / 3)} />;
}
