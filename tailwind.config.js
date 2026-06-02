/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#FAFAF8",
        accent: "#2D2D2D",
        "accent-light": "#E8E6E3",
        card: "#FFFFFF",
        muted: "#9E9E9E",
        wash: "#F5F5F3",
      },
    },
  },
  plugins: [],
}
