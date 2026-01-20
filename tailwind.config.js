/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#A800EB", // Match code.html design
        "primary-dark": "#7e00b0",
        "primary-light": "#F3E5F9",
        secondary: "#F3E5F9", // Light purple background
        "accent-pink": "#FFEDEE", // Urgent tag bg
        "accent-text": "#D9304E", // Urgent tag text
        // Super Admin colors
        "super-admin-primary": "#1E40AF",
        "super-admin-primary-hover": "#1e3a8a",
        "super-admin-background-light": "#F8FAFC",
        "super-admin-background-dark": "#0F172A",
        "super-admin-surface-light": "#FFFFFF",
        "super-admin-surface-dark": "#1E293B",
        "super-admin-border-light": "#E2E8F0",
        "super-admin-border-dark": "#334155",
        "background-light": "#F7F8FA", // Match code.html
        "background-dark": "#121212", // Match code.html
        "background-subtle": "#faf8fc",
        "background-dark-subtle": "#2d1b36",
        "surface-light": "#FFFFFF", // Match code.html
        "surface-dark": "#1E1E1E", // Match code.html
        "text-main": "#1F2937", // Match code.html
        "text-main-light": "#1F2937",
        "text-main-dark": "#E5E7EB", // Match code.html
        "text-light": "#ffffff",
        "text-muted": "#804c9a",
        "text-sub-light": "#804c9a",
        "text-sub-dark": "#bca3c9",
        "text-body": "#374151",
        "text-muted-light": "#9ca3af",
        // Status colors
        "status-overdue": "#D32F2F",
        "status-duesoon": "#EF5350",
        "status-inprogress": "#F57C00",
        "status-completed": "#2E7D32",
        // Chat colors
        "bubble-incoming": "#ffffff",
        "border-light": "#E5E7EB", // Match code.html
        "border-dark": "#374151", // Match code.html
      },
      fontFamily: {
        display: ["Public Sans", "sans-serif"],
        body: ["Noto Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1.5rem",
        full: "9999px",
      },
      boxShadow: {
        "soft": "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        "medium": "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

