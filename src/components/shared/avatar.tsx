import { cn } from "@/lib/utils";

/**
 * Initials avatar with a colour derived from the name.
 *
 * Deterministic, so the same person is always the same colour — that is what
 * makes an avatar scannable on a busy board, rather than just a grey circle that
 * has to be read. The hue comes from a hash of the name, and only the hue varies:
 * chroma and lightness are fixed, so no avatar can end up unreadable or louder
 * than the rest.
 *
 * No image support yet — profiles carry `avatar_url` but nothing uploads to it.
 * When that lands, it slots in here and every call site inherits it.
 */
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const hue = hueFromName(name);

  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold select-none",
        className,
      )}
      style={{
        backgroundColor: `oklch(0.72 0.11 ${hue})`,
        color: `oklch(0.24 0.06 ${hue})`,
      }}
      // The name is already rendered next to this everywhere it is used, so
      // announcing it again would just be noise for a screen-reader user.
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
