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
      },
    },
  },
  plugins: [],
};
export default config;
