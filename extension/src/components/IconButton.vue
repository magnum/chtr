<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    class="grid size-9 shrink-0 place-items-center rounded-md text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
  >
    <slot />
  </button>
</template>
