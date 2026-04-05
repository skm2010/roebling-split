import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0F1A",
          900: "#0B0F1A",
          800: "#131827",
          700: "#1C2236",
          600: "#2A3249",
        },
        paper: {
          DEFAULT: "#F5EFE0",
          warm: "#EFE7D2",
          soft: "#E8DFC7",
        },
        amber: {
          glow: "#F4A64A",
          deep: "#D97706",
          brand: "#E8962C",
        },
        claret: "#8B2E2E",
        sage: "#6B7F5A",
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        body: ['"Instrument Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04), 0 20px 60px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(244,166,74,0.4), 0 0 40px -8px rgba(244,166,74,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
