import {
  Avatar,
  AvatarFallback,
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "atelierhq-ui";

export function Default() {
  return (
    <div
      className="flex h-full w-full items-start justify-center"
      style={{ paddingTop: 40 }}
    >
      <HoverCard open>
        <HoverCardTrigger asChild>
          <Button variant="link">Chinedu Okafor</Button>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" sideOffset={8}>
          <div className="flex gap-3">
            <Avatar>
              <AvatarFallback>CO</AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <p className="text-sm font-semibold">Chinedu Okafor</p>
              <p className="text-xs text-muted-foreground">0803 555 0142</p>
              <p className="text-xs text-muted-foreground">
                Last order: ORD-0042 · Agbada set · ₦185,000
              </p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
