<script setup>
import { useProjectStore } from '../stores/project'
import { useConfigStore } from '../stores/config'
import SidebarView from './SidebarView.vue'
import MainContent from './MainContent.vue'

const projectStore = useProjectStore()
const configStore = useConfigStore()

function deleteProject(projectId) {
  const removedProject = projectStore.removeProject(projectId)
  if (removedProject?.filename) {
    configStore.removeFromHistory(removedProject.filename)
  }
}

async function copyProject(projectId) {
  const copied = await projectStore.copyProject(projectId)
  if (copied?.filename) {
    configStore.addToHistory(copied.filename)
    projectStore.setCurrentProject(copied)
  }
}
</script>

<template>
  <div class="flex-1 flex overflow-hidden bg-(--bg-secondary)">
    <SidebarView @delete-project="deleteProject" @copy-project="copyProject" />
    <MainContent />
  </div>
</template>
