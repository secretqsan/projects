<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../stores/project'
import { Modal } from './ui'

const { t } = useI18n()
const projectStore = useProjectStore()

const groupTypes = computed(() => [
  { value: 'machine', label: t('resources.types.machine') },
  { value: 'human', label: t('resources.types.human') },
  { value: 'material', label: t('resources.types.material') },
  { value: 'other', label: t('resources.types.other') }
])

function getGroupTypeLabel(type) {
  return groupTypes.value.find(item => item.value === type)?.label || type
}

// ========== 资源组管理 ==========

const showGroupModal = ref(false)
const editingGroup = ref(null)
const groupForm = ref({
  name: '',
  type: 'machine',
  exclusive: false
})

function openNewGroupModal() {
  editingGroup.value = null
  groupForm.value = { name: '', type: 'machine', exclusive: false }
  showGroupModal.value = true
}

function openEditGroupModal(group) {
  editingGroup.value = group
  groupForm.value = {
    name: group.name,
    type: group.type,
    exclusive: group.exclusive
  }
  showGroupModal.value = true
}

function saveGroup() {
  if (!groupForm.value.name.trim()) return

  if (editingGroup.value) {
    projectStore.updateResourceGroup(editingGroup.value.id, {
      name: groupForm.value.name.trim(),
      type: groupForm.value.type,
      exclusive: groupForm.value.exclusive
    })
  } else {
    projectStore.addResourceGroup({
      name: groupForm.value.name.trim(),
      type: groupForm.value.type,
      exclusive: groupForm.value.exclusive
    })
  }
  projectStore.saveCurrentProject()
  showGroupModal.value = false
}

function deleteGroup(groupId) {
  if (confirm(t('resources.confirmDeleteGroup'))) {
    projectStore.removeResourceGroup(groupId)
    projectStore.saveCurrentProject()
  }
}

// ========== 资源管理 ==========

const showResourceModal = ref(false)
const currentGroupId = ref(null)
const resourceForm = ref({ name: '' })

// 原位编辑状态
const editingResourceId = ref(null)
const editingResourceName = ref('')
const editingResourceInputRef = ref(null)

function openNewResourceModal(groupId) {
  currentGroupId.value = groupId
  resourceForm.value = { name: '' }
  showResourceModal.value = true
}

function saveResource() {
  if (!resourceForm.value.name.trim()) return

  projectStore.addResource(currentGroupId.value, {
    name: resourceForm.value.name.trim()
  })
  projectStore.saveCurrentProject()
  showResourceModal.value = false
}

function startEditResourceName(groupId, resource) {
  editingResourceId.value = `${groupId}-${resource.id}`
  editingResourceName.value = resource.name

  nextTick(() => {
    editingResourceInputRef.value?.focus()
    editingResourceInputRef.value?.select()
  })
}

function saveResourceNameEdit(groupId, resource) {
  const newName = editingResourceName.value.trim()
  if (newName && newName !== resource.name) {
    projectStore.updateResource(groupId, resource.id, { name: newName })
    projectStore.saveCurrentProject()
  }
  editingResourceId.value = null
}

function cancelResourceNameEdit() {
  editingResourceId.value = null
  editingResourceName.value = ''
}

function deleteResource(groupId, resourceId) {
  if (confirm(t('resources.confirmDeleteResource'))) {
    projectStore.removeResource(groupId, resourceId)
    projectStore.saveCurrentProject()
  }
}

// ========== 组展开状态 ==========

const expandedGroups = ref(new Set())

function toggleGroup(groupId) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
}

function isGroupExpanded(groupId) {
  return expandedGroups.value.has(groupId)
}

watch(() => projectStore.currentProject?.meta?.id, () => {
  expandedGroups.value = new Set(projectStore.currentResourceGroups.map(group => group.id))
}, { immediate: true })

watch(
  () => projectStore.currentResourceGroups.map(group => group.id).join('\0'),
  (current, previous) => {
    if (previous == null) return
    const known = new Set(previous.split('\0').filter(Boolean))
    for (const id of current.split('\0').filter(Boolean)) {
      if (!known.has(id)) expandedGroups.value.add(id)
    }
  }
)
</script>

