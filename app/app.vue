<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()

async function logout() {
  // clear() calls DELETE /api/_auth/session (provided by nuxt-auth-utils)
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
          <span class="text-brand-600">●</span> Workout Tracker
        </NuxtLink>

        <div v-if="loggedIn" class="flex items-center gap-3">
          <span class="hidden text-sm text-zinc-500 sm:inline">{{ user?.email }}</span>
          <button class="btn-secondary" @click="logout">Log out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8">
      <NuxtPage />
    </main>
  </div>
</template>
