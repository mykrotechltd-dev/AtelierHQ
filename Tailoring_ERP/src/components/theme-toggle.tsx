import { useEffect, useState } from "react";
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

  // next-themes' own recommended pattern: resolvedTheme is undefined until
  // mount, so render a neutral placeholder for that one frame rather than
  // guess and flip icons right after.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
