<script setup>
import { watchEffect, onMounted } from 'vue'
import { useConfigStore } from './stores/config'
import { useProjectStore } from './stores/project'
import { openProject } from './utils/file'
import TitleBar from './components/TitleBar.vue'
import WorkspaceView from './components/WorkspaceView.vue'

const config = useConfigStore()
const projectStore = useProjectStore()

// 根据 mode 切换 dark 类
watchEffect(() => {
  document.documentElement.classList.toggle('dark', config.mode === 'dark')
})

// 应用启动时从 history 加载 projects，加载失败的条目从历史中移除
onMounted(async () => {
  for (const filename of [...config.history]) {
    const result = await openProject(filename, config, projectStore)
    if (!result.success) {
      console.log('Error loading project:', filename, result.error)
      config.removeFromHistory(filename)
    }
  }
})
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-(--bg-primary) overflow-hidden">
    <TitleBar />
    <WorkspaceView />
  </div>
</template>
