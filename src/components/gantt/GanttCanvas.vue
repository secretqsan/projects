<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useEventListener, useRafFn, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { getPixelsPerDay, addDays, MS_PER_DAY } from './utils/timeScale.js'
import { getVisibleRowRange } from './utils/taskUtils.js'
import { computeYearIndicators } from './utils/virtualIndicators.js'
import { todayISO, formatDateShort } from '../../utils/date.js'

const props = defineProps({
  timeSpan: { type: Number, required: true },
  rowHeight: { type: Number, required: true },
  taskCount: { type: Number, default: 0 },
  centerDate: { type: Date, required: true }
})

const emit = defineEmits(['update:centerDate'])

const rootRef = ref(null)
const scrollRef = ref(null)
const canvasRef = ref(null)

const visibleWidth = ref(800)
const scrollTop = ref(0)
const viewportHeight = ref(600)
const dragOffsetX = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)

const MAX_TICK_COUNT = 15
const pixelsPerDay = computed(() => getPixelsPerDay(visibleWidth.value, props.timeSpan))
const totalHeight = computed(() => Math.max(props.taskCount, 1) * props.rowHeight)

// 刻度锚定在日期上（与任务条带同一套数学）：先确定覆盖视口的刻度日期，
// 再由日期推导像素位置。平移提交换算 centerDate 后，每个刻度日期对应的像素位置完全连续。
const TICK_EPOCH_MS = new Date('2000-01-01').getTime()

const renderIndicators = computed(() => {
  const count = Math.min(props.timeSpan, MAX_TICK_COUNT)
  const ppd = pixelsPerDay.value
  const centerX = visibleWidth.value / 2
  const intervalMs = (props.timeSpan / count) * MS_PER_DAY
  const centerMs = props.centerDate.getTime()

  const leftMs = centerMs - ((centerX + dragOffsetX.value) / ppd) * MS_PER_DAY
  const rightMs = centerMs + ((visibleWidth.value - centerX - dragOffsetX.value) / ppd) * MS_PER_DAY
  const kFrom = Math.floor((leftMs - TICK_EPOCH_MS) / intervalMs) - 1
  const kTo = Math.ceil((rightMs - TICK_EPOCH_MS) / intervalMs) + 1

  const indicators = []
  for (let k = kFrom; k <= kTo; k++) {
    const dateMs = TICK_EPOCH_MS + k * intervalMs
    indicators.push({
      index: k,
      pixelPosition: centerX + ((dateMs - centerMs) / MS_PER_DAY) * ppd + dragOffsetX.value,
      date: new Date(dateMs)
    })
  }
  return indicators
})
const yearIndicators = computed(() => computeYearIndicators(renderIndicators.value, visibleWidth.value))

const todayMs = ref(Date.parse(todayISO()))
const todayBand = computed(() => {
  const ppd = pixelsPerDay.value
  if (!ppd) return null
  const x = visibleWidth.value / 2
    + ((todayMs.value - props.centerDate.getTime()) / MS_PER_DAY) * ppd
    + dragOffsetX.value
  return { x, width: ppd }
})

const visibleRowRange = computed(() =>
  getVisibleRowRange(scrollTop.value, viewportHeight.value, props.rowHeight, props.taskCount)
)

function updateViewportMetrics() {
  if (!rootRef.value || !scrollRef.value) return
  visibleWidth.value = rootRef.value.clientWidth
  viewportHeight.value = scrollRef.value.clientHeight
}

function readCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function drawCanvas() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!ctx || !scrollRef.value) return

  const dpr = window.devicePixelRatio || 1
  const width = visibleWidth.value
  const height = viewportHeight.value

  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const bgSecondary = readCssVar('--bg-secondary', '#f8fafc')
  const borderColor = readCssVar('--border-color', '#e2e8f0')
  const { startRow, endRow } = visibleRowRange.value
  const contentOffsetY = scrollTop.value

  ctx.save()
  ctx.translate(0, -contentOffsetY)

  for (let row = startRow; row <= endRow; row++) {
    const y = row * props.rowHeight
    if (row % 2 === 0) {
      ctx.fillStyle = bgSecondary
      ctx.fillRect(0, y, width, props.rowHeight)
    }
    ctx.strokeStyle = borderColor
    ctx.beginPath()
    ctx.moveTo(0, y + props.rowHeight)
    ctx.lineTo(width, y + props.rowHeight)
    ctx.stroke()
  }

  const rowTop = startRow * props.rowHeight
  const rowBottom = (endRow + 1) * props.rowHeight

  ctx.strokeStyle = borderColor
  ctx.globalAlpha = 0.3
  for (const indicator of renderIndicators.value) {
    const x = indicator.pixelPosition
    if (x < -1 || x > width + 1) continue
    ctx.beginPath()
    ctx.moveTo(x, rowTop)
    ctx.lineTo(x, rowBottom)
    ctx.stroke()
  }

  const band = todayBand.value
  if (band && band.x < width && band.x + band.width > 0 && endRow >= startRow) {
    ctx.globalAlpha = 0.22
    ctx.fillStyle = readCssVar('--accent-color', '#3b82f6')
    ctx.fillRect(band.x, rowTop, band.width, rowBottom - rowTop)
  }

  ctx.restore()
}

