import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1115",
        panel: "#151820",
        raised: "#1b1f2a",
        line: "#272c38",
        fg: "#d6dae3",
        dim: "#8089a0",
        accent: "#6aa7ff",
        ok: "#4cc38a",
        warn: "#e6b450",
        bad: "#f0646e",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
