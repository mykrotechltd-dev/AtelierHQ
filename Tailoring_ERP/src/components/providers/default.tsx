import { AuthProvider } from "./auth.tsx";
import { MeasurementUnitProvider } from "./measurement-unit.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryClientProvider>
        <MeasurementUnitProvider>
          <TooltipProvider>
            <ThemeProvider>
              <Toaster />
              {children}
            </ThemeProvider>
          </TooltipProvider>
        </MeasurementUnitProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
