import { Avatar, AvatarFallback, AvatarImage } from "@juryza/ui/components/ui/avatar";
import { cn } from "@juryza/ui/lib/utils";

import { hueOf, initials } from "@/lib/format";

/** An avatar with an initials fallback tinted by the person's name. */
export function UserAvatar({
  name,
  image,
  className,
  fallbackClassName,
}: {
  name: string | null | undefined;
  image?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const hue = hueOf(name ?? "");
  const letters = initials(name);
  const isMulti = letters.length > 1;

  return (
    <Avatar
      className={cn("size-8 @container select-none overflow-hidden", className)}
      style={{ containerType: "inline-size" }}
    >
      {image ? <AvatarImage src={image} alt={name ?? ""} /> : null}
      <AvatarFallback
        className={cn(
          "flex size-full items-center justify-center font-bold tracking-tight text-white select-none",
          isMulti ? "text-[clamp(0.65rem,36cqw,2.75rem)]" : "text-[clamp(0.75rem,44cqw,3.5rem)]",
          fallbackClassName
        )}
        style={{
          background: `linear-gradient(135deg, oklch(0.58 0.19 ${hue}) 0%, oklch(0.42 0.22 ${(hue + 45) % 360}) 100%)`,
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
          boxShadow:
            "inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.3), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.25)",
        }}
      >
        {letters}
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
