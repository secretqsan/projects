<script setup>
import { computed, onUnmounted, ref } from 'vue'
import clamp from 'lodash/clamp'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  completable: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'commit', 'completing', 'complete'])

const barRef = ref(null)
const dragging = ref(false)
const completing = ref(false)
let completeTimer = null

const progress = computed(() => clamp(Number(props.modelValue) || 0, 0, 100))

function progressFromEvent(event) {
  const rect = barRef.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return 0
  return clamp(Math.round(((event.clientX - rect.left) / rect.width) * 100), 0, 100)
}

function onPointerMove(event) {
  if (!dragging.value) return
  emit('update:modelValue', progressFromEvent(event))
}

function finishDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', finishDrag)
  const card = barRef.value?.closest('[data-kanban-card]')
  if (card) card.setAttribute('draggable', 'true')
  if (progress.value >= 100 && props.completable) {
    completing.value = true
    emit('completing')
    completeTimer = setTimeout(() => {
      emit('complete')
    }, 680)
    return
  }
  emit('commit')
}

function onPointerDown(event) {
  if (completing.value) return
  event.stopPropagation()
  event.preventDefault()
  const card = event.currentTarget.closest('[data-kanban-card]')
  if (card) card.setAttribute('draggable', 'false')
  dragging.value = true
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', finishDrag)
  emit('update:modelValue', progressFromEvent(event))
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', finishDrag)
  if (completeTimer) clearTimeout(completeTimer)
})
</script>

<template>
  <div
    ref="barRef"
    data-kanban-progress
    class="relative h-4 w-full rounded-[3px] overflow-hidden cursor-ew-resize select-none touch-none border border-(--border-color) bg-(--bg-card)"
    @pointerdown="onPointerDown"
    @click.stop
    @mousedown.stop
    @dragstart.stop.prevent
  >
    <div
      class="absolute inset-y-0 left-0 transition-colors duration-700 ease-out"
      :class="completing ? 'bg-green-500' : 'bg-(--accent-color)'"
      :style="{ width: progress + '%' }"
    ></div>
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <Transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="opacity-0 scale-50"
        enter-to-class="opacity-100 scale-100"
      >
        <i v-if="completing" class="pi pi-check text-white text-xs"></i>
      </Transition>
    </div>
    <div
      v-for="mark in [25, 50, 75]"
      v-show="progress < mark"
      :key="mark"
      class="absolute top-0.5 bottom-0.5 w-px -translate-x-1/2 pointer-events-none bg-[var(--text-muted)] opacity-50"
      :style="{ left: mark + '%' }"
    ></div>
  </div>
</template>
