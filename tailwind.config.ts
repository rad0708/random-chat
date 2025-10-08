import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        secondary: '#6366F1',
        dark: '#111827',
        light: '#F9FAFB',
      },
      borderRadius: {
        '2xl': '1rem'
      }
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
export default config;
