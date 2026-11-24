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
      return 'bg-blue-600 text-white hover:bg-blue-700'
    case 'ghost':
      return 'border border-gray-300 text-gray-900 hover:bg-gray-100'
    case 'danger':
      return 'bg-red-50 text-red-700 hover:bg-red-100'
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
    class="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    :class="variantClass(props.variant)"
  >
    <slot />
  </button>
</template>
