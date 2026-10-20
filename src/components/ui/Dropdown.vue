<script setup>
import { ref, computed } from 'vue'
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue'
import { onClickOutside } from '@vueuse/core'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  options: {
    type: Array,
    required: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  optionKey: {
    type: String,
    default: 'code'
  },
  optionLabel: {
    type: String,
    default: 'name'
  },
  optionIcon: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const dropdownRef = ref(null)
const dropdownMenuRef = ref(null)

const selectedOption = computed(() =>
  props.options.find(opt => opt[props.optionKey] === props.modelValue)
)

const { floatingStyles, isPositioned } = useFloating(dropdownRef, dropdownMenuRef, {
  strategy: 'absolute',
  placement: 'bottom-start',
  transform: false,
  open: isOpen,
  whileElementsMounted: (reference, floating, update) => autoUpdate(reference, floating, update, {
    ancestorScroll: false
  }),
  middleware: [
    offset(4),
    flip(),
    shift({ padding: 8 }),
    size({
      apply({ rects, elements }) {
        Object.assign(elements.floating.style, {
          width: `${rects.reference.width}px`,
          maxHeight: '300px',
          overflowY: 'auto'
        })
      }
    })
  ]
})

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function selectOption(option) {
  const value = option[props.optionKey]
  emit('update:modelValue', value)
  emit('change', value)
  isOpen.value = false
}

onClickOutside(dropdownRef, () => {
  isOpen.value = false
}, {
  ignore: [dropdownMenuRef]
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      class="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
      @click.stop="toggleDropdown"
    >
      <div class="flex items-center gap-3">
        <span v-if="optionIcon && selectedOption" class="text-lg">
          {{ selectedOption[optionIcon] }}
        </span>
        <span class="text-sm font-medium">
          {{ selectedOption?.[optionLabel] || placeholder }}
        </span>
      </div>
      <i
        class="pi pi-chevron-down text-xs text-[var(--text-secondary)] transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      ></i>
    </button>

    <Transition
      enter-active-class="transition-opacity ease-out duration-100"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity ease-in duration-75"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        ref="dropdownMenuRef"
        class="absolute z-20 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-lg overflow-hidden"
        :style="{ ...floatingStyles, visibility: isPositioned ? 'visible' : 'hidden' }"
      >
          <button
            v-for="option in options"
            :key="option[optionKey]"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors whitespace-nowrap"
            :class="{ 'bg-[var(--accent-color)]/10': modelValue === option[optionKey] }"
            @click="selectOption(option)"
          >
            <span v-if="optionIcon" class="text-lg">{{ option[optionIcon] }}</span>
            <span class="text-sm font-medium">{{ option[optionLabel] }}</span>
            <i
              v-if="modelValue === option[optionKey]"
              class="pi pi-check text-xs ml-auto text-[var(--accent-color)]"
            ></i>
          </button>
      </div>
    </Transition>
  </div>
</template>
