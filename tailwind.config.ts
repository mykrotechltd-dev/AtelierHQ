import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy — primary buttons, links, the sidebar background at its
        // darkest shades. Replaces the original bright-blue brand color.
        brand: {
          50: "#EEF1F8",
          100: "#DCE3F0",
          200: "#B9C7E1",
          300: "#8FA3C9",
          400: "#5F76A0",
          500: "#3A4E75",
          600: "#1E2A47",
          700: "#141C33",
          800: "#0F1420",
          900: "#0A0D16",
        },
        // Warm terracotta — used sparingly: active nav state, eyebrow
        // labels, small logo accents. Never a full-page or button fill.
        accent: {
          50: "#FBF1EA",
          100: "#F5DFCC",
          400: "#E0956A",
          500: "#C67C4E",
          600: "#AD6740",
        },
        // Cream — the page background, replacing slate-50 everywhere.
        cream: {
          DEFAULT: "#F7F3EA",
          50: "#F7F3EA",
          100: "#F2ECDD",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
