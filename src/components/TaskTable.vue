<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useProjectStore } from '../stores/project'
import draggable from 'vuedraggable'
import { Tag, StatusBadge } from './ui'
import { buildChildrenSet, parseDependencies, indexAfterSubtree, taskLevel, descendantEndIndex } from './gantt/utils/taskUtils.js'
import { todayISO, addISODays, diffISODays } from '../utils/date.js'

const props = defineProps({
  selectedTaskIds: {
    type: Set,
    default: () => new Set()
  }
})

const emit = defineEmits(['selection-changed'])

const projectStore = useProjectStore()

// 剪贴板数据
const clipboard = ref([])

// 展开/收起状态
const collapsedTasks = ref(new Set())

// ==================== 行选择 ====================

const selectedRows = ref(new Set())
const lastSelectedRow = ref(null)
const isRowSelecting = ref(false)
const rowSelectionStart = ref(null)
const rowSelectionStartSelected = ref(new Set())

// ==================== 单元格范围选择 ====================

const selection = ref(null)
const isSelecting = ref(false)
const selectionStart = ref(null)
const lastClickedCell = ref(null)

// 编辑相关状态
const editingCell = ref(null)
const editInputRef = ref(null)

// 列宽调整相关
const resizingCol = ref(null)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

// 列定义
const columns = ref([
  { key: '_dragHandle', title: '', width: 40, editable: false, isDragHandle: true },
  { key: 'id', title: 'ID', width: 80, editable: false },
  { key: 'name', title: '任务名称', width: 250, editable: true, type: 'text' },
  { key: 'start_date', title: '开始日期', width: 120, editable: true, type: 'date' },
  { key: 'end_date', title: '结束日期', width: 120, editable: true, type: 'date' },
  { key: 'duration', title: '工期(天)', width: 90, editable: true, type: 'number' },
  { key: 'status', title: '状态', width: 100, editable: true, type: 'select', options: ['pending', 'in_progress', 'completed'] },
  { key: 'level', title: '层级', width: 70, editable: true, type: 'number' },
  { key: 'resource_groups', title: '资源组', width: 150, editable: true, type: 'multiselect' },
  { key: 'dependencies', title: '依赖', width: 150, editable: true, type: 'multiselect' },
  { key: 'note', title: '备注', width: 200, editable: true, type: 'text' }
])

const allTasks = computed({
  get: () => projectStore.currentProject?.data?.tasks || [],
  set: (newTasks) => {
    if (projectStore.currentProject?.data) {
      projectStore.currentProject.data.tasks = newTasks
    }
  }
})

const resourceGroupOptions = computed(() => {
  const groups = projectStore.currentProject?.data?.resource_groups || []
  return groups.map(g => g.id)
})

const taskIdOptions = computed(() => allTasks.value.map(t => t.id))
const childrenSet = computed(() => buildChildrenSet(allTasks.value))

// ==================== 可见任务与折叠 ====================

const visibleTasks = ref([])
const isDragging = ref(false)

function computeVisibleTasks() {
  const visible = []
  let hideBelow = Infinity

  for (const task of allTasks.value) {
    const level = taskLevel(task)
    if (level <= hideBelow) hideBelow = Infinity
    if (level > hideBelow) continue

    visible.push(task)
    if (collapsedTasks.value.has(task.id)) hideBelow = level
  }

  return visible
}

// 拖拽排序后，将可见任务的新顺序同步回原始任务数组
function syncVisibleTasksToAllTasks() {
  const tasks = allTasks.value
  const hiddenDescendants = new Map()

  for (let i = 0; i < tasks.length; i++) {
    if (!collapsedTasks.value.has(tasks[i].id)) continue
    hiddenDescendants.set(tasks[i].id, tasks.slice(i + 1, descendantEndIndex(tasks, i)))
  }

  const newAllTasks = []
  for (const task of visibleTasks.value) {
    newAllTasks.push(task)
    const hidden = hiddenDescendants.get(task.id)
    if (hidden) newAllTasks.push(...hidden)
  }

  if (projectStore.currentProject?.data) {
    projectStore.currentProject.data.tasks = newAllTasks
  }
}

watch(allTasks, () => {
  // 拖拽过程中不更新，避免干扰 vuedraggable
  if (isDragging.value) return
  visibleTasks.value = computeVisibleTasks()
}, { immediate: true, deep: true })

