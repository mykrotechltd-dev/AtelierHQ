import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "atelierhq-ui";
import { CalendarClock } from "lucide-react";

export function Default() {
  return (
    <TooltipProvider>
      <div className="flex h-full w-full items-center justify-center">
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Schedule fitting">
              <CalendarClock />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            Schedule fitting
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
