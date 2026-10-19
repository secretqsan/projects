<script setup>
import { ref, computed } from 'vue'
import ZoomSlider from '../ui/ZoomSlider.vue'
import GanttChartBackground from './GanttChartBackground.vue'

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  selectedTaskIds: { type: Set, default: () => new Set() }
})

const emit = defineEmits(['update:tasks', 'selection-changed', 'connection-selected'])

const ganttChartBackgroundRef = ref(null)

function deleteSelectedConnection() {
  return ganttChartBackgroundRef.value?.deleteSelectedConnection?.() || false
}

defineExpose({ deleteSelectedConnection })

const minRowHeight = 20
const maxRowHeight = 80
const zoomPercent = ref(50)
const minZoom = 10
const maxZoom = 100

const rowHeight = computed(() =>
  minRowHeight + (maxRowHeight - minRowHeight) * (zoomPercent.value - minZoom) / (maxZoom - minZoom)
)

const timeSpanDays = ref(30)
const minTimeSpan = 7
const maxTimeSpan = 365
</script>

<template>
  <div class="flex h-full bg-[var(--bg-card)]">
    <div class="flex-1 flex flex-col min-w-0">
      <div class="flex-1 relative overflow-hidden">
        <GanttChartBackground
          ref="ganttChartBackgroundRef"
          :time-span="timeSpanDays"
          :row-height="rowHeight"
          :tasks="tasks"
          :selected-task-ids="selectedTaskIds"
          @update:tasks="emit('update:tasks', $event)"
          @selection-changed="emit('selection-changed', $event)"
          @connection-selected="emit('connection-selected', $event)"
        />
      </div>

      <div class="h-10 px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0 flex items-center gap-3">
        <i class="pi pi-calendar text-xs text-[var(--text-muted)]"></i>
        <span class="text-xs text-[var(--text-muted)] whitespace-nowrap">时间跨度</span>
        <ZoomSlider
          v-model="timeSpanDays"
          :min="minTimeSpan"
          :max="maxTimeSpan"
          :step="1"
          direction="horizontal"
          :label-formatter="(v) => v + '天'"
          class="flex-1"
        />
      </div>
    </div>

    <div class="w-12 border-l border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0">
      <div class="h-full flex flex-col items-center gap-2 py-3 px-2 min-h-0">
        <i class="pi pi-search-plus text-xs text-[var(--text-muted)] flex-shrink-0"></i>
        <ZoomSlider
          v-model="zoomPercent"
          :min="minZoom"
          :max="maxZoom"
          :step="5"
          direction="vertical"
          :show-label="false"
          class="flex-1 w-full min-h-0"
        />
        <i class="pi pi-search-minus text-xs text-[var(--text-muted)] flex-shrink-0"></i>
        <span class="text-xs text-[var(--text-muted)] font-medium">{{ zoomPercent }}%</span>
      </div>
    </div>
  </div>
</template>