watch(collapsedTasks, () => {
  visibleTasks.value = computeVisibleTasks()
}, { deep: true })

// 同步外部选中状态到行索引
watch([() => props.selectedTaskIds, visibleTasks], () => {
  // 拖选进行中不回写，避免 emit 回声清空本地选择
  if (isSelecting.value || isRowSelecting.value) return
  selectedRows.value.clear()
  selection.value = null
  lastClickedCell.value = null
  visibleTasks.value.forEach((task, index) => {
    if (props.selectedTaskIds.has(task.id)) {
      selectedRows.value.add(index)
    }
  })
}, { immediate: true, deep: true })

// ==================== 拖拽排序 ====================

function clearTextSelection() {
  window.getSelection()?.removeAllRanges()
}

function onDragStart() {
  isDragging.value = true
  clearTextSelection()
}

function onDragEnd() {
  isDragging.value = false
  clearTextSelection()

  syncVisibleTasksToAllTasks()
  projectStore.saveCurrentProject()
}

function toggleCollapse(taskId) {
  if (collapsedTasks.value.has(taskId)) {
    collapsedTasks.value.delete(taskId)
  } else {
    collapsedTasks.value.add(taskId)
  }
}

// ==================== 单元格数据 ====================

function calculateDuration(start, end) {
  return diffISODays(start, end)
}

function calculateEndDate(startDate, duration) {
  if (!startDate || !duration) return startDate || null
  return addISODays(startDate, parseInt(duration, 10) || 0)
}

function getCellValue(task, colKey) {
  if (colKey === 'duration') {
    return calculateDuration(task.start_date, task.end_date)
  }
  return task[colKey]
}

function getStatusText(status) {
  const map = {
    'pending': '待处理',
    'in_progress': '进行中',
    'completed': '已完成'
  }
  return map[status] || status
}

// ==================== 行选择 ====================

function isRowSelected(rowIndex) {
  return selectedRows.value.has(rowIndex)
}

function applyRowSelection(rowIndex, event) {
  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd + 点击：切换选中状态
    if (selectedRows.value.has(rowIndex)) {
      selectedRows.value.delete(rowIndex)
    } else {
      selectedRows.value.add(rowIndex)
      lastSelectedRow.value = rowIndex
    }
  } else if (event.shiftKey && lastSelectedRow.value !== null) {
    // Shift + 点击：范围选择
    const start = Math.min(lastSelectedRow.value, rowIndex)
    const end = Math.max(lastSelectedRow.value, rowIndex)
    selectedRows.value.clear()
    for (let i = start; i <= end; i++) {
      selectedRows.value.add(i)
    }
  } else {
    // 普通点击：单选
    selectedRows.value.clear()
    selectedRows.value.add(rowIndex)
    lastSelectedRow.value = rowIndex
  }
  emitSelectionChanged()
}

function handleDragHandleClick(event, rowIndex) {
  selection.value = null
  lastClickedCell.value = null
  applyRowSelection(rowIndex, event)
}

// ==================== 单元格范围选择 ====================

function isCellSelected(rowIndex, colIndex) {
  if (!selection.value) return false

  const { startRow, startCol, endRow, endCol } = selection.value
  return rowIndex >= Math.min(startRow, endRow) && rowIndex <= Math.max(startRow, endRow) &&
         colIndex >= Math.min(startCol, endCol) && colIndex <= Math.max(startCol, endCol)
}

function isRowInSelection(rowIndex) {
  if (!selection.value) return false
  const { startRow, endRow } = selection.value
  return rowIndex >= Math.min(startRow, endRow) && rowIndex <= Math.max(startRow, endRow)
}

function isColInSelection(colIndex) {
  if (!selection.value) return false
  const { startCol, endCol } = selection.value
  return colIndex >= Math.min(startCol, endCol) && colIndex <= Math.max(startCol, endCol)
}

