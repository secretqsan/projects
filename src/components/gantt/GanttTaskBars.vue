<script setup>
import { ref, computed, watch } from 'vue'
import GanttTaskBar from './GanttTaskBar.vue'
import {
  dateToPixelOffset,
  offsetToISODate
} from './utils/timeScale.js'
import { addISODays, diffISODays } from '../../utils/date.js'
import { parseDependencies, buildChildrenSet, isParentTask } from './utils/taskUtils.js'
import { calculateDependencyPath } from './utils/bezier.js'
import { hideHoverTip } from '../../utils/hoverTip'

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  rowHeight: { type: Number, required: true },
  centerDate: { type: Date, required: true },
  visibleWidth: { type: Number, required: true },
  pixelsPerDay: { type: Number, required: true },
  dragOffsetX: { type: Number, default: 0 },
  visibleRowRange: {
    type: Object,
    default: () => ({ startRow: 0, endRow: -1 })
  },
  selectedTaskIds: { type: Set, default: () => new Set() }
})

const emit = defineEmits(['update:tasks', 'selection-changed', 'connection-selected'])

const containerRef = ref(null)
// 拖拽期间的临时位置覆盖，仅活动拖拽时存在，tasks 更新后即清除。
// 静止状态下条带与连线统一以任务日期为唯一位置来源，避免双数据源不同步。
const dragOverrides = ref(new Map())
const isDrawingLine = ref(false)
const lineStart = ref(null)
const currentLine = ref(null)
const selectedConnection = ref(null)

const taskBarHeight = computed(() => props.rowHeight * 0.75)
const centerX = computed(() => props.visibleWidth / 2 + props.dragOffsetX)
const totalHeight = computed(() => props.tasks.length * props.rowHeight)
const childrenSet = computed(() => buildChildrenSet(props.tasks))

const selectedTaskId = computed(() => {
  const ids = [...props.selectedTaskIds]
  return ids.length > 0 ? ids[0] : null
})

const taskIndexMap = computed(() => new Map(props.tasks.map((t, i) => [t.id, i])))

const taskBars = computed(() =>
  props.tasks.map((task, index) => ({
    task,
    index,
    top: index * props.rowHeight + (props.rowHeight - taskBarHeight.value) / 2,
    height: taskBarHeight.value,
    leftOffset: dateToPixelOffset(task.start_date, props.centerDate, props.pixelsPerDay),
    rightOffset: dateToPixelOffset(task.end_date, props.centerDate, props.pixelsPerDay),
    hasChildren: childrenSet.value.has(task.id)
  }))
)

const visibleTaskBars = computed(() => {
  const { startRow, endRow } = props.visibleRowRange
  if (endRow < startRow) return []
  return taskBars.value.slice(startRow, endRow + 1)
})

function getEffectiveOffsets(taskId, baseLeft, baseRight) {
  return dragOverrides.value.get(taskId) ?? { leftOffset: baseLeft, rightOffset: baseRight }
}

function getConnectionPointPosition(taskId, point) {
  const taskBar = taskBars.value.find(tb => tb.task.id === taskId)
  if (!taskBar) return null

  const { leftOffset, rightOffset } = getEffectiveOffsets(
    taskId,
    taskBar.leftOffset,
    taskBar.rightOffset
  )
  const y = taskBar.top + taskBarHeight.value / 2
  const x = point === 'left'
    ? centerX.value + leftOffset
    : centerX.value + rightOffset
  return { x, y }
}

const dependencyLines = computed(() => {
  const lines = []
  for (const task of props.tasks) {
    for (const depId of parseDependencies(task.dependencies)) {
      if (!taskIndexMap.value.has(depId)) continue
      const fromPos = getConnectionPointPosition(depId, 'right')
      const toPos = getConnectionPointPosition(task.id, 'left')
      if (!fromPos || !toPos) continue
      lines.push({
        x1: fromPos.x,
        y1: fromPos.y,
        x2: toPos.x,
        y2: toPos.y,
        startDir: 'right',
        fromTaskId: depId,
        toTaskId: task.id,
        id: `${depId}-${task.id}`
      })
    }
  }
  return lines
})

