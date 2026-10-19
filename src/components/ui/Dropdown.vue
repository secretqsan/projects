<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

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
    default: '请选择'
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
const dropdownStyle = ref({})

const selectedOption = computed(() =>
  props.options.find(opt => opt[props.optionKey] === props.modelValue)
)

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function selectOption(option) {
  const value = option[props.optionKey]
  emit('update:modelValue', value)
  emit('change', value)
  isOpen.value = false
}

function handleClickOutside(event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target) &&
      dropdownMenuRef.value && !dropdownMenuRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

// 计算下拉菜单位置，下方空间不足且上方空间足够时向上展开
async function updateDropdownPosition() {
  if (!isOpen.value || !dropdownRef.value) return

  await nextTick()

  const triggerRect = dropdownRef.value.getBoundingClientRect()
  const menuHeight = dropdownMenuRef.value?.offsetHeight || 200

  const spaceBelow = window.innerHeight - triggerRect.bottom
  const spaceAbove = triggerRect.top

  let top = triggerRect.bottom + 4
  if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
    top = triggerRect.top - menuHeight - 4
  }

  dropdownStyle.value = {
    top: `${top}px`,
    left: `${triggerRect.left}px`,
    width: `${triggerRect.width}px`,
    maxHeight: '300px',
    overflowY: 'auto'
  }
}

function handleResize() {
  if (isOpen.value) {
    updateDropdownPosition()
  }
}

function handleScroll() {
  if (isOpen.value) {
    isOpen.value = false
  }
}

watch(isOpen, (open) => {
  if (open) {
    updateDropdownPosition()
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll, true)
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- 触发按钮 -->
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

    <!-- 下拉选项 - 使用 fixed 定位避免被父组件遮挡 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div
          v-if="isOpen"
          ref="dropdownMenuRef"
          class="fixed bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-lg overflow-hidden z-[9999]"
          :style="dropdownStyle"
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
    </Teleport>
  </div>
</template>
