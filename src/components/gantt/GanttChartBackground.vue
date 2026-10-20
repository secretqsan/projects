<script setup>
import { ref } from 'vue'
import GanttCanvas from './GanttCanvas.vue'
import GanttTaskBars from './GanttTaskBars.vue'

const props = defineProps({
  timeSpan: { type: Number, required: true },
  rowHeight: { type: Number, required: true },
  tasks: { type: Array, default: () => [] },
  selectedTaskIds: { type: Set, default: () => new Set() }
})

const emit = defineEmits(['update:tasks', 'selection-changed', 'connection-selected'])

const ganttTaskBarsRef = ref(null)
const today = new Date()
const centerDate = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

function deleteSelectedConnection() {
  return ganttTaskBarsRef.value?.deleteSelectedConnection?.() || false
}

defineExpose({ deleteSelectedConnection })
</script>

<template>
  <div class="relative w-full h-full gantt-background">
    <GanttCanvas
      v-model:center-date="centerDate"
      :time-span="timeSpan"
      :row-height="rowHeight"
      :task-count="tasks.length"
    >
      <template #default="canvasState">
        <GanttTaskBars
          ref="ganttTaskBarsRef"
          :tasks="tasks"
          :row-height="rowHeight"
          :center-date="centerDate"
          :visible-width="canvasState.visibleWidth"
          :drag-offset-x="canvasState.dragOffsetX"
          :visible-row-range="canvasState.visibleRowRange"
          :pixels-per-day="canvasState.pixelsPerDay"
          :selected-task-ids="selectedTaskIds"
          class="z-30"
          @update:tasks="emit('update:tasks', $event)"
          @selection-changed="emit('selection-changed', $event)"
          @connection-selected="emit('connection-selected', $event)"
        />
      </template>
    </GanttCanvas>
  </div>
</template>
