/** @type {import('tailwindcss').Config} */
// Global design tokens for the entire project.
// Light mode only for now; structure allows easy dark mode later.
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      // Color tokens
      colors: {
        primary: '#111827', // near-black for text and key UI
        secondary: '#6B7280', // muted gray for secondary text
        'primary-contrast': '#FFFFFF',
        'secondary-contrast': '#F9FAFB',
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
        xl: '32px'
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