const { resume: scheduleDraw } = useRafFn(drawCanvas, { immediate: false, once: true })

function panBy(deltaPixels) {
  dragOffsetX.value += deltaPixels
}

function finalizePan() {
  if (dragOffsetX.value === 0) return

  const daysOffset = -dragOffsetX.value / pixelsPerDay.value
  emit('update:centerDate', addDays(props.centerDate, daysOffset))
  dragOffsetX.value = 0
}

function onDragStart(e) {
  if (e.button !== 0) return
  e.preventDefault()
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  document.body.style.cursor = 'grabbing'
}

function onDragMove(e) {
  if (!isDragging.value) return

  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    panBy(deltaX)
  } else if (scrollRef.value) {
    scrollRef.value.scrollTop -= deltaY
  }
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  document.body.style.cursor = ''
  finalizePan()
}

const { start: scheduleWheelEnd, stop: cancelWheelEnd } = useTimeoutFn(finalizePan, 150, { immediate: false })

function onWheel(e) {
  e.preventDefault()
  const { deltaX, deltaY } = e

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    panBy(-deltaX * 0.5)
    scheduleWheelEnd()
  } else if (scrollRef.value) {
    scrollRef.value.scrollTop += deltaY
  }
}

useEventListener(document, 'mousemove', onDragMove)
useEventListener(document, 'mouseup', onDragEnd)
useResizeObserver(rootRef, updateViewportMetrics)
useResizeObserver(scrollRef, updateViewportMetrics)

function onScroll() {
  if (!scrollRef.value) return
  scrollTop.value = scrollRef.value.scrollTop
}

watch([renderIndicators, visibleRowRange, todayBand], () => scheduleDraw())

let todayTimer = null
function scheduleTodayRefresh() {
  const now = new Date()
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  todayTimer = setTimeout(() => {
    todayMs.value = Date.parse(todayISO())
    scheduleTodayRefresh()
  }, nextMidnight.getTime() - now.getTime() + 50)
}

onMounted(async () => {
  await nextTick()
  updateViewportMetrics()
  scheduleDraw()
  scheduleTodayRefresh()
})

onUnmounted(() => {
  cancelWheelEnd()
  if (todayTimer) clearTimeout(todayTimer)
})

</script>

<template>
  <div ref="rootRef" class="relative w-full h-full flex flex-col overflow-hidden">
    <!-- 时间轴头部 -->
    <div class="sticky top-0 z-20 h-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center overflow-hidden relative flex-shrink-0">
      <div class="absolute inset-0 flex items-start pt-1">
        <div
          v-for="yearIndicator in yearIndicators"
          :key="'year-' + yearIndicator.year"
          class="absolute flex flex-col items-start"
          :style="{ left: yearIndicator.pixelPosition + 'px' }"
        >
          <div class="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">
            {{ yearIndicator.year }}{{ $t('gantt.yearSuffix') }}
          </div>
        </div>
      </div>
      <div class="absolute inset-0 flex items-end pb-1">
        <div
          v-for="indicator in renderIndicators"
          :key="'indicator-' + indicator.index"
          class="absolute flex flex-col items-center"
          :style="{ left: indicator.pixelPosition + 'px' }"
        >
          <div class="absolute top-0 bottom-0 left-0 w-px -translate-x-1/2 bg-[var(--border-color)] opacity-50"></div>
          <div class="text-xs text-[var(--text-muted)] -translate-x-1/2 whitespace-nowrap">
            {{ formatDateShort(indicator.date) }}
          </div>
        </div>
      </div>
    </div>

    <div
      ref="scrollRef"
      class="gantt-scroll-container flex-1 overflow-y-auto overflow-x-hidden cursor-grab active:cursor-grabbing select-none relative"
      @mousedown="onDragStart"
      @wheel.prevent="onWheel"
      @scroll="onScroll"
    >
      <div class="relative w-full" :style="{ height: totalHeight + 'px' }">
        <canvas
          ref="canvasRef"
          class="sticky top-0 left-0 z-0 pointer-events-none"
          aria-hidden="true"
        />
        <slot
          :visible-width="visibleWidth"
          :drag-offset-x="dragOffsetX"
          :visible-row-range="visibleRowRange"
          :pixels-per-day="pixelsPerDay"
        />
      </div>
    </div>
  </div>
</template>
