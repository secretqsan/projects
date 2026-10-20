<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { onClickOutside } from '@vueuse/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useProjectStore } from '../stores/project'
import { useRuntimeStateStore } from '../stores/runtimeState'
import { useConfigStore } from '../stores/config'
import { openProject, selectFileToOpen, selectFileToSave } from '../utils/file'
import { showHoverTip, moveHoverTip, hideHoverTip } from '../utils/hoverTip'
import find from 'lodash/find'
import get from 'lodash/get'

const { t } = useI18n()
const emit = defineEmits(['delete-project', 'copy-project'])

const projectStore = useProjectStore()
const runtimeState = useRuntimeStateStore()
const configStore = useConfigStore()

const menuOpen = ref(false)
const menuProjectId = ref(null)
const menuButton = ref(null)
const menuEl = ref(null)

const { floatingStyles } = useFloating(menuButton, menuEl, {
  strategy: 'fixed',
  placement: 'bottom-end',
  open: menuOpen,
  whileElementsMounted: autoUpdate,
  middleware: [offset(4), flip(), shift({ padding: 8 })]
})

// 自定义聚焦指令
const vFocus = {
  mounted: (el) => {
    nextTick(() => {
      el.focus()
      el.select()
    })
  }
}

const projectList = computed(() =>
  projectStore.projects.map(p => ({
    id: get(p, 'meta.id'),
    name: get(p, 'meta.name') || get(p, 'meta.id')
  }))
)

const activeProjectId = computed(() => get(projectStore.currentProject, 'meta.id', null))

function selectProject(projectId) {
  const project = find(projectStore.projects, p => get(p, 'meta.id') === projectId)
  projectStore.setCurrentProject(project || null)
  runtimeState.showProject()
}

// ========== 项目右键菜单 ==========

function showMenu(projectId, event) {
  event.stopPropagation()
  hideHoverTip()
  if (menuOpen.value && menuProjectId.value === projectId) {
    hideMenu()
    return
  }
  menuProjectId.value = projectId
  menuButton.value = event.currentTarget
  menuOpen.value = true
}

function hideMenu() {
  menuOpen.value = false
  menuProjectId.value = null
}

onClickOutside(menuEl, hideMenu, { ignore: [menuButton] })

function copyProject() {
  if (menuProjectId.value) {
    emit('copy-project', menuProjectId.value)
  }
  hideMenu()
}

function deleteProject() {
  if (menuProjectId.value) {
    emit('delete-project', menuProjectId.value)
  }
  hideMenu()
}

function toggleSettings() {
  if (runtimeState.isSettingsPage) {
    runtimeState.showProject()
  } else {
    runtimeState.showSettings()
  }
}

// ========== 新建 / 打开项目 ==========

const openError = ref('')

async function openProjectFromFile(filename) {
  openError.value = ''
  const result = await openProject(filename, configStore, projectStore)
  if (result.success) {
    runtimeState.showProject()
  } else {
    openError.value = result.error || t('nav.openFailed')
  }
  return result
}

async function createNewProject() {
  const filename = await selectFileToSave()
  if (!filename) return

  const result = await openProjectFromFile(filename)
  if (result.success) {
    startEditing(result.project.meta?.id)
  }
}

async function openProjectFile() {
  const filename = await selectFileToOpen()
  if (!filename) return

  await openProjectFromFile(filename)
}

// ========== 项目名称编辑 ==========

const editingProjectId = ref(null)
const editingName = ref('')

function startEditing(projectId) {
  editingProjectId.value = projectId
  const project = find(projectStore.projects, p => get(p, 'meta.id') === projectId)
  editingName.value = get(project, 'meta.name', '')
}

function saveProjectName() {
  const projectId = editingProjectId.value
  const name = editingName.value.trim()
  editingProjectId.value = null
  editingName.value = ''
  if (!projectId || !name) return

  const project = find(projectStore.projects, p => get(p, 'meta.id') === projectId)
  if (!project?.meta || project.meta.name === name) return
  project.meta.name = name
  projectStore.saveProject(project)
}

function cancelEditing() {
  editingProjectId.value = null
  editingName.value = ''
}

function handleEditKeydown(e) {
  if (e.key === 'Enter') {
    saveProjectName()
  } else if (e.key === 'Escape') {
    cancelEditing()
  }
}

// ========== 文件拖放打开 ==========
// Tauri v2 中 dataTransfer.files 没有 path，需使用 webview 的拖放事件

const isDragOver = ref(false)
let unlistenDragDrop = null