function syncTaskBarPosition(taskId, leftOffset, rightOffset) {
  dragOverrides.value.set(taskId, { leftOffset, rightOffset })
  dragOverrides.value = new Map(dragOverrides.value)
  updateLineStartPosition()
}

// 任务数据更新（拖拽结束的回写或外部编辑）后，位置以日期为准，清除临时覆盖
watch(
  () => props.tasks,
  () => {
    if (dragOverrides.value.size > 0) {
      dragOverrides.value = new Map()
    }
  }
)

function onTaskSelect(task) {
  emit('selection-changed', selectedTaskId.value === task.id ? null : task.id)
}

function commitTaskDates(task, start, end) {
  const duration = Math.max(1, diffISODays(start, end))
  if (task.start_date === start && task.end_date === end && task.duration === duration) {
    dragOverrides.value.delete(task.id)
    dragOverrides.value = new Map(dragOverrides.value)
    return
  }

  dragOverrides.value.set(task.id, {
    leftOffset: dateToPixelOffset(start, props.centerDate, props.pixelsPerDay),
    rightOffset: dateToPixelOffset(end, props.centerDate, props.pixelsPerDay)
  })
  dragOverrides.value = new Map(dragOverrides.value)

  emit('update:tasks', props.tasks.map(item =>
    item.id === task.id
      ? { ...item, start_date: start, end_date: end, duration }
      : item
  ))
}

function onTaskResizeEnd({ task, leftOffset, rightOffset }) {
  let start = offsetToISODate(leftOffset, props.centerDate, props.pixelsPerDay)
  let end = offsetToISODate(rightOffset, props.centerDate, props.pixelsPerDay)
  if (end <= start) end = addISODays(start, 1)
  commitTaskDates(task, start, end)
}

function onTaskMoveEnd({ task, leftOffset, rightOffset }) {
  const start = offsetToISODate(leftOffset, props.centerDate, props.pixelsPerDay)
  const duration = Math.max(1, Math.round((rightOffset - leftOffset) / props.pixelsPerDay))
  commitTaskDates(task, start, addISODays(start, duration))
}

// ========== 依赖连线 ==========

function screenToContainer(x, y) {
  if (!containerRef.value) return { x, y }
  // 容器位于滚动内容内部，getBoundingClientRect 已包含滚动偏移
  const rect = containerRef.value.getBoundingClientRect()
  return { x: x - rect.left, y: y - rect.top }
}

function onConnectionStart({ task, point, x, y }) {
  isDrawingLine.value = true
  lineStart.value = { task, point, x, y }
  currentLine.value = { x1: x, y1: y, x2: x, y2: y, startPoint: point }
}

function onConnectionClick(line) {
  selectedConnection.value = { line }
  emit('connection-selected', { line })
}

function deleteSelectedConnection() {
  if (!selectedConnection.value) return false
  const { fromTaskId, toTaskId } = selectedConnection.value.line
  emit('update:tasks', props.tasks.map(t => {
    if (t.id !== toTaskId) return t
    return { ...t, dependencies: parseDependencies(t.dependencies).filter(id => id !== fromTaskId) }
  }))
  selectedConnection.value = null
  emit('connection-selected', null)
  return true
}

defineExpose({ deleteSelectedConnection })

function addDependency(fromTaskId, toTaskId) {
  const target = props.tasks.find(task => task.id === toTaskId)
  if (!target || isParentTask(props.tasks, target)) return
  emit('update:tasks', props.tasks.map(t => {
    if (t.id !== toTaskId) return t
    const deps = parseDependencies(t.dependencies)
    if (deps.includes(fromTaskId)) return t
    return { ...t, dependencies: [...deps, fromTaskId] }
  }))
}

