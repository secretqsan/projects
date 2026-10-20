<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../stores/project'
import ProgressBar from './ui/ProgressBar.vue'
import { Modal } from './ui'
import { canCompleteTask, canStartTask, isParentTask, parseDependencies } from './gantt/utils/taskUtils.js'
import { todayISO, addISODays, diffISODays, formatDateShort } from '../utils/date.js'
import clamp from 'lodash/clamp'
import toInteger from 'lodash/toInteger'
import { createId } from '../utils/id'

const { t } = useI18n()
const projectStore = useProjectStore()
const allTasks = computed(() => projectStore.currentProject?.data?.tasks || [])

// ========== 新增任务对话框 ==========

const showTaskModal = ref(false)
const defaultTaskStatus = ref('pending')
const taskForm = ref({
  name: '',
  start_date: '',
  end_date: '',
  resource_groups: [],
  dependencies: '',
  level: 0
})

function openAddTaskModal(status = 'pending') {
  defaultTaskStatus.value = status
  const today = todayISO()

  taskForm.value = {
    name: '',
    start_date: today,
    end_date: addISODays(today, 1),
    resource_groups: [],
    dependencies: '',
    level: 0
  }

  showTaskModal.value = true
}

function addTaskResourceGroup(event) {
  const value = event.target.value
  if (value && !taskForm.value.resource_groups.includes(value)) {
    taskForm.value.resource_groups.push(value)
  }
  event.target.value = ''
}

function removeTaskResourceGroup(groupId) {
  taskForm.value.resource_groups = taskForm.value.resource_groups.filter(id => id !== groupId)
}

function saveTask() {
  if (!taskForm.value.name.trim()) {
    alert(t('kanban.needName'))
    return
  }

  const tasks = projectStore.currentProject?.data?.tasks
  if (!tasks) return

  const dependencies = parseDependencies(taskForm.value.dependencies)
  const start = taskForm.value.start_date
  const end = taskForm.value.end_date

  tasks.push({
    id: createId('task'),
    name: taskForm.value.name.trim(),
    start_date: start,
    end_date: end,
    duration: Math.max(0, diffISODays(start, end)),
    progress: 0,
    status: defaultTaskStatus.value,
    level: toInteger(taskForm.value.level),
    resource_groups: [...taskForm.value.resource_groups],
    dependencies,
    note: ''
  })
  projectStore.saveCurrentProject()

  showTaskModal.value = false
}

const resourceGroupOptions = computed(() =>
  projectStore.currentResourceGroups.map(group => ({
    value: group.id,
    label: group.name
  }))
)

const taskOptions = computed(() =>
  allTasks.value.map(task => ({
    value: task.id,
    label: `${task.id} - ${task.name}`
  }))
)

// 看板列定义
const columns = computed(() => [
  { id: 'pending', title: t('kanban.pending'), color: 'var(--text-muted)' },
  { id: 'in_progress', title: t('kanban.inProgress'), color: 'var(--accent-color)' },
  { id: 'overdue', title: t('kanban.overdue'), color: '#ef4444' },
  { id: 'completed', title: t('kanban.completed'), color: '#22c55e' }
])

// ========== 快捷操作 ==========

const showStartTaskModal = ref(false)
const startTaskForm = ref({
  task: null,
  selectedResources: {}
})

const showPostponeModal = ref(false)
const postponeForm = ref({
  task: null,
  days: 1
})

function openStartTaskModal(task) {
  if (!canStartTask(task, allTasks.value)) return
  startTaskForm.value.task = task
  startTaskForm.value.selectedResources = { ...(task.assigned_resources || {}) }
  showStartTaskModal.value = true
}

function saveStartTask() {
  const task = allTasks.value.find(item => item.id === startTaskForm.value.task?.id)
  if (task && projectStore.applyTaskStatus(task, 'in_progress')) {
    task.assigned_resources = { ...startTaskForm.value.selectedResources }
    projectStore.saveCurrentProject()
  }
  showStartTaskModal.value = false
}

