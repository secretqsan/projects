<script setup>
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useRuntimeStateStore } from '../../stores/runtimeState'
import { todayISO, addISODays, diffISODays } from '../../utils/date'
import SplitPanel from '../SplitPanel.vue'
import TaskTable from '../TaskTable.vue'
import GanttChartView from './GanttChartView.vue'
import { Button } from '../ui'

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
  projectStore.updateTasks(newTasks)
  projectStore.saveCurrentProject()
}

// 计算选中任务的统一状态
const selectedTasksUnifiedStatus = computed(() => {
  const selectedTasks = tasks.value.filter(t => selectedTaskIds.value.has(t.id))
  if (selectedTasks.length === 0) return null

  const firstStatus = selectedTasks[0].status
  const allSameStatus = selectedTasks.every(task => task.status === firstStatus)

  return allSameStatus ? firstStatus : null
})

const selectedProgress = computed(() => {
  const selectedTasks = tasks.value.filter(task => selectedTaskIds.value.has(task.id))
  if (selectedTasks.length === 0) return null
  const progress = selectedTasks[0].progress ?? 0
  return selectedTasks.every(task => (task.progress ?? 0) === progress) ? progress : null
})

// ========== 快捷操作 ==========

function forEachSelectedTask(callback) {
  for (const taskId of selectedTaskIds.value) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) callback(task)
  }
  projectStore.saveCurrentProject()
}

function completeTask(task) {
  task.status = 'completed'
  task.progress = 100
  task.actual_end_date = todayISO()
  projectStore.updateParentTaskStatus(task.id)
}

function startSelectedTasks() {
  forEachSelectedTask(task => {
    if (task.status !== 'pending') return
    task.status = 'in_progress'
    task.actual_start_date = todayISO()
  })
}

function completeSelectedTasks() {
  forEachSelectedTask(task => {
    if (task.status === 'completed') return
    completeTask(task)
  })
}

function setSelectedTasksProgress(progress) {
  forEachSelectedTask(task => {
    if (task.status !== 'in_progress' && task.status !== 'overdue') return
    task.progress = progress
  })
}

function postponeSelectedTasks(days = 1) {
  forEachSelectedTask(task => {
    if (!task.end_date) return
    task.end_date = addISODays(task.end_date, days)
    task.duration = diffISODays(task.start_date, task.end_date)
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
      <Button icon="pi pi-plus" title="新增" @click="addTask" />
      <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
      <Button icon="pi pi-copy" title="复制" @click="copyTask" />
      <Button icon="pi pi-file-import" title="粘贴" @click="pasteTask" />
      <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
      <Button icon="pi pi-trash" title="删除" @click="deleteTask" />
      <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
      <Button icon="pi pi-arrow-left" title="左移" @click="moveLeft" />
      <Button icon="pi pi-arrow-right" title="右移" @click="moveRight" />

      <!-- 删除连线按钮（当选中连线时显示） -->
      <template v-if="selectedConnection">
        <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>
        <button
          class="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:opacity-90 transition-opacity"
          @click="deleteSelectedConnection"
        >
          <i class="pi pi-trash text-xs"></i>
          删除连线
        </button>
      </template>

      <!-- 快捷指令按钮（当选中任务状态一致时显示） -->
      <template v-if="selectedTasksUnifiedStatus">
        <div class="w-px h-5 bg-[var(--border-color)] mx-1"></div>

        <!-- 待办状态：开始任务 -->
        <template v-if="selectedTasksUnifiedStatus === 'pending'">
          <button
            class="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--accent-color)] text-white rounded hover:opacity-90 transition-opacity"
            @click="startSelectedTasks"
          >
            <i class="pi pi-play text-xs"></i>
            开始任务
          </button>
        </template>

        <!-- 已开始：进度设为所点百分比，完成按钮单独结束任务 -->
        <template v-if="selectedTasksUnifiedStatus === 'in_progress' || selectedTasksUnifiedStatus === 'overdue'">
          <div class="flex items-center gap-1">
            <button
              v-for="p in [0, 25, 50, 75]"
              :key="p"
              class="px-2 py-1.5 text-xs rounded transition-colors"
              :class="selectedProgress === p
                ? 'bg-[var(--accent-color)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--accent-color)] hover:text-white'"
              @click="setSelectedTasksProgress(p)"
            >
              {{ p }}%
            </button>
            <button
              class="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:opacity-90 transition-opacity"
              @click="completeSelectedTasks"
            >
              <i class="pi pi-check text-xs"></i>
              完成
            </button>
          </div>
        </template>

        <!-- 逾期状态：延期 -->
        <template v-if="selectedTasksUnifiedStatus === 'overdue'">
          <div class="flex items-center gap-1">
            <span class="text-xs text-[var(--text-muted)] mr-1">延期:</span>
            <button
              v-for="days in [1, 3, 7]"
              :key="days"
              class="px-2 py-1.5 text-xs rounded bg-amber-500 text-white hover:opacity-90 transition-opacity"
              @click="postponeSelectedTasks(days)"
            >
              +{{ days }}天
            </button>
          </div>
        </template>

        <!-- 已完成状态 -->
        <template v-if="selectedTasksUnifiedStatus === 'completed'">
          <span class="flex items-center gap-1 text-xs text-green-500 px-2">
            <i class="pi pi-check-circle"></i>
            已完成
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
