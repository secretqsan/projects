<script setup>
import { watchEffect, onMounted } from 'vue'
import { useConfigStore } from './stores/config'
import { useProjectStore } from './stores/project'
import { ensureExampleProject, openProject } from './utils/file'
import TitleBar from './components/TitleBar.vue'
import WorkspaceView from './components/WorkspaceView.vue'
import HoverTip from './components/ui/HoverTip.vue'

const config = useConfigStore()
const projectStore = useProjectStore()

// 根据 mode 切换 dark 类
watchEffect(() => {
  document.documentElement.classList.toggle('dark', config.mode === 'dark')
})

async function loadProjectFile(filename) {
  const result = await openProject(filename, config, projectStore)
  if (!result.success) {
    console.log('Error loading project:', filename, result.error)
    return false
  }
  if (projectStore.syncTaskSchedule(result.project)) {
    await projectStore.saveProject(result.project)
  }
  return true
}

// 启动时恢复历史项目，并打开安装包里的示例项目
onMounted(async () => {
  for (const filename of [...config.history]) {
    if (!(await loadProjectFile(filename))) {
      config.removeFromHistory(filename)
    }
  }

  const example = await ensureExampleProject()
  if (example && !config.history.includes(example)) {
    await loadProjectFile(example)
  }
})
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-(--bg-primary) overflow-hidden">
    <TitleBar />
    <WorkspaceView />
    <HoverTip />
  </div>
</template>
