<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { snapOffsetToDay } from './utils/timeScale.js'
import { taskStatusColor } from './utils/taskUtils.js'
import { showHoverTip, hideHoverTip } from '../../utils/hoverTip'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  top: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  centerX: {
    type: Number,
    required: true
  },
  initialLeftOffset: {
    type: Number,
    default: -60
  },
  initialRightOffset: {
    type: Number,
    default: 60
  },
  centerDate: {
    type: Date,
    required: true
  },
  pixelsPerDay: {
    type: Number,
    required: true
  },
  hasChildren: {
    type: Boolean,
    default: false
  },
  allTasks: {
    type: Array,
    default: () => []
  }
})

const { t } = useI18n()
const emit = defineEmits(['select', 'connection-start', 'connection-end', 'resize-end', 'resize', 'move-end', 'move'])

// 是否显示连接点
const isHovered = ref(false)
const showConnectionPoints = ref(false)

// 调整大小状态
const isResizing = ref(false)
const resizeDirection = ref(null) // 'left' 或 'right'
const resizeStartX = ref(0)

// 拖动移动状态
const isMoving = ref(false)
const moveStartX = ref(0)

// 任务条的左右位置（相对于容器中心）
const leftOffset = ref(props.initialLeftOffset)
const rightOffset = ref(props.initialRightOffset)

// 拖动/调整期间由本地状态驱动，避免父子往返导致卡顿；
// 静止时跟随日期推导的初始位置（唯一数据源）
watch(() => [props.initialLeftOffset, props.initialRightOffset], ([newLeft, newRight]) => {
  if (isResizing.value || isMoving.value) return
  leftOffset.value = newLeft
  rightOffset.value = newRight
})

const width = computed(() => rightOffset.value - leftOffset.value)
const left = computed(() => props.centerX + leftOffset.value)

function taskTip() {
  const task = props.task
  const lines = [task.name || t('gantt.unnamed')]
  const statusKey = `status.${task.status}`
  const status = t(statusKey)
  if (task.status && status !== statusKey) lines.push(t('gantt.statusLine', { status }))
  if (task.start_date || task.end_date) {
    lines.push(`${task.start_date || '—'} → ${task.end_date || '—'}`)
  }
  if (task.note) lines.push(t('gantt.noteLine', { note: task.note }))
  return lines.join('\n')
}

function onBarMouseMove(event) {
  if (isMoving.value || isResizing.value || event.target?.closest?.('.resize-handle, .connection-point')) {
    hideHoverTip()
    return
  }
  showHoverTip(taskTip(), event)
}

function onBarMouseLeave() {
  hideHoverTip()
  hideConnectionPointsSoon()
}

function onMouseEnter() {
  isHovered.value = true
  showConnectionPoints.value = true
}

function onPointMouseEnter() {
  isHovered.value = true
}

const { start: hideConnectionPointsSoonTimer } = useTimeoutFn(() => {
  if (!isHovered.value && !isResizing.value) {
    showConnectionPoints.value = false
  }
}, 200, { immediate: false })

function hideConnectionPointsSoon() {
  isHovered.value = false
  hideConnectionPointsSoonTimer()
}

function onTaskClick(e) {
  e.stopPropagation()
  emit('select', props.task)
}

// ========== 连接点 ==========

function onPointMouseDown(e, point) {
  e.stopPropagation()
  emit('connection-start', {
    task: props.task,
    point,
    x: point === 'left' ? left.value : left.value + width.value,
    y: props.top + props.height / 2
  })
}

function onPointMouseUp(e, point) {
  e.stopPropagation()
  emit('connection-end', { task: props.task, point })
}

// ========== 调整大小 ==========

const POINTER_THRESHOLD = 4
let resizeOriginX = 0
let resizeDragged = false
let rawLeft = 0
let rawRight = 0
let moveDurationDays = 1

function snapOffset(offset) {
  return snapOffsetToDay(offset, props.centerDate, props.pixelsPerDay)
}

function onResizeStart(e, direction) {
  e.stopPropagation()
  e.preventDefault()
  isResizing.value = true
  resizeDragged = false
  resizeDirection.value = direction
  resizeOriginX = e.clientX
  resizeStartX.value = e.clientX
  rawLeft = leftOffset.value
  rawRight = rightOffset.value
}

function onResizeMove(e) {
  if (!isResizing.value) return
  if (!resizeDragged && Math.abs(e.clientX - resizeOriginX) < POINTER_THRESHOLD) return
  resizeDragged = true

  const deltaX = e.clientX - resizeStartX.value
  resizeStartX.value = e.clientX
  const minWidth = props.pixelsPerDay || 20

  if (resizeDirection.value === 'left') {
    rawLeft += deltaX
    leftOffset.value = Math.min(snapOffset(rawLeft), rightOffset.value - minWidth)
  } else {
    rawRight += deltaX
    rightOffset.value = Math.max(snapOffset(rawRight), leftOffset.value + minWidth)
  }

  emit('resize', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value
  })
}

