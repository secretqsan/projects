<script setup>
import { computed } from 'vue'

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

const statusConfig = {
  pending: {
    label: '待处理',
    class: 'bg-yellow-500/15 text-yellow-600'
  },
  in_progress: {
    label: '进行中',
    class: 'bg-blue-500/15 text-blue-600'
  },
  completed: {
    label: '已完成',
    class: 'bg-green-500/15 text-green-600'
  },
  overdue: {
    label: '已逾期',
    class: 'bg-red-500/15 text-red-600'
  }
}

const displayLabel = computed(() =>
  props.label || statusConfig[props.status]?.label || props.status
)

const statusClass = computed(() =>
  statusConfig[props.status]?.class || 'bg-gray-500/15 text-gray-600'
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
