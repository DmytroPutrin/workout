<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()

async function logout() {
  // clear() calls DELETE /api/_auth/session (provided by nuxt-auth-utils)
  await clear()
  await navigateTo('/login')
}

// Simple 24×24 stroke icons
const NAV = [
  { to: '/', label: 'Workout', icon: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12' },
  { to: '/history', label: 'History', icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2' },
  { to: '/progress', label: 'Progress', icon: 'M4 19h16M5 15l4-4 4 3 6-7' },
  { to: '/exercises', label: 'Exercises', icon: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
]

function isActive(to: string) {
  // A workout page belongs to the Workout tab
  if (to === '/') return route.path === '/' || route.path.startsWith('/workouts/')
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <div class="flex items-center gap-6">
          <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
            <span class="text-brand-600">●</span> Workout Tracker
          </NuxtLink>

          <!-- Wider screens: links in the header -->
          <nav v-if="loggedIn" class="hidden items-center gap-4 text-sm sm:flex" aria-label="Main">
            <NuxtLink
              v-for="item in NAV"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              :class="isActive(item.to) && 'nav-link-active'"
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <div v-if="loggedIn" class="flex items-center gap-3">
          <span class="hidden text-sm text-zinc-500 md:inline">{{ user?.email }}</span>
          <button class="btn-secondary" @click="logout">Log out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8" :class="loggedIn && 'pb-28 sm:pb-8'">
      <NuxtPage />
    </main>

    <!-- Phones: tab bar at the bottom, within thumb reach -->
    <nav
      v-if="loggedIn"
      class="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
      aria-label="Main"
    >
      <div class="grid grid-cols-4">
        <NuxtLink
          v-for="item in NAV"
          :key="item.to"
          :to="item.to"
          class="flex flex-col items-center gap-1 py-2 text-[11px] font-medium"
          :class="isActive(item.to) ? 'text-brand-600' : 'text-zinc-500'"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
