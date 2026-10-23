<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{ mode: 'login' | 'register' }>()

const route = useRoute()
const { fetch: refreshSession } = useUserSession()

const isRegister = computed(() => props.mode === 'register')
const schema = computed(() => (isRegister.value ? registerSchema : loginSchema))

const form = reactive({ email: '', password: '' })
const fieldErrors = ref<Record<string, string>>({})
const formError = ref('')
const submitting = ref(false)

async function onSubmit() {
  formError.value = ''
  fieldErrors.value = {}

  // Same Zod schema the API uses: instant feedback, no round trip
  const parsed = schema.value.safeParse(form)
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
    fieldErrors.value = Object.fromEntries(
      Object.entries(flat).map(([field, messages]) => [field, messages?.[0] ?? '']),
    )
    return
  }

  submitting.value = true
  try {
    await $fetch(`/api/auth/${props.mode}`, { method: 'POST', body: parsed.data })
    // The server set the session cookie; reload it into useUserSession()
    await refreshSession()
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (error) {
    fieldErrors.value = getApiFieldErrors(error)
    formError.value = getApiErrorMessage(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm">
    <h1 class="text-2xl font-bold tracking-tight">
      {{ isRegister ? 'Create your account' : 'Welcome back' }}
    </h1>
    <p class="mt-1 text-sm text-zinc-500">
      {{ isRegister ? 'Start logging your workouts.' : 'Log in to continue training.' }}
    </p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="email" class="block text-sm font-medium">Email</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          class="input mt-1.5"
          :aria-invalid="!!fieldErrors.email"
          aria-describedby="email-error"
        />
        <p v-if="fieldErrors.email" id="email-error" class="field-error">{{ fieldErrors.email }}</p>
      </div>

      <div>
        <label for="password" class="block text-sm font-medium">Password</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
          class="input mt-1.5"
          :aria-invalid="!!fieldErrors.password"
          aria-describedby="password-error"
        />
        <p v-if="fieldErrors.password" id="password-error" class="field-error">
          {{ fieldErrors.password }}
        </p>
        <p v-else-if="isRegister" class="mt-1.5 text-xs text-zinc-500">At least 8 characters.</p>
      </div>

      <p v-if="formError" role="alert" class="alert-error">{{ formError }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="submitting">
        {{ submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-zinc-500">
      <template v-if="isRegister">
        Already have an account?
        <NuxtLink :to="{ path: '/login', query: route.query }" class="link">Log in</NuxtLink>
      </template>
      <template v-else>
        New here?
        <NuxtLink :to="{ path: '/register', query: route.query }" class="link">Create an account</NuxtLink>
      </template>
    </p>
  </div>
</template>
