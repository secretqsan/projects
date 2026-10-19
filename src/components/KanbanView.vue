<script setup>
import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { Modal } from './ui'
import { parseDependencies } from './gantt/utils/taskUtils.js'
import { todayISO, addISODays, diffISODays } from '../utils/date.js'

const projectStore = useProjectStore()

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
    alert('请输入任务名称')
    return
  }

  const tasks = projectStore.currentProject?.data?.tasks
  if (!tasks) return

  const dependencies = parseDependencies(taskForm.value.dependencies)

  tasks.push({
    id: `task_${Date.now()}`,
    name: taskForm.value.name.trim(),
    start_date: taskForm.value.start_date,
    end_date: taskForm.value.end_date,
    status: defaultTaskStatus.value,
    level: parseInt(taskForm.value.level) || 0,
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

const taskOptions = computed(() => {
  const tasks = projectStore.currentProject?.data?.tasks || []
  return tasks.map(task => ({
    value: task.id,
    label: `${task.id} - ${task.name}`
  }))
})

// 看板列定义
const columns = [
  { id: 'pending', title: '待办', color: 'var(--text-muted)' },
  { id: 'in_progress', title: '进行中', color: 'var(--accent-color)' },
  { id: 'overdue', title: '逾期', color: '#ef4444' },
  { id: 'completed', title: '已完成', color: '#22c55e' }
]

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
  startTaskForm.value.task = task
  startTaskForm.value.selectedResources = { ...(task.assigned_resources || {}) }
  showStartTaskModal.value = true
}

function saveStartTask() {
  const tasks = projectStore.currentProject?.data?.tasks
  if (!tasks || !startTaskForm.value.task) return

  const task = tasks.find(t => t.id === startTaskForm.value.task.id)
  if (task) {
    task.status = 'in_progress'
    task.assigned_resources = { ...startTaskForm.value.selectedResources }
    task.actual_start_date = todayISO()
    projectStore.saveCurrentProject()
  }

  showStartTaskModal.value = false
}

function updateTaskProgress(task, progress) {
  const taskRecord = projectStore.currentProject?.data?.tasks?.find(item => item.id === task.id)
  if (!taskRecord || taskRecord.status === 'completed') return

  taskRecord.progress = Math.max(0, Math.min(100, progress))
  projectStore.saveCurrentProject()
}

function completeKanbanTask(task) {
  const taskRecord = projectStore.currentProject?.data?.tasks?.find(item => item.id === task.id)
  if (!taskRecord || taskRecord.status === 'completed') return

  taskRecord.status = 'completed'
  taskRecord.progress = 100
  taskRecord.actual_end_date = todayISO()
  projectStore.updateParentTaskStatus(taskRecord.id)
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
  return addISODays(task.end_date, parseInt(postponeForm.value.days, 10) || 0)
})

function savePostpone() {
  const tasks = projectStore.currentProject?.data?.tasks
  if (!tasks || !postponeForm.value.task || postponeForm.value.days < 1) return

  const task = tasks.find(t => t.id === postponeForm.value.task.id)
  if (task?.end_date) {
    const days = parseInt(postponeForm.value.days, 10) || 0
    task.end_date = addISODays(task.end_date, days)
    task.duration = diffISODays(task.start_date, task.end_date)
    if (task.status === 'overdue' && task.end_date >= todayISO()) {
      task.status = 'in_progress'
    }
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
  return Boolean(task.end_date) && task.status !== 'completed' && task.end_date < todayISO()
}

const tasksByStatus = computed(() => {
  const tasks = projectStore.currentProject?.data?.tasks || []
  const grouped = {
    pending: [],
    in_progress: [],
    overdue: [],
    completed: []
  }

  tasks.forEach(task => {
    if (isOverdue(task)) {
      grouped.overdue.push(task)
    } else {
      const status = task.status || 'pending'
      grouped[status] ? grouped[status].push(task) : grouped.pending.push(task)
    }
  })

  return grouped
})

function calculateDuration(start, end) {
  return diffISODays(start, end)
}

function formatDate(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '')
  if (!match) return ''
  return `${Number(match[2])}/${Number(match[3])}`
}

