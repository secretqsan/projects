<script setup>
import { computed } from 'vue'

const props = defineProps({
  min: {
    type: Number,
    default: 50
  },
  max: {
    type: Number,
    default: 200
  },
  modelValue: {
    type: Number,
    default: 100
  },
  step: {
    type: Number,
    default: 10
  },
  direction: {
    type: String,
    default: 'horizontal',
    validator: (value) => ['horizontal', 'vertical'].includes(value)
  },
  showLabel: {
    type: Boolean,
    default: true
  },
  labelFormatter: {
    type: Function,
    default: (value) => value
  }
})

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isVertical = computed(() => props.direction === 'vertical')
</script>

<template>
  <!-- 水平方向 -->
  <div
    v-if="!isVertical"
    class="flex items-center gap-3"
  >
    <input
      v-model.number="value"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      class="flex-1 h-1.5 bg-(--border-color) rounded appearance-none cursor-pointer accent-(--accent-color)"
    />
    <span v-if="showLabel" class="text-xs text-(--text-muted) w-12 text-right">{{ labelFormatter(value) }}</span>
  </div>

  <!-- 垂直方向 -->
  <div
    v-else
    class="relative flex items-center justify-center w-6 h-full min-h-0 overflow-visible"
  >
    <input
      v-model.number="value"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      class="slider-vertical"
    />
  </div>
</template>

<style scoped>
/* 垂直滑杆 - 使用 writing-mode 实现，无法用 Tailwind 完全替代 */
.slider-vertical {
  -webkit-appearance: none;
  appearance: none;
  width: 6px;
  height: 100%;
  min-height: 60px;
  padding: 0;
  margin: 0;
  background: transparent;
  outline: none;
  cursor: pointer;
  writing-mode: vertical-lr;
  direction: rtl;
}

/* Webkit 浏览器垂直滑杆轨道 */
.slider-vertical::-webkit-slider-runnable-track {
  width: 6px;
  height: 100%;
  background: var(--border-color);
  border-radius: 3px;
  margin: 0 auto;
}

/* Webkit 浏览器垂直滑杆滑块 */
.slider-vertical::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease;
  border: 2px solid var(--bg-secondary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  margin-left: -4px;
}

.slider-vertical::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.slider-vertical::-webkit-slider-thumb:active {
  transform: scale(0.95);
}

/* Firefox 垂直滑杆 */
.slider-vertical::-moz-range-track {
  width: 6px;
  height: 100%;
  background: var(--border-color);
  border-radius: 3px;
}

.slider-vertical::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-secondary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease;
}

.slider-vertical::-moz-range-thumb:hover {
  transform: scale(1.15);
}

.slider-vertical::-moz-range-thumb:active {
  transform: scale(0.95);
}
</style>