function onConnectionEnd({ task, point }) {
  const fromTask = lineStart.value?.task
  const startPoint = lineStart.value?.point
  if (isDrawingLine.value && fromTask && fromTask.id !== task.id) {
    if (startPoint === 'right' && point === 'left') {
      addDependency(fromTask.id, task.id)
    } else if (startPoint === 'left' && point === 'right') {
      addDependency(task.id, fromTask.id)
    }
  }
  resetLineDrawing()
}

function resetLineDrawing() {
  isDrawingLine.value = false
  lineStart.value = null
  currentLine.value = null
}

function updateLineStartPosition() {
  if (!isDrawingLine.value || !currentLine.value || !lineStart.value) return
  const newPos = getConnectionPointPosition(lineStart.value.task.id, lineStart.value.point)
  if (!newPos) return
  currentLine.value = { ...currentLine.value, x1: newPos.x, y1: newPos.y }
  lineStart.value = { ...lineStart.value, x: newPos.x, y: newPos.y }
}

function onMouseMove(e) {
  if (!isDrawingLine.value || !currentLine.value) return
  hideHoverTip()
  updateLineStartPosition()
  const pos = screenToContainer(e.clientX, e.clientY)
  currentLine.value = { ...currentLine.value, x2: pos.x, y2: pos.y }
}

function onMouseUp(e) {
  if (!isDrawingLine.value) return
  if (e.target?.closest?.('.connection-point')) return
  resetLineDrawing()
}

</script>

<template>
  <div
    ref="containerRef"
    class="absolute inset-0 z-20 gantt-task-bars-container"
    @mousemove="onMouseMove"
    @mouseleave="hideHoverTip"
    @mouseup="onMouseUp"
    @click="selectedConnection = null; emit('connection-selected', null)"
  >
    <svg
      class="absolute pointer-events-none"
      :style="{
        left: 0,
        top: 0,
        width: '100%',
        height: totalHeight + 'px',
        zIndex: 25,
        overflow: 'visible'
      }"
    >
      <defs>
        <marker
          id="gantt-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon points="0 0, 8 4, 0 8" fill="context-stroke" />
        </marker>
      </defs>

      <path
        v-for="line in dependencyLines"
        :key="line.id"
        :d="calculateDependencyPath(line.startDir, line.x1, line.y1, line.x2, line.y2)"
        :stroke="selectedConnection?.line?.id === line.id ? '#ef4444' : '#3b82f6'"
        stroke-width="2"
        fill="none"
        marker-end="url(#gantt-arrowhead)"
        style="pointer-events: stroke; cursor: pointer;"
        @click.stop="onConnectionClick(line)"
      />

      <path
        v-if="currentLine"
        :d="calculateDependencyPath(currentLine.startPoint, currentLine.x1, currentLine.y1, currentLine.x2, currentLine.y2)"
        stroke="#94a3b8"
        stroke-width="2"
        stroke-dasharray="5 5"
        fill="none"
        marker-end="url(#gantt-arrowhead)"
      />
    </svg>

    <GanttTaskBar
      v-for="{ task, top, height, leftOffset, rightOffset, hasChildren } in visibleTaskBars"
      :key="task.id"
      :task="task"
      :top="top"
      :height="height"
      :is-selected="selectedTaskIds.has(task.id)"
      :center-x="centerX"
      :initial-left-offset="leftOffset"
      :initial-right-offset="rightOffset"
      :has-children="hasChildren"
      :all-tasks="tasks"
      @select="onTaskSelect"
      @connection-start="onConnectionStart"
      @connection-end="onConnectionEnd"
      @resize="({ task, leftOffset, rightOffset }) => syncTaskBarPosition(task.id, leftOffset, rightOffset)"
      @resize-end="onTaskResizeEnd"
      @move="({ task, leftOffset, rightOffset }) => syncTaskBarPosition(task.id, leftOffset, rightOffset)"
      @move-end="onTaskMoveEnd"
    />
  </div>
</template>
