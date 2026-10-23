// Tells nuxt-auth-utils what we store in the session, so `session.user`
// is typed in both server routes and useUserSession() on the client.
declare module '#auth-utils' {
  interface User {
    id: number
    email: string
  }

  interface UserSession {
    loggedInAt: number
  }
}

export {}
