<script setup>
import { ref, computed } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useProjectStore } from '../stores/project'
import { useRuntimeStateStore } from '../stores/runtimeState'

const projectStore = useProjectStore()
const runtimeState = useRuntimeStateStore()
const searchQuery = ref('')
const isSearchFocused = ref(false)
// 非 Tauri 环境（如浏览器直接访问 dev server）下不创建窗口句柄，避免 setup 抛错导致整个应用无法挂载
const appWindow = window.__TAURI_INTERNALS__ ? getCurrentWindow() : null

// 搜索匹配的任务
const matchedTasks = computed(() => {
  if (!searchQuery.value.trim()) return []

  const tasks = projectStore.currentProject?.data?.tasks || []
  const query = searchQuery.value.toLowerCase()

  return tasks.filter(task =>
    task.name?.toLowerCase().includes(query)
  ).slice(0, 8) // 最多显示8个结果
})

const showSearchResults = computed(() =>
  isSearchFocused.value && searchQuery.value.trim().length > 0
)

async function minimize() {
  await appWindow?.minimize()
}

async function toggleMaximize() {
  await appWindow?.toggleMaximize()
}

async function close() {
  await appWindow?.close()
}

async function startDrag(e) {
  if (e.target.closest('.search-box') || e.target.closest('.window-btn')) {
    return
  }
  await appWindow?.startDragging()
}

function selectTask(task) {
  runtimeState.focusTask(task.id)
  searchQuery.value = ''
  isSearchFocused.value = false
}

function onSearchBlur() {
  // 延迟隐藏，让点击事件先触发
  setTimeout(() => {
    isSearchFocused.value = false
  }, 200)
}
</script>

<template>
  <div
    class="h-10 flex items-center justify-between px-3 select-none border-b border-(--border-color) bg-(--bg-secondary)"
    @mousedown="startDrag"
  >
    <div class="flex items-center flex-1 gap-2">
      <img src="/logo.svg" alt="Logo" class="w-5 h-5" />
      <span class="text-[13px] font-medium text-(--text-primary) tracking-wide">Projects</span>
    </div>
    <div class="flex items-center justify-center flex-2">
      <div class="search-box relative flex items-center w-full max-w-100">
        <svg
          class="absolute left-2.5 w-3.5 h-3.5 text-(--text-muted) pointer-events-none z-10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索任务..."
          class="w-full h-7 pl-8 pr-3 text-[13px] text-(--text-primary) bg-(--bg-card) border border-(--border-color) rounded-md outline-none transition-all duration-200 placeholder:text-(--text-muted) hover:border-(--text-secondary) focus:border-(--accent-color) focus:ring-2 focus:ring-[var(--accent-color)]/20"
          @focus="isSearchFocused = true"
          @blur="onSearchBlur"
        />

        <!-- 搜索结果下拉列表 -->
        <div
          v-if="showSearchResults"
          class="absolute top-full left-0 right-0 mt-1.5 bg-(--bg-card) border-(--border-color) rounded-lg shadow-lg overflow-hidden z-50"
        >
          <!-- 有结果时 -->
          <template v-if="matchedTasks.length > 0">
            <div
              v-for="task in matchedTasks"
              :key="task.id"
              class="flex items-center justify-between px-3 py-2 hover:bg-(--bg-secondary) cursor-pointer transition-colors"
              @mousedown.prevent="selectTask(task)"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  :style="{ backgroundColor: task.color || '#3b82f6' }"
                ></div>
                <span class="text-[13px] text-(--text-primary) truncate">
                  {{ task.name }}
                </span>
              </div>
            </div>
          </template>

          <!-- 无结果时 -->
          <div
            v-else
            class="px-3 py-4 text-center text-[13px] text-(--text-muted)"
          >
            未找到匹配的任务
          </div>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-end flex-1">
      <div class="flex items-center h-10 -mr-3">
        <button
          class="window-btn w-[46px] h-full flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors duration-100 hover:bg-(--text-muted)/.20 active:bg-(--text-muted)/.30 group"
          @click="minimize"
        >
          <svg
            class="w-3.5 h-3.5 text-(--text-secondary) group-hover:text-(--text-primary) transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button
          class="window-btn w-[46px] h-full flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors duration-100 hover:bg-[var(--text-muted)]/20 active:bg-[var(--text-muted)]/30 group"
          @click="toggleMaximize"
        >
          <svg
            class="w-3 h-3 text-(--text-secondary) group-hover:text-(--text-primary) transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="1" ry="1"></rect>
          </svg>
        </button>
        <button
          class="window-btn w-[46px] h-full flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors duration-100 hover:bg-red-500 active:bg-red-600 group"
          @click="close"
        >
          <svg
            class="w-3.5 h-3.5 text-(--text-secondary) group-hover:text-white transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