onMounted(async () => {
  // 非 Tauri 环境（浏览器访问 dev server）没有 webview 句柄，跳过拖放监听
  if (!window.__TAURI_INTERNALS__) return

  unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type === 'over') {
      isDragOver.value = true
    } else if (event.payload.type === 'leave') {
      isDragOver.value = false
    } else if (event.payload.type === 'drop') {
      isDragOver.value = false
      const filename = event.payload.paths.find(p => p.toLowerCase().endsWith('.json'))
      if (!filename) return

      await openProjectFromFile(filename)
    }
  })
})

onUnmounted(() => {
  unlistenDragDrop?.()
})
</script>

<template>
  <aside class="w-56 bg-[var(--bg-card)] border-r border-[var(--border-color)] flex flex-col">
    <!-- 菜单头部 -->
    <div class="h-12 flex items-center px-4 border-b border-[var(--border-color)]">
      <span class="text-sm font-semibold text-[var(--text-primary)]">{{ $t('nav.title') }}</span>
    </div>

    <!-- 菜单列表 -->
    <nav class="flex-1 overflow-y-auto py-2">
      <!-- 分组标题和新建按钮 -->
      <div class="px-4 py-2 flex items-center justify-between">
        <span class="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{{ $t('nav.projects') }}</span>
        <button
          class="flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-medium text-[var(--accent-color)] bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 rounded-md transition-colors"
          @click="createNewProject"
          @mouseenter="showHoverTip(t('nav.newProject'), $event)"
          @mousemove="moveHoverTip"
          @mouseleave="hideHoverTip"
        >
          <i class="pi pi-plus"></i>
        </button>
      </div>

      <!-- 项目列表 -->
      <button
        v-for="project in projectList"
        :key="project.id"
        class="group w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150"
        :class="activeProjectId === project.id
          ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-r-2 border-[var(--accent-color)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'"
        @click="selectProject(project.id)"
        @dblclick="startEditing(project.id)"
        @mouseenter="editingProjectId === project.id ? hideHoverTip() : showHoverTip(project.name, $event)"
        @mousemove="moveHoverTip"
        @mouseleave="hideHoverTip"
      >
        <i class="pi pi-folder text-sm"></i>
        <template v-if="editingProjectId === project.id">
          <input
            v-model="editingName"
            type="text"
            class="flex-1 h-6 px-1 text-sm bg-[var(--bg-card)] border border-[var(--accent-color)] rounded outline-none text-[var(--text-primary)]"
            @blur="saveProjectName"
            @keydown="handleEditKeydown"
            @click.stop
            v-focus
          />
        </template>
        <span v-else class="truncate flex-1 text-left">{{ project.name }}</span>
        <button
          v-if="editingProjectId !== project.id"
          class="flex items-center justify-center p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 rounded transition-all duration-150"
          @click="showMenu(project.id, $event)"
          @mouseenter.stop="showHoverTip(t('nav.more'), $event)"
          @mousemove.stop="moveHoverTip"
          @mouseleave="hideHoverTip"
        >
          <i class="pi pi-ellipsis-h text-xs"></i>
        </button>
      </button>

      <Teleport to="body">
        <div
          v-if="menuOpen"
          ref="menuEl"
          class="fixed bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 z-[9999] min-w-[120px]"
          :style="floatingStyles"
        >
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            @click="copyProject"
          >
            <i class="pi pi-copy text-xs"></i>
            <span>{{ $t('common.copy') }}</span>
          </button>
          <div class="border-t border-[var(--border-color)] my-1"></div>
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 transition-colors"
            @click="deleteProject"
          >
            <i class="pi pi-trash text-xs"></i>
            <span>{{ $t('common.delete') }}</span>
          </button>
        </div>
      </Teleport>

      <!-- 打开项目 - 虚线框拖拽区域 -->
      <div
        class="mx-3 mt-2 mb-3 py-6 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center gap-2"
        :class="isDragOver
          ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
          : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'"
        @click="openProjectFile"
      >
        <i class="pi pi-folder-open text-2xl"></i>
        <span class="text-xs font-medium">{{ $t('nav.openProject') }}</span>
        <span class="text-[10px] text-[var(--text-muted)]">{{ $t('nav.openHint') }}</span>
      </div>

      <!-- 打开失败提示 -->
      <p v-if="openError" class="mx-3 -mt-1 mb-2 text-xs text-red-500">
        {{ openError }}
      </p>
    </nav>

    <!-- 底部设置按钮 -->
    <div class="h-12 px-2 border-t border-[var(--border-color)] flex items-center">
      <button
        class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors"
        :class="runtimeState.isSettingsPage
          ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'"
        @click="toggleSettings"
      >
        <i class="pi pi-cog text-sm"></i>
        <span>{{ $t('nav.settings') }}</span>
      </button>
    </div>
  </aside>
</template>
