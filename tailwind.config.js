import defaultColors from 'tailwindcss/colors';

/**
 * Design tokens for Easy Edits.
 *
 * - `brand` is the primary accent (violet), paired with pink in gradients.
 *   Use brand-600 or darker behind white text (>= 4.5:1 contrast).
 * - `gray-500` is lightened from Tailwind's default so secondary text keeps
 *   WCAG AA contrast on the near-black background and on cards.
 * - `surface` colours are the app background and raised panels.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: defaultColors.violet,
        gray: {
          ...defaultColors.gray,
          500: '#868e9c',
        },
        surface: {
          DEFAULT: '#030014',
          raised: '#0b0920',
          overlay: '#16142a',
        },
        dark: {
          900: '#0a0a0a',
          800: '#171717',
          700: '#262626',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
