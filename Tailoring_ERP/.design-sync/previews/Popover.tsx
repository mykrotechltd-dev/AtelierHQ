import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "atelierhq-ui";

export function Default() {
  return (
    <div
      className="flex h-full w-full items-start justify-center"
      style={{ paddingTop: 48 }}
    >
      <Popover open>
        <PopoverTrigger asChild>
          <Button variant="outline">Fitting reminder</Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="center" sideOffset={8}>
          <PopoverHeader>
            <PopoverTitle>Fitting reminder</PopoverTitle>
            <PopoverDescription>
              Send Mrs. Bello an SMS before her Ankara gown fitting.
            </PopoverDescription>
          </PopoverHeader>
          <div className="grid gap-2 mt-3">
            <Label htmlFor="pop-hours">Hours before fitting</Label>
            <Input id="pop-hours" defaultValue="24" />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
