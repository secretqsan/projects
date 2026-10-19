<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { areDependenciesCompleted } from './utils/taskUtils.js'

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
  hasChildren: {
    type: Boolean,
    default: false
  },
  allTasks: {
    type: Array,
    default: () => []
  }
})

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

function onMouseEnter() {
  isHovered.value = true
  showConnectionPoints.value = true
}

function onPointMouseEnter() {
  isHovered.value = true
}

let hideTimer = null

function hideConnectionPointsSoon() {
  isHovered.value = false
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (!isHovered.value && !isResizing.value) {
      showConnectionPoints.value = false
    }
  }, 200)
}

onUnmounted(() => {
  clearTimeout(hideTimer)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.removeEventListener('mousemove', onTaskMove)
  document.removeEventListener('mouseup', onTaskMoveEnd)
})

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

function onResizeStart(e, direction) {
  e.stopPropagation()
  e.preventDefault()
  isResizing.value = true
  resizeDragged = false
  resizeDirection.value = direction
  resizeOriginX = e.clientX
  resizeStartX.value = e.clientX

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e) {
  if (!isResizing.value) return
  if (!resizeDragged && Math.abs(e.clientX - resizeOriginX) < POINTER_THRESHOLD) return
  resizeDragged = true

  const deltaX = e.clientX - resizeStartX.value
  resizeStartX.value = e.clientX

  const minWidth = 20
  if (resizeDirection.value === 'left') {
    leftOffset.value = Math.min(leftOffset.value + deltaX, rightOffset.value - minWidth)
  } else {
    rightOffset.value = Math.max(rightOffset.value + deltaX, leftOffset.value + minWidth)
  }

  emit('resize', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value,
    direction: resizeDirection.value
  })
}

function onResizeEnd() {
  const didResize = resizeDragged
  isResizing.value = false
  resizeDragged = false
  resizeDirection.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  if (!didResize) return

  emit('resize-end', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value,
    direction: resizeDirection.value
  })
}

// ========== 拖动移动 ==========

let moveOriginX = 0
let moveDragged = false
let moveListening = false

function onTaskMouseDown(e) {
  if (e.button !== 0) return
  if (e.target.closest('.resize-handle') || e.target.closest('.connection-point')) return

  e.stopPropagation()
  moveListening = true
  moveDragged = false
  moveOriginX = e.clientX
  moveStartX.value = e.clientX

  document.addEventListener('mousemove', onTaskMove)
  document.addEventListener('mouseup', onTaskMoveEnd)
}

function onTaskMove(e) {
  if (!moveListening) return
  if (!moveDragged && Math.abs(e.clientX - moveOriginX) < POINTER_THRESHOLD) return
  if (!moveDragged) {
    moveDragged = true
    isMoving.value = true
  }

  const deltaX = e.clientX - moveStartX.value
  moveStartX.value = e.clientX
  leftOffset.value += deltaX
  rightOffset.value += deltaX

  emit('move', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value
  })
}

function onTaskMoveEnd() {
  if (!moveListening) return
  const didMove = moveDragged
  moveListening = false
  moveDragged = false
  moveOriginX = 0
  isMoving.value = false
  document.removeEventListener('mousemove', onTaskMove)
  document.removeEventListener('mouseup', onTaskMoveEnd)
  if (!didMove) return

  emit('move-end', {
    task: props.task,
    leftOffset: leftOffset.value,
    rightOffset: rightOffset.value
  })
}

// ========== 样式 ==========

const taskBarColor = computed(() => {
  const depsCompleted = areDependenciesCompleted(props.task, props.allTasks)

  const statusColors = {
    'pending': depsCompleted ? '#f97316' : '#94a3b8',   // 橙色 - 待办(依赖完成) | 灰色 - 待办(依赖未完成)
    'in_progress': '#3b82f6',  // 蓝色 - 进行中
    'completed': '#22c55e',    // 绿色 - 已完成
    'overdue': '#ef4444'       // 红色 - 逾期
  }
  return statusColors[props.task.status] || props.task.color || '#3b82f6'
})

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
    @mouseleave="hideConnectionPointsSoon"
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
