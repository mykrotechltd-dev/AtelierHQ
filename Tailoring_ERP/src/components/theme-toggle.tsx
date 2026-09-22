import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

/**
 * Sidebar-item-styled light/dark toggle, shared by AppSidebar and
 * AdminSidebar. Reads/writes through next-themes, which was already wired
 * app-wide (components/providers/theme.tsx, plus the FOUC-prevention
 * script in index.html) but had no visible control anywhere until now.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // next-themes' resolvedTheme is undefined until mount (it reads
  // localStorage/media query client-side), so `mounted` is derived from
  // that directly — a neutral placeholder for that one frame rather than
  // guessing and flipping icons right after. No effect/local state needed.
  const mounted = resolvedTheme !== undefined;
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-3 px-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent font-body"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="size-4 shrink-0" />
      ) : (
        <Moon className="size-4 shrink-0" />
      )}
      {mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme"}
    </Button>
  );
}
