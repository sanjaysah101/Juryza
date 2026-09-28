import { Avatar, AvatarFallback, AvatarImage } from "@juryza/ui/components/ui/avatar";
import { cn } from "@juryza/ui/lib/utils";

import { hueOf, initials } from "@/lib/format";

/** An avatar with an initials fallback tinted by the person's name. */
export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string | null | undefined;
  image?: string | null;
  className?: string;
}) {
  const hue = hueOf(name ?? "");
  return (
    <Avatar className={cn("size-8", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback
        className="text-xs font-medium"
        style={{ background: `oklch(0.9 0.05 ${hue})`, color: `oklch(0.35 0.08 ${hue})` }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Overlapping avatars for a team. */
export function AvatarStack({
  people,
  max = 4,
  className,
}: {
  people: { name: string | null; image?: string | null }[];
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex -space-x-2", className)}>
      {shown.map((p, i) => (
        <UserAvatar
          // biome-ignore lint/suspicious/noArrayIndexKey: avatars have no stable id here and never reorder
          key={i}
          name={p.name}
          image={p.image}
          className="ring-background size-7 ring-2"
        />
      ))}
      {rest > 0 && (
        <span className="bg-muted text-muted-foreground ring-background grid size-7 place-items-center rounded-full text-[0.7rem] font-medium ring-2">
          +{rest}
        </span>
      )}
    </div>
  );
}
