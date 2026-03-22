/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#07131c',
        bgAccent: '#102737',
        panelBg: 'rgba(10, 24, 34, 0.82)',
        primary: '#51a7ff',
        success: '#6ee7b7',
        danger: '#fb7185',
        warning: '#fbbf24',
        textMain: '#f8fafc',
        textMuted: '#9eb2c7',
        borderMuted: 'rgba(148, 163, 184, 0.18)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'app-gradient': 'radial-gradient(circle at top left, rgba(81, 167, 255, 0.16), transparent 32%), radial-gradient(circle at bottom right, rgba(110, 231, 183, 0.14), transparent 28%), linear-gradient(160deg, #061019 0%, #091923 46%, #0d2230 100%)',
      },
      boxShadow: {
        'glass': '0 20px 45px rgba(3, 7, 18, 0.35)',
        'modal': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