<template>
  <div class="flex-1 p-6 overflow-auto bg-[var(--bg-secondary)]">
    <div class="max-w-6xl mx-auto">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-[var(--text-primary)]">{{ $t('resources.title') }}</h2>
        <button
          class="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          @click="openNewGroupModal"
        >
          <i class="pi pi-plus"></i>
          {{ $t('resources.newGroup') }}
        </button>
      </div>

      <!-- 资源组列表 -->
      <div class="space-y-4">
        <div
          v-for="group in projectStore.currentResourceGroups"
          :key="group.id"
          class="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] overflow-hidden"
        >
          <!-- 资源组头部 -->
          <div
            class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
            @click="toggleGroup(group.id)"
          >
            <div class="flex items-center gap-3">
              <i class="pi pi-folder text-[var(--accent-color)]"></i>
              <span class="font-medium text-[var(--text-primary)]">{{ group.name }}</span>
              <span class="text-xs px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded">
                {{ getGroupTypeLabel(group.type) }}
              </span>
              <span
                v-if="group.exclusive"
                class="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded dark:bg-amber-900/30 dark:text-amber-400"
              >
                {{ $t('resources.exclusive') }}
              </span>
              <span class="text-xs text-[var(--text-muted)]">
                {{ $t('resources.count', { n: group.resources?.length || 0 }) }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 rounded transition-colors"
                :title="$t('resources.add')"
                @click.stop="openNewResourceModal(group.id)"
              >
                <i class="pi pi-plus text-sm"></i>
              </button>
              <button
                class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
                :title="$t('common.edit')"
                @click.stop="openEditGroupModal(group)"
              >
                <i class="pi pi-pencil text-sm"></i>
              </button>
              <button
                class="p-1.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-500/10 rounded transition-colors"
                :title="$t('common.delete')"
                @click.stop="deleteGroup(group.id)"
              >
                <i class="pi pi-trash text-sm"></i>
              </button>
              <i
                class="pi text-[var(--text-muted)] transition-transform duration-200"
                :class="isGroupExpanded(group.id) ? 'pi-chevron-down' : 'pi-chevron-right'"
              ></i>
            </div>
          </div>

          <!-- 资源列表 -->
          <div
            v-show="isGroupExpanded(group.id)"
            class="border-t border-[var(--border-color)]"
          >
            <div v-if="!group.resources || group.resources.length === 0" class="px-4 py-6 text-center">
              <p class="text-sm text-[var(--text-muted)]">{{ $t('resources.emptyResources') }}</p>
            </div>
            <div v-else class="divide-y divide-[var(--border-color)]">
              <div
                v-for="resource in group.resources"
                :key="resource.id"
                class="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <!-- 资源名称显示/编辑 -->
                  <template v-if="editingResourceId === `${group.id}-${resource.id}`">
                    <input
                      ref="editingResourceInputRef"
                      v-model="editingResourceName"
                      type="text"
                      class="w-auto max-w-[200px] px-2 py-0.5 text-sm bg-[var(--bg-card)] border border-[var(--accent-color)] rounded outline-none text-[var(--text-primary)]"
                      @blur="saveResourceNameEdit(group.id, resource)"
                      @keydown.enter="saveResourceNameEdit(group.id, resource)"
                      @keydown.esc="cancelResourceNameEdit"
                    />
                  </template>
                  <template v-else>
                    <span
                      class="text-sm text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent-color)]"
                      :title="$t('resources.editName')"
                      @dblclick="startEditResourceName(group.id, resource)"
                    >
                      {{ resource.name }}
                    </span>
                  </template>
                  <span class="text-xs text-[var(--text-muted)] font-mono">{{ resource.id }}</span>
                </div>
                <div class="flex items-center gap-1 ml-2">
                  <button
                    class="p-1.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-500/10 rounded transition-colors"
                    :title="$t('common.delete')"
                    @click="deleteResource(group.id, resource.id)"
                  >
                    <i class="pi pi-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="projectStore.currentResourceGroups.length === 0"
          class="text-center py-12 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]"
        >
          <i class="pi pi-inbox text-4xl text-[var(--text-muted)] mb-4 block"></i>
          <p class="text-[var(--text-secondary)]">{{ $t('resources.emptyGroups') }}</p>
          <p class="text-sm text-[var(--text-muted)] mt-1">{{ $t('resources.emptyGroupsHint') }}</p>
        </div>
      </div>
    </div>

    <!-- 资源组弹窗 -->
    <Modal v-model="showGroupModal" :title="editingGroup ? t('resources.editGroup') : t('resources.newGroup')" width="max-w-md">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">{{ $t('resources.name') }}</label>
          <input
            v-model="groupForm.name"
            type="text"
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            :placeholder="$t('resources.namePlaceholder')"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">{{ $t('resources.type') }}</label>
          <select
            v-model="groupForm.type"
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
          >
            <option v-for="type in groupTypes" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <input
            id="exclusive"
            v-model="groupForm.exclusive"
            type="checkbox"
            class="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
          />
          <label for="exclusive" class="text-sm text-[var(--text-primary)]">{{ $t('resources.exclusiveMode') }}</label>
        </div>
      </div>
      <template #footer="{ close }">
        <button
          class="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          @click="close"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          @click="saveGroup"
        >
          {{ $t('common.save') }}
        </button>
      </template>
    </Modal>

    <!-- 新建资源弹窗 -->
    <Modal v-model="showResourceModal" :title="$t('resources.newResource')" width="max-w-md">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">{{ $t('resources.name') }}</label>
          <input
            v-model="resourceForm.name"
            type="text"
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            :placeholder="$t('resources.resourcePlaceholder')"
            @keydown.enter="saveResource"
          />
        </div>
      </div>
      <template #footer="{ close }">
        <button
          class="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          @click="close"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          @click="saveResource"
        >
          {{ $t('common.save') }}
        </button>
      </template>
    </Modal>
  </div>
</template>
