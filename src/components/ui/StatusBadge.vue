<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  status: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: ''
  }
})

const { t } = useI18n()

const statusConfig = {
  pending: 'bg-yellow-500/15 text-yellow-600',
  in_progress: 'bg-blue-500/15 text-blue-600',
  completed: 'bg-green-500/15 text-green-600',
  overdue: 'bg-red-500/15 text-red-600'
}

const displayLabel = computed(() => {
  if (props.label) return props.label
  const key = `status.${props.status}`
  const label = t(key)
  return label === key ? props.status : label
})

const statusClass = computed(() =>
  statusConfig[props.status] || 'bg-gray-500/15 text-gray-600'
)
</script>

<template>
  <span
    class="inline-block px-2 py-0.5 rounded text-xs font-medium"
    :class="statusClass"
  >
    {{ displayLabel }}
  </span>
</template>