// 选中区域外圈强调框：仅在选区边缘单元格绘制 inset box-shadow
function getSelectionOutlineStyle(rowIndex, colIndex) {
  const color = 'var(--accent-color)'
  const shadows = []

  if (selectedRows.value.size > 0) {
    if (!selectedRows.value.has(rowIndex)) return null
    const lastCol = columns.value.length - 1
    if (!selectedRows.value.has(rowIndex - 1)) shadows.push(`inset 0 2px 0 0 ${color}`)
    if (!selectedRows.value.has(rowIndex + 1)) shadows.push(`inset 0 -2px 0 0 ${color}`)
    if (colIndex === 0) shadows.push(`inset 2px 0 0 0 ${color}`)
    if (colIndex === lastCol) shadows.push(`inset -2px 0 0 0 ${color}`)
  } else if (selection.value && isCellSelected(rowIndex, colIndex)) {
    const { startRow, startCol, endRow, endCol } = selection.value
    const minR = Math.min(startRow, endRow)
    const maxR = Math.max(startRow, endRow)
    const minC = Math.min(startCol, endCol)
    const maxC = Math.max(startCol, endCol)
    if (rowIndex === minR) shadows.push(`inset 0 2px 0 0 ${color}`)
    if (rowIndex === maxR) shadows.push(`inset 0 -2px 0 0 ${color}`)
    if (colIndex === minC) shadows.push(`inset 2px 0 0 0 ${color}`)
    if (colIndex === maxC) shadows.push(`inset -2px 0 0 0 ${color}`)
  } else {
    return null
  }

  return shadows.length ? { boxShadow: shadows.join(', ') } : null
}

const selectedTasks = computed(() => {
  const tasks = []
  if (selectedRows.value.size > 0) {
    selectedRows.value.forEach(rowIndex => {
      const task = visibleTasks.value[rowIndex]
      if (task) tasks.push(task)
    })
  } else if (selection.value) {
    // 兼容单元格选择
    const { startRow, endRow } = selection.value
    for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
      const task = visibleTasks.value[row]
      if (task) tasks.push(task)
    }
  }
  return tasks
})

function handleCellClick(event, rowIndex, colIndex) {
  if (columns.value[colIndex]?.isDragHandle) return

  if (editingCell.value) {
    saveEdit()
  }

  if (event.shiftKey && lastClickedCell.value) {
    selection.value = {
      startRow: lastClickedCell.value.row,
      startCol: lastClickedCell.value.col,
      endRow: rowIndex,
      endCol: colIndex
    }
  } else {
    selection.value = { startRow: rowIndex, startCol: colIndex, endRow: rowIndex, endCol: colIndex }
    lastClickedCell.value = { row: rowIndex, col: colIndex }
  }
}

function handleCellMouseDown(event, rowIndex, colIndex) {
  if (event.button !== 0) return

  const target = event.target

  // 行选择区域由 handleDragHandleCellMouseDown 处理
  const isRowSelectArea = target.closest?.('.row-select-area')
  const isDragHandleIcon = target.closest?.('.drag-handle-icon')
  if (isRowSelectArea && !isDragHandleIcon) return

  // 拖拽把手列让 vuedraggable 处理
  if (columns.value[colIndex]?.isDragHandle) return

  // 编辑输入框等交互元素不进入选择逻辑
  if (target.closest('input, select, textarea, button')) return

  // 阻止拖动时的原生文本选择
  event.preventDefault()

  // 清除行选择
  selectedRows.value.clear()
  lastSelectedRow.value = null

  if (event.ctrlKey || event.metaKey || event.shiftKey) return

  isSelecting.value = true
  selectionStart.value = { row: rowIndex, col: colIndex }
  selection.value = {
    startRow: rowIndex,
    startCol: colIndex,
    endRow: rowIndex,
    endCol: colIndex
  }
  lastClickedCell.value = { row: rowIndex, col: colIndex }

  emitSelectionChanged()

  document.addEventListener('mousemove', handleCellMouseMove)
  document.addEventListener('mouseup', handleCellMouseUp)
}

// 拖拽把手单元格按下：开始行选择拖拽
function handleDragHandleCellMouseDown(event, rowIndex) {
  if (event.button !== 0) return

  // 点击拖拽图标时让 vuedraggable 处理排序
  if (event.target.closest('.drag-handle-icon')) return

  event.stopPropagation()
  event.preventDefault()

  selection.value = null
  lastClickedCell.value = null

  isRowSelecting.value = true
  rowSelectionStart.value = rowIndex
  rowSelectionStartSelected.value = new Set(selectedRows.value)

  if (event.ctrlKey || event.metaKey) {
    applyRowSelection(rowIndex, event)
  } else {
    selectedRows.value.clear()
    selectedRows.value.add(rowIndex)
    lastSelectedRow.value = rowIndex
    emitSelectionChanged()
  }

  document.addEventListener('mousemove', handleRowSelectionMouseMove)
  document.addEventListener('mouseup', handleRowSelectionMouseUp)
}