function onResizeEnd() {
  if (!isResizing.value) return
  const didResize = resizeDragged
  isResizing.value = false
  resizeDragged = false
  resizeDirection.value = null
  if (!didResize) return

  emit('resize-end', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value
  })
}

// ========== 拖动移动 ==========

let moveOriginX = 0
let moveDragged = false
const moveListening = ref(false)

function onTaskMouseDown(e) {
  if (e.button !== 0) return
  if (e.target.closest('.resize-handle') || e.target.closest('.connection-point')) return

  e.stopPropagation()
  moveListening.value = true
  moveDragged = false
  moveOriginX = e.clientX
  moveStartX.value = e.clientX
  rawLeft = leftOffset.value
  rawRight = rightOffset.value
}

function onTaskMove(e) {
  if (!moveListening.value) return
  if (!moveDragged && Math.abs(e.clientX - moveOriginX) < POINTER_THRESHOLD) return
  if (!moveDragged) {
    moveDragged = true
    isMoving.value = true
    moveDurationDays = Math.max(1, Math.round((rawRight - rawLeft) / props.pixelsPerDay))
  }

  rawLeft += e.clientX - moveStartX.value
  moveStartX.value = e.clientX
  leftOffset.value = snapOffset(rawLeft)
  rightOffset.value = leftOffset.value + moveDurationDays * props.pixelsPerDay

  emit('move', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value
  })
}

function onTaskMoveEnd() {
  if (!moveListening.value) return
  const didMove = moveDragged
  moveListening.value = false
  moveDragged = false
  moveOriginX = 0
  isMoving.value = false
  if (!didMove) return

  emit('move-end', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value
  })
}

const resizeTarget = computed(() => (isResizing.value ? document : null))
const moveTarget = computed(() => (moveListening.value ? document : null))
useEventListener(resizeTarget, 'mousemove', onResizeMove)
useEventListener(resizeTarget, 'mouseup', onResizeEnd)
useEventListener(moveTarget, 'mousemove', onTaskMove)
useEventListener(moveTarget, 'mouseup', onTaskMoveEnd)

// ========== 样式 ==========

const taskBarColor = computed(() => taskStatusColor(props.task, props.allTasks))

const taskBarStyle = computed(() => ({
  left: left.value + 'px',
  top: props.top + 'px',
  width: width.value + 'px',
  height: props.height + 'px',
  backgroundColor: taskBarColor.value,
  zIndex: props.isSelected ? 40 : 30
}))
</script>

<template>
  <div
    class="absolute rounded cursor-move hover:opacity-80 px-4 select-none group flex items-center justify-center transition-opacity"
    :class="{ 'ring-2 ring-blue-400': isSelected, 'cursor-grabbing': isMoving }"
    :style="taskBarStyle"
    @click="onTaskClick"
    @mouseenter="onMouseEnter"
    @mousemove="onBarMouseMove"
    @mouseleave="onBarMouseLeave"
    @mousedown="onTaskMouseDown"
  >
    <!-- 任务名称 -->
    <span class="text-xs text-white truncate block text-center">
      {{ task.name }}
    </span>

    <!-- 倒U形标记 - 表示有子任务 -->
    <div
      v-if="hasChildren"
      class="absolute left-2 right-2 top-1.5 h-1.5 pointer-events-none border-t-2 border-l-2 border-r-2 border-white/60 rounded-t-sm"
    ></div>

    <!-- 左侧连接点和调整大小区域 -->
    <div
      v-if="showConnectionPoints || isResizing"
      class="resize-handle absolute left-0 top-0 h-full flex items-center cursor-ew-resize"
      :style="{ width: '8px', transform: 'translateX(-50%)' }"
      @mouseenter="onPointMouseEnter"
      @mouseleave="hideConnectionPointsSoon"
      @mousedown="onResizeStart($event, 'left')"
    >
      <div
        class="connection-point w-3 h-3 bg-black rounded-full hover:scale-125 transition-transform absolute left-1/2 -translate-x-1/2"
        @mousedown.stop="onPointMouseDown($event, 'left')"
        @mouseup.stop="onPointMouseUp($event, 'left')"
      ></div>
    </div>

    <!-- 右侧连接点和调整大小区域 -->
    <div
      v-if="showConnectionPoints || isResizing"
      class="resize-handle absolute right-0 top-0 h-full flex items-center cursor-ew-resize"
      :style="{ width: '8px', transform: 'translateX(50%)' }"
      @mouseenter="onPointMouseEnter"
      @mouseleave="hideConnectionPointsSoon"
      @mousedown="onResizeStart($event, 'right')"
    >
      <div
        class="connection-point w-3 h-3 bg-black rounded-full hover:scale-125 transition-transform absolute left-1/2 -translate-x-1/2"
        @mousedown.stop="onPointMouseDown($event, 'right')"
        @mouseup.stop="onPointMouseUp($event, 'right')"
      ></div>
    </div>
  </div>
</template>
