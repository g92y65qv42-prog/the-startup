import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg: '#1C1C1E',
        panel: '#2C2C2E',
        accent: '#0A84FF',
        danger: '#FF453A',
        warn: '#FF9F0A',
        success: '#32D74B',
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(235,235,245,0.6)',
          tertiary: 'rgba(235,235,245,0.3)'
        },
        border: 'rgba(255,255,255,0.06)'
      },
      borderRadius: {
        panel: '12px',
        modal: '16px'
      },
      fontFamily: {
        sans: ['"SF Pro Display"', '"SF Pro Text"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
