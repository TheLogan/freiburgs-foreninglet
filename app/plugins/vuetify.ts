import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

// Colours taken from the Freiburg Google Sites page this app is embedded in.
const freiburg = {
  dark: false,
  colors: {
    background: '#f5f2f0',
    surface: '#ffffff',
    'surface-variant': '#4f474e',
    primary: '#4f474e',
    'on-primary': '#ffffff',
    secondary: '#ffd54f',
    'on-secondary': '#1a1a1a',
    'on-background': '#1a1a1a',
    'on-surface': '#1a1a1a',
    error: '#b3261e',
    divider: '#d0cdcb',
  },
}

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    ssr: true,
    theme: {
      defaultTheme: 'freiburg',
      themes: { freiburg },
    },
  })
  app.vueApp.use(vuetify)
})
