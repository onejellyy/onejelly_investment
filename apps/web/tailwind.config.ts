import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Band label colors (neutral terminology)
        'label-top': '#166534',       // green-800
        'label-good': '#3f6212',      // lime-800
        'label-neutral': '#374151',   // gray-700
        'label-low': '#9a3412',       // orange-800
        'label-very-low': '#991b1b',  // red-800
        // Style guide tokens
        'primary': '#2A3F6D',
        'accent': '#4CAF50',
        'surface': '#ECF0F3',
        'surface-dark': '#1A1D2C',
        'card-dark': '#2C3141',
        'secondary-purple': '#673AB7',
        'secondary-orange': '#FF9800',
      },
      boxShadow: {
        'neu': '6px 6px 12px #D1D9E6, -6px -6px 12px #F9F9F9',
        'neu-sm': '3px 3px 6px #D1D9E6, -3px -3px 6px #F9F9F9',
        'neu-inset': 'inset 4px 4px 8px #D1D9E6, inset -4px -4px 8px #F9F9F9',
        'neu-dark': '6px 6px 12px #12141F, -6px -6px 12px #222639',
        'neu-dark-sm': '3px 3px 6px #12141F, -3px -3px 6px #222639',
        'neu-dark-inset': 'inset 4px 4px 8px #12141F, inset -4px -4px 8px #222639',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
export default config;