const completingTaskId = ref(null)

function taskProgress(task) {
  return clamp(Number(task?.progress) || 0, 0, 100)
}

function onTaskProgress(task, progress) {
  task.progress = progress
}

function completeKanbanTask(task) {
  const taskRecord = allTasks.value.find(item => item.id === task.id)
  if (!taskRecord || !projectStore.applyTaskStatus(taskRecord, 'completed')) return
  projectStore.saveCurrentProject()
}

function openPostponeModal(task) {
  postponeForm.value.task = task
  postponeForm.value.days = 1
  showPostponeModal.value = true
}

// 延期后的新结束日期预览
const postponedEndDate = computed(() => {
  const task = postponeForm.value.task
  if (!task?.end_date) return ''
  return addISODays(task.end_date, toInteger(postponeForm.value.days))
})

function savePostpone() {
  if (!postponeForm.value.task || postponeForm.value.days < 1) return

  const task = allTasks.value.find(item => item.id === postponeForm.value.task.id)
  if (task && projectStore.postponeTask(task, postponeForm.value.days)) {
    projectStore.saveCurrentProject()
  }
  showPostponeModal.value = false
}

function getTaskResourceGroups(task) {
  return parseDependencies(task?.resource_groups).map(groupId => {
    const group = projectStore.currentResourceGroups.find(item => item.id === groupId)
    return group || { id: groupId, name: groupId, resources: [] }
  })
}

function dependencyText(task) {
  const deps = parseDependencies(task.dependencies)
  return deps.length ? deps.join('; ') : ''
}

function isOverdue(task) {
  if (isParentTask(allTasks.value, task)) return task.status === 'overdue'
  return Boolean(task.end_date) && task.status !== 'completed' && task.end_date < todayISO()
}

const tasksByStatus = computed(() => {
  const grouped = {
    pending: [],
    in_progress: [],
    overdue: [],
    completed: []
  }

  for (const task of allTasks.value) {
    const key = isOverdue(task) ? 'overdue' : (task.status in grouped ? task.status : 'pending')
    grouped[key].push(task)
  }

  return grouped
})

// ========== 拖拽 ==========

const draggedTask = ref(null)
const dragSourceColumn = ref(null)

function onDragStart(task, columnId, event) {
  if (completingTaskId.value === task.id || event.target.closest?.('[data-kanban-progress]')) {
    event.preventDefault()
    return
  }
  draggedTask.value = task
  dragSourceColumn.value = columnId
}

function onDragOver(event) {
  event.preventDefault()
}

