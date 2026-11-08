/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans Variable"', "system-ui", "sans-serif"] },
      colors: {
        brand: {
          50: "#EFF8EC", 100: "#DCEFD5", 200: "#BCE0AF", 300: "#93CC82", 400: "#5BB44A",
          500: "#3F9A33", 600: "#2C7C28", 700: "#1C6326", 800: "#00502A", 900: "#023F22", 950: "#012615",
        },
        ink: { 900: "#0F1A14", 700: "#2E3B34", 500: "#5E6B64", 400: "#8A958F", 300: "#B8C1BC", 200: "#DDE3DF", 100: "#EEF2EF", 50: "#F6F8F6" },
        st: { r: "#16A34A", s: "#2563EB", c: "#EA8C0C", n: "#DC2626" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,40,24,.04), 0 2px 8px rgba(16,40,24,.04)",
        card: "0 1px 2px rgba(16,40,24,.05), 0 8px 24px -8px rgba(16,40,24,.10)",
        lift: "0 2px 4px rgba(16,40,24,.05), 0 18px 40px -12px rgba(16,40,24,.20)",
        pop: "0 4px 12px rgba(16,40,24,.08), 0 24px 56px -16px rgba(16,40,24,.28)",
        ring: "0 0 0 4px rgba(91,180,74,.18)",
      },
      borderRadius: { xl2: "1.25rem", xl3: "1.75rem" },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: { shimmer: "shimmer 1.4s linear infinite" },
    },
  },
  plugins: [],
};