// ========== 拖拽 ==========

const draggedTask = ref(null)
const dragSourceColumn = ref(null)

function onDragStart(task, columnId) {
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

  const task = projectStore.currentProject?.data?.tasks?.find(item => item.id === source.id)
  if (!task) return

  const wasCompleted = task.status === 'completed'
  task.status = targetColumnId
  if (targetColumnId === 'completed') {
    task.progress = 100
    task.actual_end_date = todayISO()
  } else if (wasCompleted) {
    delete task.actual_end_date
  }
  if (targetColumnId === 'in_progress' && !task.actual_start_date) {
    task.actual_start_date = todayISO()
  }
  projectStore.updateParentTaskStatus(task.id)
  projectStore.saveCurrentProject()
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-(--bg-secondary)">
    <!-- 看板头部 -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-(--border-color) bg-(--bg-card) shrink-0">
      <h2 class="text-lg font-semibold text-(--text-primary)">看板</h2>
      <button
        class="flex items-center gap-2 px-3 py-1.5 rounded bg-(--accent-color) text-white text-sm hover:opacity-90 transition-opacity"
        @click="openAddTaskModal('pending')"
      >
        <i class="pi pi-plus text-xs"></i>
        <span>新建任务</span>
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
          <button class="text-(--text-muted) hover:text-(--text-primary) transition-colors">
            <i class="pi pi-ellipsis-h"></i>
          </button>
        </div>

        <!-- 任务列表区域 -->
        <div class="flex-1 overflow-y-auto p-3">
          <!-- 空状态 -->
          <div
            v-if="tasksByStatus[column.id].length === 0"
            class="h-32 border-2 border-dashed border-(--border-color) rounded-lg flex items-center justify-center"
          >
            <span class="text-(--text-muted) text-sm">暂无任务</span>
          </div>

          <!-- 任务卡片 -->
          <div
            v-for="task in tasksByStatus[column.id]"
            :key="task.id"
            class="p-3 mb-2 bg-(--bg-secondary) border border-(--border-color) rounded-lg hover:border-(--accent-color) transition-colors cursor-pointer group"
            draggable="true"
            @dragstart="onDragStart(task, column.id)"
          >
            <!-- 任务名称 -->
            <div class="font-medium text-(--text-primary) mb-2">
              {{ task.name }}
            </div>

            <!-- 任务信息 -->
            <div class="flex items-center justify-between text-xs text-(--text-muted)">
              <div class="flex items-center gap-2">
                <i class="pi pi-calendar"></i>
                <span>{{ formatDate(task.start_date) }} - {{ formatDate(task.end_date) }}</span>
              </div>
              <span class="bg-(--bg-card) px-2 py-0.5 rounded">
                {{ calculateDuration(task.start_date, task.end_date) }}天
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
              <span>依赖: {{ dependencyText(task) }}</span>
            </div>

            <!-- 快捷操作按钮 -->
            <div class="mt-3 pt-2 border-t border-(--border-color)">
              <!-- 待办：开始任务 -->
              <div v-if="column.id === 'pending'" class="flex items-center justify-between">
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent-color)] text-white rounded hover:opacity-90 transition-opacity"
                  @click.stop="openStartTaskModal(task)"
                >
                  <i class="pi pi-play text-xs"></i>
                  开始任务
                </button>
              </div>

              <!-- 进行中：进度只记录百分比，完成由按钮单独触发 -->
              <div v-else-if="column.id === 'in_progress'" class="space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-[var(--text-muted)]">进度</span>
                  <span class="text-[var(--accent-color)] font-medium">{{ task.progress || 0 }}%</span>
                </div>
                <div class="relative h-2 bg-[var(--bg-card)] rounded-full overflow-hidden cursor-pointer">
                  <div
                    class="h-full bg-[var(--accent-color)] rounded-full transition-all"
                    :style="{ width: `${task.progress || 0}%` }"
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="task.progress || 0"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    @input="e => updateTaskProgress(task, parseInt(e.target.value, 10))"
                    @click.stop
                  />
                </div>
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:opacity-90 transition-opacity"
                  @click.stop="completeKanbanTask(task)"
                >
                  <i class="pi pi-check text-xs"></i>
                  完成
                </button>
              </div>

              <!-- 逾期：延期或直接完成 -->
              <div v-else-if="column.id === 'overdue'" class="flex items-center gap-2">
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500 text-white rounded hover:opacity-90 transition-opacity"
                  @click.stop="openPostponeModal(task)"
                >
                  <i class="pi pi-clock text-xs"></i>
                  延期
                </button>
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:opacity-90 transition-opacity"
                  @click.stop="completeKanbanTask(task)"
                >
                  <i class="pi pi-check text-xs"></i>
                  完成
                </button>
              </div>

              <!-- 已完成：显示完成标识 -->
              <div v-else-if="column.id === 'completed'" class="flex items-center justify-center">
                <span class="flex items-center gap-1 text-xs text-green-500">
                  <i class="pi pi-check-circle"></i>
                  已完成
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部添加按钮 -->
        <div class="px-3 py-2 border-t border-[var(--border-color)] flex-shrink-0">
          <button
            class="w-full flex items-center justify-center gap-2 py-2 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-sm"
            @click="openAddTaskModal(column.id)"
          >
            <i class="pi pi-plus text-xs"></i>
            <span>添加任务</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 新增任务对话框 -->
    <Modal v-model="showTaskModal" width="max-w-lg">
      <template #header>
        <h3 class="font-semibold text-[var(--text-primary)]">
          新建任务
          <span class="text-sm font-normal text-[var(--text-muted)] ml-2">
            ({{ columns.find(c => c.id === defaultTaskStatus)?.title }})
          </span>
        </h3>
      </template>

      <div class="space-y-4">
        <!-- 任务名称 -->
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">
            任务名称 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="taskForm.name"
            type="text"
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            placeholder="输入任务名称"
            @keydown.enter="saveTask"
          />
        </div>

        <!-- 日期和层级 -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">开始日期</label>
            <input
              v-model="taskForm.start_date"
              type="date"
              class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">结束日期</label>
            <input
              v-model="taskForm.end_date"
              type="date"
              class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">层级</label>
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
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">资源组</label>
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
            <option value="">选择资源组...</option>
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
            依赖任务
            <span class="text-xs text-[var(--text-muted)] font-normal">(用分号 ; 分隔多个任务ID)</span>
          </label>
          <input
            v-model="taskForm.dependencies"
            type="text"
            class="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            placeholder="例如: T001; T002"
          />
          <div v-if="taskOptions.length > 0" class="mt-2 flex flex-wrap gap-1">
            <span class="text-xs text-[var(--text-muted)]">可选:</span>
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
          取消
        </button>
        <button
          class="px-4 py-2 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          @click="saveTask"
        >
          保存
        </button>
      </template>
    </Modal>

    <!-- 开始任务对话框 -->
    <Modal v-model="showStartTaskModal" :title="`开始任务: ${startTaskForm.task?.name || ''}`" width="max-w-md">
      <div class="space-y-4">
        <div v-if="getTaskResourceGroups(startTaskForm.task).length === 0" class="text-center py-4">
          <p class="text-sm text-[var(--text-muted)]">该任务未分配资源组</p>
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
            该资源组暂无资源
          </div>
        </div>
      </div>
      <template #footer="{ close }">
        <button
          class="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          @click="close"
        >
          取消
        </button>
        <button
          class="px-4 py-2 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          @click="saveStartTask"
        >
          开始任务
        </button>
      </template>
    </Modal>

    <!-- 延期对话框 -->
    <Modal v-model="showPostponeModal" :title="`延期任务: ${postponeForm.task?.name || ''}`" width="max-w-sm">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-primary)] mb-1">
            延期天数
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
            当前结束日期: {{ postponeForm.task?.end_date }}
          </p>
          <p class="text-xs text-[var(--accent-color)] mt-1">
            延期后: {{ postponedEndDate }}
          </p>
        </div>
      </div>
      <template #footer="{ close }">
        <button
          class="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          @click="close"
        >
          取消
        </button>
        <button
          class="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          @click="savePostpone"
        >
          确认延期
        </button>
      </template>
    </Modal>
  </div>
</template>
