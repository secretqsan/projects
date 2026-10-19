<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  minLeftWidth: {
    type: Number,
    default: 200
  },
  maxLeftWidth: {
    type: Number,
    default: 600
  },
  initialLeftWidth: {
    type: Number,
    default: 384
  }
})

const leftWidth = ref(props.initialLeftWidth)
const isResizing = ref(false)
const containerRef = ref(null)

function startResize() {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e) {
  if (!isResizing.value || !containerRef.value) return

  const containerRect = containerRef.value.getBoundingClientRect()
  const newWidth = e.clientX - containerRect.left

  leftWidth.value = Math.max(props.minLeftWidth, Math.min(props.maxLeftWidth, newWidth))
}

function stopResize() {
  isResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div ref="containerRef" class="flex h-full overflow-hidden">
    <!-- 左侧面板 -->
    <div
      class="flex flex-col h-full overflow-hidden bg-[var(--bg-card)]"
      :style="{ width: leftWidth + 'px' }"
    >
      <slot name="left" />
    </div>

    <!-- 拖动条 -->
    <div
      class="w-1 cursor-col-resize bg-[var(--border-color)] hover:bg-[var(--accent-color)] transition-colors flex items-center justify-center"
      :class="{ 'bg-[var(--accent-color)]': isResizing }"
      @mousedown="startResize"
    >
      <div class="w-0.5 h-8 bg-[var(--text-muted)] rounded-full opacity-50"></div>
    </div>

    <!-- 右侧面板 -->
    <div class="flex-1 flex flex-col h-full overflow-hidden min-w-0">
      <slot name="right" />
    </div>
  </div>
</template>
