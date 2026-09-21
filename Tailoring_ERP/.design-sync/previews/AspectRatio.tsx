import { AspectRatio } from "atelierhq-ui";

export function Widescreen() {
  return (
    <div className="w-80 flex flex-col gap-2">
      <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg bg-muted">
        <div className="flex size-full items-center justify-center bg-primary text-primary-foreground">
          <span className="text-lg font-semibold">Agbada set lookbook</span>
        </div>
      </AspectRatio>
      <p className="text-sm text-muted-foreground">16:9 cover for a style reference</p>
    </div>
  );
}

export function Square() {
  return (
    <div className="w-48 flex flex-col gap-2">
      <AspectRatio ratio={1} className="overflow-hidden rounded-lg bg-accent">
        <div className="flex size-full items-center justify-center text-foreground">
          <span className="text-lg font-semibold">Ankara gown</span>
        </div>
      </AspectRatio>
      <p className="text-sm text-muted-foreground">1:1 fabric swatch</p>
    </div>
  );
}
