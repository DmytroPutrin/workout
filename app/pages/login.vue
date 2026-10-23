<script setup lang="ts">
definePageMeta({ guestOnly: true })
useHead({ title: 'Log in · Workout Tracker' })
</script>

<template>
  <AuthForm mode="login" />
</template>
