import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7C3AED",
          light: "#A78BFA",
          dark: "#5B21B6",
        },
        accent: "#EC4899",
        surface: {
          DEFAULT: "#1A1A2E",
          dark: "#0F0F1A",
        },
      },
      animation: {
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(124,58,237,0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(124,58,237,0.6)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
