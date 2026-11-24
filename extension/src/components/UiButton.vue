<script setup lang="ts">
type Variant = 'primary' | 'ghost' | 'danger'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  {
    variant: 'primary',
    disabled: false,
    type: 'button',
  },
)

function variantClass(variant: Variant): string {
  switch (variant) {
    case 'primary':
      return 'bg-blue-500 text-white hover:bg-blue-600'
    case 'ghost':
      return 'border border-gray-700 text-gray-100 hover:bg-gray-800'
    case 'danger':
      return 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
    default: {
      const neverVariant: never = variant
      return neverVariant
    }
  }
}
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled"
    class="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    :class="variantClass(props.variant)"
  >
    <slot />
  </button>
</template>