// 从鼠标位置解析表格行列索引
function getCellIndexFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY)
  const cell = element?.closest('.table-cell')
  if (!cell) return null

  const row = cell.closest('tr')
  const tbody = row?.closest('tbody')
  if (!row || !tbody) return null

  return {
    rowIndex: Array.from(tbody.children).indexOf(row),
    colIndex: Array.from(row.children).indexOf(cell)
  }
}

function handleCellMouseMove(event) {
  if (!isSelecting.value || !selectionStart.value) return

  const pos = getCellIndexFromPoint(event.clientX, event.clientY)
  if (!pos) return

  if (pos.rowIndex >= 0 && pos.rowIndex < visibleTasks.value.length &&
      pos.colIndex >= 0 && pos.colIndex < columns.value.length) {
    selection.value = {
      startRow: selectionStart.value.row,
      startCol: selectionStart.value.col,
      endRow: pos.rowIndex,
      endCol: pos.colIndex
    }
    emitSelectionChanged()
  }
}

function handleCellMouseUp() {
  isSelecting.value = false
  selectionStart.value = null

  document.removeEventListener('mousemove', handleCellMouseMove)
  document.removeEventListener('mouseup', handleCellMouseUp)
}

function handleRowSelectionMouseMove(event) {
  if (!isRowSelecting.value || rowSelectionStart.value === null) return

  const pos = getCellIndexFromPoint(event.clientX, event.clientY)
  if (!pos) return

  if (pos.rowIndex >= 0 && pos.rowIndex < visibleTasks.value.length) {
    const start = Math.min(rowSelectionStart.value, pos.rowIndex)
    const end = Math.max(rowSelectionStart.value, pos.rowIndex)

    selectedRows.value = new Set(rowSelectionStartSelected.value)
    for (let i = start; i <= end; i++) {
      selectedRows.value.add(i)
    }
    emitSelectionChanged()
  }
}

function handleRowSelectionMouseUp() {
  isRowSelecting.value = false
  rowSelectionStart.value = null
  rowSelectionStartSelected.value = new Set()

  document.removeEventListener('mousemove', handleRowSelectionMouseMove)
  document.removeEventListener('mouseup', handleRowSelectionMouseUp)
}

function emitSelectionChanged() {
  const selectedIds = []
  selectedRows.value.forEach(rowIndex => {
    const task = visibleTasks.value[rowIndex]
    if (task) {
      selectedIds.push(task.id)
    }
  })
  emit('selection-changed', selectedIds)
}

function clearSelection() {
  selectedRows.value.clear()
  lastSelectedRow.value = null
  selection.value = null
  lastClickedCell.value = null
  emitSelectionChanged()
}

// ==================== 编辑功能 ====================

function startEdit(rowIndex, colIndex) {
  const col = columns.value[colIndex]
  if (!col || !col.editable || col.isDragHandle) return

  const task = visibleTasks.value[rowIndex]
  if (!task) return

  let value = getCellValue(task, col.key)

  if (col.type === 'multiselect') {
    value = parseDependencies(value).join(';')
  }

  editingCell.value = {
    row: rowIndex,
    col: colIndex,
    key: col.key,
    value,
    type: col.type,
    options: col.key === 'resource_groups' ? resourceGroupOptions.value :
             col.key === 'dependencies' ? taskIdOptions.value :
             col.options || []
  }

  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select?.()
  })
}

