import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: {
    background: "#faf9f4", foreground: "#192e28", primary: "#174e41",
    border: "#d9ded5", muted: "#f1f3ec", card: "#ffffff",
  } } },
  plugins: [],
} satisfies Config;
