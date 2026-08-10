import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#0a0b0d",
        panel: "#131519",
        panel2: "#1a1d22",
        panel3: "#20242b",
        border: "#23262c",
        borderBright: "#383e46",
        textPrimary: "#eef0f2",
        textSecondary: "#838a94",
        textTertiary: "#565c66",
        amber: "#ffb300",
        teal: "#00c2a8",
        red: "#ff5a5a",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
