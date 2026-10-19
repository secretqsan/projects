<script setup>
/**
 * Modal - 通用弹出窗口组件
 *
 * 特性：
 * - 支持点击遮罩关闭
 * - 可自定义宽度
 * - 支持滚动内容
 * - 支持自定义头部和底部
 */

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  width: {
    type: String,
    default: 'max-w-lg'
  },
  maxHeight: {
    type: String,
    default: 'max-h-[90vh]'
  },
  maskClosable: {
    type: Boolean,
    default: true
  },
  showClose: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'close'])

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onMaskClick() {
  if (props.maskClosable) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="onMaskClick"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="modelValue"
            class="bg-[var(--bg-card)] rounded-lg shadow-xl w-full mx-4 flex flex-col"
            :class="[width, maxHeight]"
          >
            <!-- 头部 -->
            <div
              v-if="title || showClose || $slots.header"
              class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] flex-shrink-0"
            >
              <slot name="header">
                <h3 class="font-semibold text-[var(--text-primary)]">{{ title }}</h3>
              </slot>
              <button
                v-if="showClose"
                class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                @click="close"
              >
                <i class="pi pi-times"></i>
              </button>
            </div>

            <!-- 内容区域 -->
            <div class="flex-1 overflow-y-auto p-4">
              <slot />
            </div>

            <!-- 底部 -->
            <div
              v-if="$slots.footer"
              class="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border-color)] flex-shrink-0"
            >
              <slot name="footer" :close="close" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
