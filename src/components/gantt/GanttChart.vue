<script setup>
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useRuntimeStateStore } from '../../stores/runtimeState'
import { canCompleteTask, canStartTask } from './utils/taskUtils.js'
import SplitPanel from '../SplitPanel.vue'
import TaskTable from '../TaskTable.vue'
import GanttChartView from './GanttChartView.vue'
import { Button } from '../ui'
import ProgressBar from '../ui/ProgressBar.vue'

const projectStore = useProjectStore()
const runtimeState = useRuntimeStateStore()
const taskTableRef = ref(null)
const ganttChartViewRef = ref(null)

// 当前选中的连线
const selectedConnection = ref(null)

function onConnectionSelected(connection) {
  selectedConnection.value = connection
  if (connection) {
    selectedTaskIds.value = new Set()
  }
}

function deleteSelectedConnection() {
  if (ganttChartViewRef.value?.deleteSelectedConnection()) {
    selectedConnection.value = null
  }
}

const tasks = computed(() => projectStore.currentProject?.data?.tasks || [])

// 表格与甘特图共享的选中任务ID集合
const selectedTaskIds = ref(new Set())

function onTableSelectionChanged(selectedIds) {
  selectedTaskIds.value = new Set(selectedIds)
}

function onGanttSelectionChanged(taskId) {
  selectedTaskIds.value = taskId === null ? new Set() : new Set([taskId])
}

watch(() => runtimeState.focusedTaskId, (taskId) => {
  if (!taskId) return
  if (tasks.value.some(task => task.id === taskId)) {
    selectedTaskIds.value = new Set([taskId])
    selectedConnection.value = null
  }
  runtimeState.consumeFocusedTask()
}, { immediate: true })

// 甘特图拖拽修改任务后保存
function onTasksUpdated(newTasks) {
  const previous = new Map((projectStore.currentProject?.data?.tasks || []).map(task => [task.id, task]))
  projectStore.updateTasks(newTasks)
  for (const task of newTasks) {
    const old = previous.get(task.id)
    if (!old || old.start_date !== task.start_date || old.end_date !== task.end_date) {
      projectStore.refreshTaskSchedule(task)
    }
  }
  projectStore.saveCurrentProject()
}

const selectedTasks = computed(() =>
  tasks.value.filter(task => selectedTaskIds.value.has(task.id))
)

const selectedTasksUnifiedStatus = computed(() => {
  const selected = selectedTasks.value
  if (selected.length === 0) return null
  const status = selected[0].status
  return selected.every(task => task.status === status) ? status : null
})

const selectedProgress = computed(() => {
  const selected = selectedTasks.value
  if (selected.length === 0) return null
  const progress = selected[0].progress ?? 0
  return selected.every(task => (task.progress ?? 0) === progress) ? progress : null
})

function forEachSelectedTask(callback) {
  for (const task of selectedTasks.value) callback(task)
  projectStore.saveCurrentProject()
}

function canStartSelectedTasks() {
  return selectedTasks.value.some(task => canStartTask(task, tasks.value))
}

function startSelectedTasks() {
  forEachSelectedTask(task => {
    projectStore.applyTaskStatus(task, 'in_progress')
  })
}

function completeSelectedTasks() {
  forEachSelectedTask(task => {
    projectStore.applyTaskStatus(task, 'completed')
  })
}

function canCompleteSelectedTasks() {
  const selected = selectedTasks.value
  return selected.length > 0 && selected.every(task => canCompleteTask(task, tasks.value))
}

function setSelectedTasksProgress(progress) {
  for (const task of selectedTasks.value) {
    if (task.status !== 'in_progress' && task.status !== 'overdue') continue
    task.progress = progress
  }
}

function postponeSelectedTasks(days) {
  forEachSelectedTask(task => {
    projectStore.postponeTask(task, days)
  })
}

// ========== 表格操作 ==========

function addTask() {
  taskTableRef.value?.addNewRow()
}

function copyTask() {
  taskTableRef.value?.copySelectedTasks()
}

function pasteTask() {
  taskTableRef.value?.pasteTasks()
}

function deleteTask() {
  taskTableRef.value?.deleteSelectedTasks()
}

function moveLeft() {
  taskTableRef.value?.moveLeft()
}