function saveEdit() {
  if (!editingCell.value) return

  const { row, key, value, type } = editingCell.value
  const task = visibleTasks.value[row]
  editingCell.value = null

  if (!task) return

  const originalTask = allTasks.value.find(t => t.id === task.id)
  if (!originalTask) return

  let processedValue = value
  if (type === 'number') {
    processedValue = parseInt(value) || 0
  } else if (type === 'multiselect') {
    processedValue = typeof value === 'string'
      ? value.split(';').map(s => s.trim()).filter(s => s)
      : []
  }

  if (key === 'duration') {
    originalTask.duration = processedValue
    if (originalTask.start_date) {
      originalTask.end_date = calculateEndDate(originalTask.start_date, processedValue)
    }
  } else if (key === 'end_date') {
    originalTask.end_date = processedValue
    if (originalTask.start_date && processedValue) {
      originalTask.duration = calculateDuration(originalTask.start_date, processedValue)
    }
  } else if (key === 'start_date') {
    originalTask.start_date = processedValue
    if (originalTask.end_date && processedValue) {
      originalTask.duration = calculateDuration(processedValue, originalTask.end_date)
    }
  } else {
    originalTask[key] = processedValue
    if (key === 'status' && processedValue === 'completed') {
      originalTask.progress = 100
      originalTask.actual_end_date = todayISO()
    }
  }

  if (key === 'status') {
    projectStore.updateParentTaskStatus(originalTask.id)
  }
  projectStore.saveCurrentProject()
}

function handleEditKeydown(event) {
  if (event.key === 'Enter') {
    saveEdit()
  } else if (event.key === 'Escape') {
    editingCell.value = null
  }
}

// ==================== 列宽调整 ====================

function startResize(event, colIndex) {
  event.preventDefault()
  event.stopPropagation()

  resizingCol.value = colIndex
  resizeStartX.value = event.clientX
  resizeStartWidth.value = columns.value[colIndex].width

  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeUp)
}

function handleResizeMove(event) {
  if (resizingCol.value === null) return

  const delta = event.clientX - resizeStartX.value
  columns.value[resizingCol.value].width = Math.max(40, resizeStartWidth.value + delta)
}

function handleResizeUp() {
  resizingCol.value = null
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeUp)
}

// ==================== 多选下拉框 ====================

const activeDropdown = ref(null)

function toggleMultiselectDropdown(event, rowIndex, colIndex) {
  event.stopPropagation()

  const col = columns.value[colIndex]
  const task = visibleTasks.value[rowIndex]
  if (!col || !task) return

  const rect = event.target.closest('.multiselect-cell')?.getBoundingClientRect()
  if (!rect) return

  if (activeDropdown.value?.row === rowIndex && activeDropdown.value?.col === colIndex) {
    activeDropdown.value = null
    return
  }

  activeDropdown.value = {
    row: rowIndex,
    col: colIndex,
    key: col.key,
    options: col.key === 'resource_groups' ? resourceGroupOptions.value :
             col.key === 'dependencies' ? taskIdOptions.value :
             col.options || [],
    selectedValues: [...parseDependencies(task[col.key])],
    rect
  }
}

function toggleOption(option) {
  if (!activeDropdown.value) return

  const { row, key, selectedValues } = activeDropdown.value
  const task = visibleTasks.value[row]
  if (!task) return

  const index = selectedValues.indexOf(option)
  if (index > -1) {
    selectedValues.splice(index, 1)
  } else {
    selectedValues.push(option)
  }

  const originalTask = allTasks.value.find(t => t.id === task.id)
  if (originalTask) {
    originalTask[key] = [...selectedValues]
    projectStore.saveCurrentProject()
  }
}

function removeTag(task, key, tag) {
  const originalTask = allTasks.value.find(t => t.id === task.id)
  if (!originalTask) return

  const currentValues = parseDependencies(originalTask[key])
  const index = currentValues.indexOf(tag)
  if (index > -1) {
    currentValues.splice(index, 1)
    originalTask[key] = [...currentValues]
    projectStore.saveCurrentProject()
  }
}

function handleDocumentClick(event) {
  if (!activeDropdown.value) return

  const dropdown = document.querySelector('.multiselect-dropdown')
  if (dropdown && !dropdown.contains(event.target)) {
    activeDropdown.value = null
  }
}

watch(activeDropdown, (newVal) => {
  if (newVal) {
    document.addEventListener('click', handleDocumentClick)
  } else {
    document.removeEventListener('click', handleDocumentClick)
  }
})

// ==================== 剪贴板 ====================

function generateId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function copySelectedTasks() {
  const tasks = selectedTasks.value
  if (tasks.length === 0) return

  clipboard.value = tasks.map(task => ({ ...task }))
}

