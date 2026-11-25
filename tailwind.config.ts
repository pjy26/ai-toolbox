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
          DEFAULT: "#9E4323",
          light: "#B87964",
          dark: "#83371D",
        },
        accent: "#B87964",
        surface: {
          DEFAULT: "#FDFCFA",
          dark: "#F8F6F1",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "sans-serif"],
        serif: ["var(--font-newsreader)", "Noto Serif SC", "Songti SC", "STSong", "serif"],
      },
      boxShadow: {
        soft: "0 12px 32px -8px rgba(28, 25, 23, 0.08)",
        float: "0 24px 64px -24px rgba(28, 25, 23, 0.16)",
      },
      animation: {
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(158, 67, 35, 0.16)" },
          "100%": { boxShadow: "0 0 20px rgba(158, 67, 35, 0.28)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
