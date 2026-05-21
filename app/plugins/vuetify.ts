import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

const dark = {
  dark: true,
  colors: {
    background: '#121212',
    surface: '#1e1e1e',
    primary: '#90caf9',
    secondary: '#ce93d8',
    error: '#f44336',
  },
}

const light = {
  dark: false,
  colors: {
    primary: '#1565c0',
    secondary: '#7b1fa2',
  },
}

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    ssr: true,
    theme: {
      defaultTheme: 'dark',
      themes: { dark, light },
    },
  })
  app.vueApp.use(vuetify)
})
