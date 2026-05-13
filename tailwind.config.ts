import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E8F7F1",
          100: "#D1EFE3",
          200: "#A8DFC7",
          300: "#7ECEAB",
          400: "#4FB78A",
          500: "#1D9E75",
          600: "#0F6E56",
          700: "#085041",
          800: "#06382E",
          900: "#04231D",
        },
        ink: {
          50: "#FAFAF9",
          100: "#F4F4F2",
          200: "#E7E6E2",
          300: "#D5D3CD",
          400: "#A09E97",
          500: "#6E6C66",
          600: "#4A4944",
          700: "#2F2E2B",
          800: "#1B1A18",
          900: "#0F0E0D",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