function pasteTasks() {
  if (clipboard.value.length === 0) return

  const tasks = allTasks.value

  let insertIndex = tasks.length
  if (selectedRows.value.size > 0) {
    const lastVisibleIndex = Math.max(...selectedRows.value)
    const visibleTask = visibleTasks.value[lastVisibleIndex]
    if (visibleTask) insertIndex = indexAfterSubtree(tasks, visibleTask.id)
  }

  const tasksToInsert = clipboard.value.map(task => ({
    ...task,
    id: generateId()
  }))

  tasks.splice(insertIndex, 0, ...tasksToInsert)

  selectedRows.value.clear()
  projectStore.saveCurrentProject()
}

function deleteSelectedTasks() {
  const tasks = allTasks.value
  if (tasks.length === 0) return

  const selectedIds = new Set(selectedTasks.value.map(task => task.id))
  if (selectedIds.size === 0) return

  const idsToDelete = new Set()
  for (let i = 0; i < tasks.length; i++) {
    if (!selectedIds.has(tasks[i].id)) continue
    idsToDelete.add(tasks[i].id)
    for (const descendant of tasks.slice(i + 1, descendantEndIndex(tasks, i))) {
      idsToDelete.add(descendant.id)
    }
  }

  allTasks.value = tasks
    .filter(task => !idsToDelete.has(task.id))
    .map(task => {
      const deps = parseDependencies(task.dependencies)
      const remaining = deps.filter(id => !idsToDelete.has(id))
      return remaining.length === deps.length ? task : { ...task, dependencies: remaining }
    })

  for (const id of idsToDelete) collapsedTasks.value.delete(id)
  projectStore.syncAllParentCompletion()
  clearSelection()
  projectStore.saveCurrentProject()
}

// ==================== 行操作 ====================

function addNewRow() {
  const tasks = allTasks.value

  let insertIndex = tasks.length
  let level = 0

  if (selectedRows.value.size > 0) {
    const lastVisibleIndex = Math.max(...selectedRows.value)
    const visibleTask = visibleTasks.value[lastVisibleIndex]
    if (visibleTask) {
      insertIndex = indexAfterSubtree(tasks, visibleTask.id)
      level = taskLevel(visibleTask)
    }
  }

  const today = todayISO()
  tasks.splice(insertIndex, 0, {
    id: generateId(),
    name: '新任务',
    start_date: today,
    end_date: addISODays(today, 1),
    duration: 1,
    status: 'pending',
    level,
    resource_groups: [],
    dependencies: [],
    note: ''
  })
  projectStore.saveCurrentProject()
}

function forEachSelectedTask(callback) {
  const tasks = allTasks.value
  const indices = Array.from(selectedRows.value).sort((a, b) => a - b)
  indices.forEach(index => {
    const visibleTask = visibleTasks.value[index]
    if (!visibleTask) return
    const task = tasks.find(t => t.id === visibleTask.id)
    if (task) callback(task)
  })
}

function moveLeft() {
  if (selectedRows.value.size === 0) return

  forEachSelectedTask(task => {
    if (task.level > 0) {
      task.level--
    }
  })
  projectStore.saveCurrentProject()
}

function moveRight() {
  if (selectedRows.value.size === 0) return

  const tasks = allTasks.value
  forEachSelectedTask(task => {
    const index = tasks.indexOf(task)
    const prevLevel = index > 0 ? taskLevel(tasks[index - 1]) : 0
    task.level = Math.min(taskLevel(task) + 1, prevLevel + 1)
  })
  projectStore.saveCurrentProject()
}

defineExpose({
  addNewRow,
  copySelectedTasks,
  pasteTasks,
  deleteSelectedTasks,
  moveLeft,
  moveRight
})
</script>