function onDrop(targetColumnId) {
  const source = draggedTask.value
  const sourceColumn = dragSourceColumn.value
  draggedTask.value = null
  dragSourceColumn.value = null
  if (!source || sourceColumn === targetColumnId || targetColumnId === 'overdue') return
  // 逾期列由结束日期决定；除「完成」外改状态不会离开逾期，需走延期
  if (sourceColumn === 'overdue' && targetColumnId !== 'completed') return

  const task = allTasks.value.find(item => item.id === source.id)
  if (!task || !projectStore.applyTaskStatus(task, targetColumnId)) return
  projectStore.saveCurrentProject()
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-(--bg-secondary)">
    <!-- 看板头部 -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-(--border-color) bg-(--bg-card) shrink-0">
      <h2 class="text-lg font-semibold text-(--text-primary)">{{ $t('kanban.title') }}</h2>
      <button
        class="flex items-center gap-2 px-3 py-1.5 rounded bg-(--accent-color) text-white text-sm hover:opacity-90 transition-opacity"
        @click="openAddTaskModal('pending')"
      >
        <i class="pi pi-plus text-xs"></i>
        <span>{{ $t('kanban.newTask') }}</span>
      </button>
    </div>

    <!-- 四栏看板 -->
    <div class="flex flex-1 min-h-0 gap-4 p-4 overflow-x-auto">
      <div
        v-for="column in columns"
        :key="column.id"
        class="flex flex-col w-80 min-w-[320px] h-full bg-(--bg-card) rounded-lg border border-(--border-color)"
        @dragover="onDragOver"
        @drop="onDrop(column.id)"
      >
        <!-- 列标题 -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-(--border-color) shrink-0">
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: column.color }"
            ></div>
            <span class="font-medium text-(--text-primary)">{{ column.title }}</span>
            <span class="text-xs text-(--text-muted) bg-(--bg-secondary) px-2 py-0.5 rounded-full">
              {{ tasksByStatus[column.id].length }}
            </span>
          </div>
        </div>

        <!-- 任务列表区域 -->
        <div class="flex-1 overflow-y-auto p-3">
          <!-- 空状态 -->
          <div
            v-if="tasksByStatus[column.id].length === 0"
            class="h-32 border-2 border-dashed border-(--border-color) rounded-lg flex items-center justify-center"
          >
            <span class="text-(--text-muted) text-sm">{{ $t('kanban.empty') }}</span>
          </div>

          <TransitionGroup
            tag="div"
            move-class="transition-transform duration-700 ease-out"
            leave-active-class="!transition-all !duration-700 !ease-in"
            leave-to-class="opacity-0 -translate-y-2"
          >
          <!-- 任务卡片 -->
          <div
            v-for="task in tasksByStatus[column.id]"
            :key="task.id"
            data-kanban-card
            class="p-3 mb-2 bg-(--bg-secondary) border rounded-lg cursor-pointer group transition-[border-color,opacity,transform] duration-700 ease-out"
            :class="completingTaskId === task.id
              ? 'border-green-400'
              : 'border-(--border-color) hover:border-(--accent-color)'"
            draggable="true"
            @dragstart="onDragStart(task, column.id, $event)"
          >
            <!-- 任务名称 -->
            <div class="font-medium text-(--text-primary) mb-2">
              {{ task.name }}
            </div>

            <!-- 任务信息 -->
            <div class="flex items-center justify-between text-xs text-(--text-muted)">
              <div class="flex items-center gap-2">
                <i class="pi pi-calendar"></i>
                <span>{{ formatDateShort(task.start_date) }} - {{ formatDateShort(task.end_date) }}</span>
              </div>
              <span class="bg-(--bg-card) px-2 py-0.5 rounded">
                {{ $t('common.days', { n: diffISODays(task.start_date, task.end_date) }) }}
              </span>
            </div>

            <!-- 资源组标签 -->
            <div v-if="task.resource_groups && task.resource_groups.length > 0" class="flex flex-wrap gap-1 mt-2">
              <span
                v-for="groupId in parseDependencies(task.resource_groups)"
                :key="groupId"
                class="text-xs px-2 py-0.5 bg-(--accent-color)/10 text-(--accent-color) rounded"
              >
                {{ groupId }}
              </span>
            </div>

            <!-- 依赖任务 -->
            <div v-if="dependencyText(task)" class="flex items-center gap-1 mt-2 text-xs text-[var(--text-muted)]">
              <i class="pi pi-link"></i>
              <span>{{ $t('kanban.depends', { deps: dependencyText(task) }) }}</span>
            </div>

            <!-- 快捷操作按钮 -->
            <div class="mt-3 pt-2 border-t border-(--border-color)">
              <!-- 待办：开始任务 -->
              <div v-if="column.id === 'pending'" class="flex items-center justify-between">
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs rounded transition-opacity"
                  :class="canStartTask(task, allTasks)
                    ? 'bg-[var(--accent-color)] text-white hover:opacity-90'
                    : 'bg-(--border-color) text-(--text-muted) cursor-not-allowed'"
                  :disabled="!canStartTask(task, allTasks)"
                  @click.stop="openStartTaskModal(task)"
                >
                  <i class="pi pi-play text-xs"></i>
                  {{ $t('kanban.start') }}
                </button>
              </div>

              <!-- 进行中：拖到 100% 松手后自动完成 -->
              <div v-else-if="column.id === 'in_progress'" class="space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-[var(--text-muted)]">{{ $t('kanban.progress') }}</span>
                  <span class="text-[var(--accent-color)] font-medium">{{ taskProgress(task) }}%</span>
                </div>
                <ProgressBar
                  :model-value="taskProgress(task)"
                  :completable="canCompleteTask(task, allTasks)"
                  @update:model-value="onTaskProgress(task, $event)"
                  @commit="projectStore.saveCurrentProject()"
                  @completing="completingTaskId = task.id"
                  @complete="completeKanbanTask(task)"
                />
              </div>

              <!-- 逾期：延期或直接完成 -->
              <div v-else-if="column.id === 'overdue'" class="flex items-center gap-2">
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500 text-white rounded hover:opacity-90 transition-opacity"
                  @click.stop="openPostponeModal(task)"
                >
                  <i class="pi pi-clock text-xs"></i>
                  {{ $t('kanban.postpone') }}
                </button>
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs rounded transition-opacity"
                  :class="canCompleteTask(task, allTasks)
                    ? 'bg-green-500 text-white hover:opacity-90'
                    : 'bg-(--border-color) text-(--text-muted) cursor-not-allowed'"
                  :disabled="!canCompleteTask(task, allTasks)"
                  @click.stop="completeKanbanTask(task)"
                >
                  <i class="pi pi-check text-xs"></i>
                  {{ $t('kanban.complete') }}
                </button>
              </div>

              <!-- 已完成：显示完成标识 -->
              <div v-else-if="column.id === 'completed'" class="flex items-center justify-center">
                <span class="flex items-center gap-1 text-xs text-green-500">
                  <i class="pi pi-check-circle"></i>
                  {{ $t('kanban.done') }}
                </span>
              </div>
            </div>
          </div>
          </TransitionGroup>
        </div>

        <!-- 底部添加按钮 -->
        <div class="px-3 py-2 border-t border-[var(--border-color)] flex-shrink-0">
          <button
            class="w-full flex items-center justify-center gap-2 py-2 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-sm"
            @click="openAddTaskModal(column.id)"
          >
            <i class="pi pi-plus text-xs"></i>
            <span>{{ $t('kanban.addTask') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 新增任务对话框 -->
    <Modal v-model="showTaskModal" width="max-w-lg">
      <template #header>
        <h3 class="font-semibold text-[var(--text-primary)]">
          {{ $t('kanban.newTask') }}
          <span class="text-sm font-normal text-[var(--text-muted)] ml-2">
            {{ $t('kanban.inColumn', { title: columns.find(c => c.id === defaultTaskStatus)?.title }) }}
          </span>
        </h3>
      </template>

      <div class="space-y-4">
        <!-- 任务名称 -->
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">
            {{ $t('kanban.name') }} <span class="text-red-500">*</span>
          </label>
          <input
            v-model="taskForm.name"
            type="text"
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            :placeholder="$t('kanban.namePlaceholder')"
            @keydown.enter="saveTask"
          />
        </div>

        <!-- 日期和层级 -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">{{ $t('kanban.startDate') }}</label>
            <input
              v-model="taskForm.start_date"
              type="date"
              class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">{{ $t('kanban.endDate') }}</label>
            <input
              v-model="taskForm.end_date"
              type="date"
              class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">{{ $t('kanban.level') }}</label>
            <input
              v-model.number="taskForm.level"
              type="number"
              min="0"
              class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            />
          </div>
        </div>

        <!-- 资源组 -->
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">{{ $t('kanban.groups') }}</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="groupId in taskForm.resource_groups"
              :key="groupId"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent-color)]/10 text-[var(--accent-color)] rounded"
            >
              {{ resourceGroupOptions.find(g => g.value === groupId)?.label || groupId }}
              <button
                class="hover:text-red-500"
                @click="removeTaskResourceGroup(groupId)"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </span>
          </div>
          <select
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            @change="addTaskResourceGroup"
          >
            <option value="">{{ $t('kanban.selectGroup') }}</option>
            <option
              v-for="group in resourceGroupOptions"
              :key="group.value"
              :value="group.value"
              :disabled="taskForm.resource_groups.includes(group.value)"
            >
              {{ group.label }}
            </option>
          </select>
        </div>

        <!-- 依赖任务 -->
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">
            {{ $t('kanban.dependencies') }}
            <span class="text-xs text-[var(--text-muted)] font-normal">{{ $t('kanban.dependenciesHint') }}</span>
          </label>
          <input
            v-model="taskForm.dependencies"
            type="text"
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            :placeholder="$t('kanban.dependenciesPlaceholder')"
          />
          <div v-if="taskOptions.length > 0" class="mt-2 flex flex-wrap gap-1">
            <span class="text-xs text-[var(--text-muted)]">{{ $t('kanban.optional') }}</span>
            <button
              v-for="task in taskOptions.slice(0, 5)"
              :key="task.value"
              class="text-xs px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10"
              @click="taskForm.dependencies = taskForm.dependencies ? taskForm.dependencies + '; ' + task.value : task.value"
            >
              {{ task.value }}
            </button>
          </div>
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
          @click="saveTask"
        >
          {{ $t('common.save') }}
        </button>
      </template>
    </Modal>

    <!-- 开始任务对话框 -->
    <Modal v-model="showStartTaskModal" :title="t('kanban.startTitle', { name: startTaskForm.task?.name || '' })" width="max-w-md">
      <div class="space-y-4">
        <div v-if="getTaskResourceGroups(startTaskForm.task).length === 0" class="text-center py-4">
          <p class="text-sm text-[var(--text-muted)]">{{ $t('kanban.noGroups') }}</p>
        </div>

        <div
          v-for="group in getTaskResourceGroups(startTaskForm.task)"
          :key="group.id"
          class="border border-[var(--border-color)] rounded-lg p-3"
        >
          <div class="font-medium text-[var(--text-primary)] mb-2">{{ group.name }}</div>
          <div v-if="group.resources && group.resources.length > 0" class="space-y-2">
            <label
              v-for="resource in group.resources"
              :key="resource.id"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                v-model="startTaskForm.selectedResources[group.id]"
                type="radio"
                :value="resource.id"
                class="w-4 h-4 text-[var(--accent-color)]"
              />
              <span class="text-sm text-[var(--text-primary)]">{{ resource.name }}</span>
            </label>
          </div>
          <div v-else class="text-sm text-[var(--text-muted)]">
            {{ $t('kanban.noResources') }}
          </div>
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
          @click="saveStartTask"
        >
          {{ $t('kanban.start') }}
        </button>
      </template>
    </Modal>

    <!-- 延期对话框 -->
    <Modal v-model="showPostponeModal" :title="t('kanban.postponeTitle', { name: postponeForm.task?.name || '' })" width="max-w-sm">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">
            {{ $t('kanban.postponeDays') }}
          </label>
          <div class="flex items-center gap-3">
            <button
              class="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--accent-color)] hover:text-white transition-colors"
              @click="postponeForm.days = Math.max(1, postponeForm.days - 1)"
            >
              <i class="pi pi-minus text-xs"></i>
            </button>
            <input
              v-model.number="postponeForm.days"
              type="number"
              min="1"
              class="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-center outline-none focus:border-[var(--accent-color)]"
            />
            <button
              class="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--accent-color)] hover:text-white transition-colors"
              @click="postponeForm.days++"
            >
              <i class="pi pi-plus text-xs"></i>
            </button>
          </div>
          <p class="text-xs text-[var(--text-muted)] mt-2">
            {{ $t('kanban.currentEnd', { date: postponeForm.task?.end_date }) }}
          </p>
          <p class="text-xs text-[var(--accent-color)] mt-1">
            {{ $t('kanban.nextEnd', { date: postponedEndDate }) }}
          </p>
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
          class="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          @click="savePostpone"
        >
          {{ $t('kanban.confirmPostpone') }}
        </button>
      </template>
    </Modal>
  </div>
</template>
