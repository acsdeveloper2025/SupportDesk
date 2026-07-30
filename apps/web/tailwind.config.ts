import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#111827",
          panel: "#f8fafc",
          accent: "#0f766e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
