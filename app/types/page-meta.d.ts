// Custom page meta used by app/middleware/auth.global.ts
declare module '#app' {
  interface PageMeta {
    /** Only for logged-out visitors (login, register). Logged-in users are sent home. */
    guestOnly?: boolean
  }
}

export {}
