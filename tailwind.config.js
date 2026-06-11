/** @type {import('tailwindcss').Config} */
module.exports = {
  // This tells Tailwind to look for classNames inside App.tsx and your entire src folder!
  content: [
    "./App.{js,jsx,ts,tsx}", 
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}