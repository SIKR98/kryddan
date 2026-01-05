/** @type {import('tailwindcss').Config} */
// Global design tokens for the entire project.
// Light mode only for now; structure allows easy dark mode later.
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      // Color tokens
      colors: {
        primary: '#F9FAFB', // near-black for text and key UI
        secondary: '#e8e9ebff', // muted gray for secondary text
        'primary-contrast': '#505255ff', // light background for cards/containers
        'secondary-contrast': '#27292bff',
        'primary-accent': '#f0f0f0ff',
        'secondary-accent': '#27292bff',
        hover: '#2563EB' // accent for hover/focus states
      },

      // Font families
      fontFamily: {
        primary: ['Inter', 'system-ui', 'sans-serif'],
        secondary: ['Inter', 'system-ui', 'sans-serif']
      },

      // Spacing scale (xs → xl)
      spacing: {
        xs: '4px',
        s: '8px',
        m: '16px',
        l: '24px',
        xl: '62px'
      },

      // Border radius scale
      borderRadius: {
        s: '4px',
        m: '8px',
        l: '16px'
      }
    }
  },
  plugins: []
};
