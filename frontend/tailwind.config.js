/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        kuara: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        canvas: "var(--kuara-bg)",
        surface: {
          DEFAULT: "var(--kuara-surface)",
          elevated: "var(--kuara-surface-elevated)",
          muted: "var(--kuara-surface-muted)",
          hover: "var(--kuara-surface-hover)",
          sidebar: "var(--kuara-sidebar)",
        },
        line: {
          DEFAULT: "var(--kuara-border)",
          strong: "var(--kuara-border-strong)",
        },
        ink: {
          DEFAULT: "var(--kuara-fg)",
          muted: "var(--kuara-fg-muted)",
          subtle: "var(--kuara-fg-subtle)",
        },
        accent: {
          DEFAULT: "var(--kuara-primary)",
          hover: "var(--kuara-primary-hover)",
          fg: "var(--kuara-primary-fg)",
          soft: "var(--kuara-primary-soft)",
          border: "var(--kuara-primary-border)",
        },
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgba(9, 9, 11, 0.04)",
        modal: "0 16px 40px -12px rgba(9, 9, 11, 0.28), 0 0 0 1px var(--kuara-border)",
      },
    },
  },
  plugins: [],
};
