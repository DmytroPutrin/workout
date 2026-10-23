// Runs before every route change (and on the first server render).
// Every page requires login unless it sets definePageMeta({ guestOnly: true }).
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (to.meta.guestOnly) {
    return loggedIn.value ? navigateTo('/') : undefined
  }

  if (!loggedIn.value) {
    // Remember where they were going so login can send them back
    return navigateTo({
      path: '/login',
      query: to.fullPath === '/' ? undefined : { redirect: to.fullPath },
    })
  }
})
