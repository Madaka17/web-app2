/** Theme tokens measured from the capture, not a library's defaults. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1200px', '2xl': '1400px' },
    extend: {
      colors: {
        primary: { DEFAULT: '#d32f2f', dark: '#b71c1c' },
        line: '#e0e0e0',
        border: '#e0e0e0',
        surface: { DEFAULT: '#ffffff', soft: '#f5f5f5', 2: '#f5f5f5' },
        ink: { primary: '#1a1a1a', secondary: '#555555', muted: '#aaaaaa' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Kanit', 'Inter', 'system-ui', 'sans-serif'],
        brand: ['Montserrat', 'Kanit', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontWeight: { medium: '500', semibold: '500', bold: '500', extrabold: '800' },
      borderRadius: { md: '8px', lg: '12px', xl: '12px', '2xl': '12px', '3xl': '24px', pill: '999px' },
      maxWidth: { container: '1500px' },
      zIndex: { critical: '2000' },
      boxShadow: { soft: 'none', panel: 'none' },
    },
  },
  plugins: [],
};
