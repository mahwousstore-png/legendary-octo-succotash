/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './hooks/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}', './types/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Luxury Gold Color Palette
        gold: {
          50: '#FDF8E8',
          100: '#F9EEC6',
          200: '#F3DDA0',
          300: '#EDCC7A',
          400: '#E4BD5B',
          500: '#D4AF37', // Primary Gold
          600: '#B8962E',
          700: '#9A7D26',
          800: '#7C641E',
          900: '#5E4B16',
        },
        // Royal Black
        royal: {
          50: '#F5F5F5',
          100: '#E0E0E0',
          200: '#B0B0B0',
          300: '#808080', // Gray for secondary text
          400: '#505050',
          500: '#333333',
          600: '#222222',
          700: '#181818',
          800: '#111111', // Royal Black
          900: '#000000', // Pure Black
        },
        // Soft Beige for borders
        beige: {
          100: '#F5F3EE',
          200: '#E8E6D9', // Primary Beige for borders
          300: '#D9D6C9',
          400: '#C9C5B8',
        },
        // Page Background Gray
        page: {
          100: '#F5F5F7', // Page background
          200: '#EEEEEE',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float-delayed 8s ease-in-out infinite',
        'loading-bar': 'loading-bar 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'slideInUp': 'slideInUp 0.6s ease-out',
        'fadeIn': 'fadeIn 0.8s ease-out',
        'scaleIn': 'scaleIn 0.5s ease-out',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
        'glow': '0 0 20px rgba(212, 175, 55, 0.4)',
        'gold': '0 4px 14px 0 rgba(212, 175, 55, 0.25)',
        'luxury': '0 10px 40px rgba(0, 0, 0, 0.12)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #D4AF37 0%, #F3DDA0 50%, #D4AF37 100%)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
