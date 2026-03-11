/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        quest: {
          purple: '#6B46C1',
          gold: '#F6AD55',
          blue: '#4299E1',
          green: '#48BB78',
          red: '#FC8181',
          dark: '#1A202C',
        },
      },
    },
  },
  plugins: [],
};
