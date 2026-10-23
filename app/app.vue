<template>
  <div class="min-h-dvh">
    <header class="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
          <span class="text-brand-600">●</span> Workout Tracker
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8">
      <NuxtPage />
    </main>
  </div>
</template>
