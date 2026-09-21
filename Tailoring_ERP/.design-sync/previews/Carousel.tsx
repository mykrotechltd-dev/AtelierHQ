import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "atelierhq-ui";

const fabrics = [
  { name: "Royal navy aso-oke", bg: "var(--primary)", fg: "var(--primary-foreground)", price: "₦18,500/yd" },
  { name: "Ivory brocade", bg: "var(--muted)", fg: "var(--foreground)", price: "₦12,000/yd" },
  { name: "Ankara wax print", bg: "linear-gradient(135deg, var(--chart-1), var(--chart-2))", fg: "var(--primary-foreground)", price: "₦6,500/yd" },
  { name: "Charcoal senator cashmere", bg: "linear-gradient(135deg, var(--foreground), var(--muted-foreground))", fg: "var(--background)", price: "₦22,000/yd" },
];

export function FabricSwatches() {
  return (
    <div className="px-12">
      <Carousel opts={{ align: "start" }} className="w-full max-w-md mx-auto">
        <CarouselContent>
          {fabrics.map((f) => (
            <CarouselItem key={f.name}>
              <div
                className="flex h-40 flex-col justify-end rounded-lg border p-4"
                style={{ background: f.bg, color: f.fg }}
              >
                <span className="font-display text-lg font-medium">{f.name}</span>
                <span className="text-sm">{f.price}</span>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}

export function VerticalLookbook() {
  return (
    <div className="py-12">
      <Carousel orientation="vertical" className="mx-auto w-full max-w-xs">
        <CarouselContent style={{ height: 160 }}>
          {fabrics.slice(0, 3).map((f) => (
            <CarouselItem key={f.name}>
              <div
                className="flex h-36 items-center justify-center rounded-lg border p-4 text-center text-sm font-medium"
                style={{ background: f.bg, color: f.fg }}
              >
                {f.name}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
