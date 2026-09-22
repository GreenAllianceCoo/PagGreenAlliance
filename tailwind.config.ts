import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1A3C57",
        green: "#1E6652",
        "surface-muted": "#F4F6F4",
      },
    },
  },
  plugins: [],
};
export default config;
