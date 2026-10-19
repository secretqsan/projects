<script setup>
import { ref, watch } from 'vue'
import { useRuntimeStateStore } from '../stores/runtimeState'
import { useProjectStore } from '../stores/project'
import Settings from './SettingsView.vue'
import Welcome from './WelcomeView.vue'
import GanttChart from './gantt/GanttChart.vue'
import Kanban from './KanbanView.vue'
import Resources from './ResourcesView.vue'

const runtimeState = useRuntimeStateStore()
const projectStore = useProjectStore()

const activeView = ref('gantt')

watch(() => runtimeState.focusedTaskId, (taskId) => {
  if (taskId) activeView.value = 'gantt'
})

const views = [
  { id: 'gantt', label: '甘特图', icon: 'pi pi-calendar' },
  { id: 'kanban', label: '看板', icon: 'pi pi-th-large' },
  { id: 'resources', label: '资源', icon: 'pi pi-users' },
]
</script>

<template>
  <main class="flex-1 flex flex-col min-w-0">
    <!-- 设置页面 -->
    <Settings v-if="runtimeState.isSettingsPage" />

    <!-- 项目页面 -->
    <template v-else>
      <!-- 欢迎页 - 没有选中项目时显示 -->
      <Welcome v-if="!projectStore.currentProject" />

      <!-- 项目内容 - 有选中项目时显示 -->
      <template v-else>
        <!-- 顶部视图切换栏 -->
        <div class="h-12 bg-(--bg-card) border-b border-(--border-color) flex items-center px-4">
          <div class="flex items-center gap-1">
            <button
              v-for="view in views"
              :key="view.id"
              class="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-150"
              :class="activeView === view.id
                ? 'bg-(--accent-color)/10 text-(--accent-color)'
                : 'text-(--text-secondary) hover:bg-(--bg-secondary) hover:text-(--text-primary)'"
              @click="activeView = view.id"
            >
              <i :class="view.icon"></i>
              {{ view.label }}
            </button>
          </div>
        </div>

        <!-- 动态组件区域 -->
        <GanttChart v-if="activeView === 'gantt'" />
        <Kanban v-else-if="activeView === 'kanban'" />
        <Resources v-else-if="activeView === 'resources'" />
      </template>
    </template>
  </main>
</template>
