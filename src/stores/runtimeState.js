import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useRuntimeStateStore = defineStore('runtimeState', () => {
  // 当前页面状态: 'project' | 'settings'
  const page = ref('project')
  const focusedTaskId = ref(null)

  const isSettingsPage = computed(() => page.value === 'settings')

  function showProject() {
    page.value = 'project'
  }

  function showSettings() {
    page.value = 'settings'
  }

  function focusTask(taskId) {
    page.value = 'project'
    focusedTaskId.value = taskId
  }

  function consumeFocusedTask() {
    const taskId = focusedTaskId.value
    focusedTaskId.value = null
    return taskId
  }

  return {
    page,
    focusedTaskId,
    isSettingsPage,
    showProject,
    showSettings,
    focusTask,
    consumeFocusedTask
  }
})
