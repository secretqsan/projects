<script setup>
const props = defineProps({
  label: {
    type: String,
    required: true
  },
  removable: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'success', 'warning', 'danger'].includes(value)
  }
})

const emit = defineEmits(['remove'])

const variantClasses = {
  primary: 'bg-(--accent-color) text-white',
  secondary: 'bg-(--bg-secondary) text-(--text-primary) border border-(--border-color)',
  success: 'bg-green-500 text-white',
  warning: 'bg-yellow-500 text-white',
  danger: 'bg-red-500 text-white'
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs whitespace-nowrap"
    :class="variantClasses[props.variant]"
  >
    {{ props.label }}
    <button
      v-if="props.removable"
      type="button"
      class="cursor-pointer text-sm leading-none px-0.5 rounded hover:bg-white/30 transition-colors"
      @click.stop="emit('remove')"
    >
      <i class="pi pi-times"></i>
    </button>
  </span>
</template>
