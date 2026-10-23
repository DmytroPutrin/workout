import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['nuxt-auth-utils'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  // Server-only config. Override any key with an env var:
  // databaseUrl -> NUXT_DATABASE_URL, databaseAuthToken -> NUXT_DATABASE_AUTH_TOKEN
  runtimeConfig: {
    databaseUrl: 'file:local.db',
    databaseAuthToken: '',
  },

  app: {
    head: {
      title: 'Workout Tracker',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