<template>
  <div class="flex flex-col h-full bg-[var(--bg-card)]">
    <div class="flex-1 overflow-auto">
      <table class="w-full border-separate border-spacing-0 text-sm table-fixed">
        <thead class="sticky top-0 z-30">
          <tr>
            <th
              v-for="(col, index) in columns"
              :key="col.key"
              class="sticky top-0 z-30 p-0 text-left font-semibold border-b border-[var(--border-color)] text-[var(--text-primary)]"
              :class="isColInSelection(index)
                ? 'bg-[color-mix(in_srgb,var(--accent-color)_16%,var(--bg-secondary))]'
                : 'bg-[var(--bg-secondary)]'"
              :style="{ width: col.width + 'px', minWidth: col.width + 'px' }"
            >
              <div class="flex items-center justify-between py-2.5 px-3 relative">
                <span>{{ col.title }}</span>
                <div
                  class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-500"
                  @mousedown="startResize($event, index)"
                ></div>
              </div>
            </th>
          </tr>
        </thead>
        <draggable
          v-model="visibleTasks"
          tag="tbody"
          item-key="id"
          handle=".drag-handle-icon"
          ghost-class="opacity-40"
          drag-class="sortable-drag"
          :animation="150"
          :force-fallback="true"
          fallback-class="sortable-fallback"
          @start="onDragStart"
          @end="onDragEnd"
        >
          <template #item="{ element: task, index: rowIndex }">
            <tr
              :class="{
                'bg-blue-500/15': isRowSelected(rowIndex),
                'bg-blue-500/5': isRowInSelection(rowIndex)
              }"
            >
              <td
                v-for="(col, colIndex) in columns"
                :key="col.key"
                class="table-cell relative z-0 py-2 px-3 overflow-hidden text-ellipsis whitespace-nowrap cursor-cell border-b border-r last:border-r-0 border-[var(--border-color)]"
                :class="{
                  'bg-blue-500/25': isCellSelected(rowIndex, colIndex),
                  'bg-blue-500/5': isColInSelection(colIndex),
                  'p-0 text-center bg-[var(--bg-secondary)] cursor-grab': col.isDragHandle
                }"
                :style="getSelectionOutlineStyle(rowIndex, colIndex)"
                @click="handleCellClick($event, rowIndex, colIndex)"
                @mousedown="handleCellMouseDown($event, rowIndex, colIndex)"
                @dblclick="startEdit(rowIndex, colIndex)"
              >
                <!-- 拖拽把手列 -->
                <template v-if="col.isDragHandle">
                  <div class="relative w-full h-full min-h-9 flex items-center justify-center">
                    <!-- 行选择区域（单元格内除图标外的区域） -->
                    <div
                      class="row-select-area absolute inset-0 z-[1] cursor-cell"
                      @mousedown="handleDragHandleCellMouseDown($event, rowIndex)"
                    ></div>
                    <!-- 拖拽排序图标 -->
                    <div
                      class="drag-handle-icon relative z-[2] flex items-center justify-center w-5 h-5 rounded cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--border-color)] select-none"
                      title="拖拽调整顺序"
                      @mousedown.prevent
                      @click.stop="handleDragHandleClick($event, rowIndex)"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2zM5 5h2v2H5V5zm0 4h2v2H5V9zm0 4h2v2H5v-2zm0 4h2v2H5v-2z"/>
                      </svg>
                    </div>
                  </div>
                </template>

                <!-- ID 列 -->
                <template v-else-if="col.key === 'id'">
                  <span class="text-[var(--text-primary)]">{{ task.id }}</span>
                </template>

                <!-- 任务名称列（带展开按钮） -->
                <template v-else-if="col.key === 'name'">
                  <div
                    class="flex items-center gap-1.5"
                    :style="{ paddingLeft: (task.level * 20) + 'px' }"
                    @dblclick.stop="startEdit(rowIndex, colIndex)"
                  >
                    <span
                      v-if="childrenSet.has(task.id)"
                      class="w-4 h-4 flex items-center justify-center cursor-pointer text-xs rounded select-none text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                      @click.stop="toggleCollapse(task.id)"
                    >
                      {{ collapsedTasks.has(task.id) ? '▶' : '▼' }}
                    </span>
                    <span v-else class="w-5 shrink-0"></span>
                    <span class="text-[var(--text-primary)]">{{ task.name }}</span>
                  </div>
                </template>

                <!-- 状态列 -->
                <template v-else-if="col.key === 'status'">
                  <StatusBadge :status="task.status" />
                </template>

                <!-- 多选列（资源组、依赖） -->
                <template v-else-if="col.type === 'multiselect'">
                  <div class="multiselect-cell flex items-center justify-between gap-2" @dblclick.stop="startEdit(rowIndex, colIndex)">
                    <div class="flex flex-wrap gap-1 flex-1 overflow-hidden">
                      <Tag
                        v-for="tag in parseDependencies(task[col.key])"
                        :key="tag"
                        :label="tag"
                        removable
                        @remove="removeTag(task, col.key, tag)"
                      />
                    </div>
                    <button
                      class="w-5 h-5 border-0 text-xs flex items-center justify-center rounded flex-shrink-0 bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                      @click.stop="toggleMultiselectDropdown($event, rowIndex, colIndex)"
                    >
                      ▼
                    </button>
                  </div>
                </template>

                <!-- 普通列 -->
                <template v-else>
                  <span class="text-[var(--text-primary)]">{{ getCellValue(task, col.key) }}</span>
                </template>

                <!-- 编辑状态 -->
                <div
                  v-if="editingCell?.row === rowIndex && editingCell?.col === colIndex"
                  class="absolute inset-0 z-10 bg-[var(--bg-card)]"
                  @click.stop
                >
                  <input
                    v-if="editingCell.type !== 'select'"
                    ref="editInputRef"
                    v-model="editingCell.value"
                    :type="editingCell.type === 'number' ? 'number' : editingCell.type === 'date' ? 'date' : 'text'"
                    class="w-full h-full border-2 px-2 text-sm outline-none box-border border-[var(--accent-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                    @keydown="handleEditKeydown"
                    @blur="saveEdit"
                  />
                  <select
                    v-else
                    ref="editInputRef"
                    v-model="editingCell.value"
                    class="w-full h-full border-2 px-2 text-sm outline-none box-border border-[var(--accent-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                    @change="saveEdit"
                    @blur="saveEdit"
                  >
                    <option
                      v-for="option in editingCell.options"
                      :key="option"
                      :value="option"
                    >
                      {{ getStatusText(option) }}
                    </option>
                  </select>
                </div>
              </td>
            </tr>
          </template>
        </draggable>
      </table>
    </div>

    <!-- 多选下拉框 -->
    <Teleport to="body">
      <div
        v-if="activeDropdown"
        class="multiselect-dropdown fixed rounded shadow-lg z-[1000] min-w-[150px] max-h-[200px] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border-color)]"
        style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);"
        :style="{
          top: activeDropdown.rect ? (activeDropdown.rect.bottom + 'px') : '0',
          left: activeDropdown.rect ? (activeDropdown.rect.left + 'px') : '0',
          width: activeDropdown.rect ? (activeDropdown.rect.width + 'px') : 'auto'
        }"
      >
        <div
          v-if="activeDropdown.options.length === 0"
          class="px-3 py-2 text-sm text-[var(--text-muted)] whitespace-nowrap"
        >
          {{ activeDropdown.key === 'resource_groups' ? '暂无资源组，请先在资源管理中创建' : '暂无选项' }}
        </div>
        <div
          v-for="option in activeDropdown.options"
          :key="option"
          class="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          :class="{ 'bg-[var(--accent-color)] text-white': activeDropdown.selectedValues.includes(option) }"
          @click.stop="toggleOption(option)"
        >
          <span class="text-sm">{{ activeDropdown.selectedValues.includes(option) ? '☑' : '☐' }}</span>
          <span>{{ option }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 拖拽时的拖动元素 */
:deep(.sortable-drag) {
  opacity: 1;
  background: var(--bg-card);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  width: auto;
  max-width: 220px;
  height: 32px;
  min-height: 32px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  border: 1px solid var(--border-color);
  outline: none;
  user-select: none;
}

:deep(.sortable-drag) td {
  display: none;
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none !important;
  outline: none;
}

/* 显示拖拽图标列 */
:deep(.sortable-drag) td:first-child {
  display: inline-flex;
  width: 16px;
  min-width: 16px;
  flex-shrink: 0;
}

:deep(.sortable-drag) td:first-child > div {
  min-height: auto;
  color: var(--accent-color);
}

:deep(.sortable-drag) td:first-child svg {
  width: 14px;
  height: 14px;
}

/* 显示任务名称列（第3列） */
:deep(.sortable-drag) td:nth-child(3) {
  display: inline-flex;
  color: var(--text-primary);
  font-weight: 500;
  align-items: center;
}

/* 显示ID列（第2列），放在名称后面 */
:deep(.sortable-drag) td:nth-child(2) {
  display: inline-flex;
  color: var(--text-muted);
  font-size: 11px;
  align-items: center;
  order: 1;
}

:deep(.sortable-drag) td:nth-child(2)::before {
  content: '（';
}

:deep(.sortable-drag) td:nth-child(2)::after {
  content: '）';
}

:deep(.sortable-drag) span {
  color: inherit;
}
</style>
