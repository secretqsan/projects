<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['primary', 'secondary', 'danger', 'ghost', 'default'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: null
  },
  title: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['click'])
const slots = useSlots()

const isIconOnly = computed(() => !slots.default)

const variantClasses = {
  primary: 'bg-(--accent-color) text-white hover:bg-(--accent-hover)',
  secondary: 'bg-(--bg-card) text-(--text-primary) hover:bg-(--bg-secondary)',
  danger: 'text-red-600 hover:bg-red-500/10',
  ghost: 'text-(--text-secondary) hover:bg-(--bg-secondary)',
  default: 'text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary)'
}

const sizeClasses = computed(() => ({
  sm: isIconOnly.value ? 'w-7 h-7' : 'px-2.5 py-1.5 text-xs',
  md: isIconOnly.value ? 'w-8 h-8' : 'px-3 py-1.5 text-sm',
  lg: isIconOnly.value ? 'w-10 h-10' : 'px-4 py-2 text-base'
}))

const iconSizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
}

const buttonClasses = computed(() => {
  const classes = [
    'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[props.variant],
    sizeClasses.value[props.size]
  ]

  if (!isIconOnly.value) {
    classes.push('border')
    classes.push(props.variant === 'primary' ? 'border-transparent' : 'border-(--border-color)')
  }

  return classes
})
</script>

<template>
  <button
    type="button"
    :class="buttonClasses"
    :disabled="disabled"
    :title="title"
    @click="emit('click', $event)"
  >
    <i v-if="icon" :class="[icon, iconSizes[size]]" />
    <slot />
  </button>
</template>