function moveRight() {
  taskTableRef.value?.moveRight()
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-[var(--bg-secondary)]">
    <!-- 顶部工具栏 -->
    <div class="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0">
      <Button icon="pi pi-plus" :title="$t('gantt.add')" @click="addTask" />
      <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
      <Button icon="pi pi-copy" :title="$t('common.copy')" @click="copyTask" />
      <Button icon="pi pi-file-import" :title="$t('gantt.paste')" @click="pasteTask" />
      <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
      <Button icon="pi pi-trash" :title="$t('common.delete')" @click="deleteTask" />
      <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
      <Button icon="pi pi-arrow-left" :title="$t('gantt.moveLeft')" @click="moveLeft" />
      <Button icon="pi pi-arrow-right" :title="$t('gantt.moveRight')" @click="moveRight" />

      <!-- 删除连线按钮（当选中连线时显示） -->
      <template v-if="selectedConnection">
        <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
        <button
          class="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:opacity-90 transition-opacity"
          @click="deleteSelectedConnection"
        >
          <i class="pi pi-trash text-xs"></i>
          {{ $t('gantt.deleteLink') }}
        </button>
      </template>

      <!-- 快捷指令按钮（当选中任务状态一致时显示） -->
      <template v-if="selectedTasksUnifiedStatus">
        <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>

        <!-- 待办状态：开始任务 -->
        <template v-if="selectedTasksUnifiedStatus === 'pending'">
          <button
            class="flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-opacity"
            :class="canStartSelectedTasks()
              ? 'bg-[var(--accent-color)] text-white hover:opacity-90'
              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed'"
            :disabled="!canStartSelectedTasks()"
            @click="startSelectedTasks"
          >
            <i class="pi pi-play text-xs"></i>
            {{ $t('gantt.start') }}
          </button>
        </template>

        <!-- 已开始：拖动进度条，到 100% 后自动完成 -->
        <template v-if="selectedTasksUnifiedStatus === 'in_progress' || selectedTasksUnifiedStatus === 'overdue'">
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-[var(--text-muted)]">{{ $t('gantt.progress') }}</span>
            <span class="w-8 text-xs font-medium text-[var(--accent-color)]">
              {{ selectedProgress == null ? '—' : `${selectedProgress}%` }}
            </span>
            <div class="w-40 shrink-0">
              <ProgressBar
                :model-value="selectedProgress ?? 0"
                :completable="canCompleteSelectedTasks()"
                @update:model-value="setSelectedTasksProgress"
                @commit="projectStore.saveCurrentProject()"
                @complete="completeSelectedTasks"
              />
            </div>
          </div>
        </template>

        <!-- 逾期状态：延期 -->
        <template v-if="selectedTasksUnifiedStatus === 'overdue'">
          <div class="flex items-center gap-1">
            <span class="text-xs text-[var(--text-muted)] mr-1">{{ $t('gantt.postpone') }}</span>
            <button
              v-for="days in [1, 3, 7]"
              :key="days"
              class="px-2 py-1.5 text-xs rounded bg-amber-500 text-white hover:opacity-90 transition-opacity"
              @click="postponeSelectedTasks(days)"
            >
              {{ $t('gantt.plusDays', { n: days }) }}
            </button>
          </div>
        </template>

        <!-- 已完成状态 -->
        <template v-if="selectedTasksUnifiedStatus === 'completed'">
          <span class="flex items-center gap-1 text-xs text-green-500 px-2">
            <i class="pi pi-check-circle"></i>
            {{ $t('gantt.done') }}
          </span>
        </template>
      </template>
    </div>

    <!-- 主内容区域 -->
    <SplitPanel class="flex-1 min-h-0">
      <!-- 左侧表格 -->
      <template #left>
        <div class="w-full h-full">
          <TaskTable
            ref="taskTableRef"
            :selected-task-ids="selectedTaskIds"
            @selection-changed="onTableSelectionChanged"
          />
        </div>
      </template>

      <!-- 右侧甘特图 -->
      <template #right>
        <GanttChartView
          ref="ganttChartViewRef"
          :key="projectStore.currentProject?.meta?.id"
          :tasks="tasks"
          :selected-task-ids="selectedTaskIds"
          @update:tasks="onTasksUpdated"
          @selection-changed="onGanttSelectionChanged"
          @connection-selected="onConnectionSelected"
        />
      </template>
    </SplitPanel>
  </div>
</template>
