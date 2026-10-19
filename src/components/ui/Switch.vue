<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

function toggle() {
  const newValue = !props.modelValue
  emit('update:modelValue', newValue)
  emit('change', newValue)
}
</script>

<template>
  <div class="flex items-center justify-between">
    <div v-if="label || description">
      <p v-if="label" class="text-sm font-medium text-[var(--text-primary)]">{{ label }}</p>
      <p v-if="description" class="text-xs text-[var(--text-muted)] mt-0.5">{{ description }}</p>
    </div>
    <button
      type="button"
      class="relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none"
      :class="modelValue ? 'bg-[var(--accent-color)]' : 'bg-[var(--text-muted)]'"
      @click="toggle"
    >
      <span
        class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200"
        :class="modelValue ? 'translate-x-6' : 'translate-x-0'"
      ></span>
    </button>
  </div>
</template>
