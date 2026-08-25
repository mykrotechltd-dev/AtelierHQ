import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6ff",
          100: "#e6edff",
          500: "#3b5bfd",
          600: "#2a44e0",
          700: "#2036b3",
        },
      },
    },
  },
  plugins: [],
};

export default config;
