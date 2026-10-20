<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside, useClipboard, useEventListener, useTimeoutFn } from '@vueuse/core'
import { useProjectStore } from '../stores/project'
import draggable from 'vuedraggable'
import { Tag, StatusBadge } from './ui'
import { buildChildrenSet, parseDependencies, indexAfterSubtree, taskLevel, descendantEndIndex } from './gantt/utils/taskUtils.js'
import { todayISO, addISODays, diffISODays } from '../utils/date.js'
import { showHoverTip, hideHoverTip } from '../utils/hoverTip'
import find from 'lodash/find'
import toInteger from 'lodash/toInteger'
import { createId } from '../utils/id'

const props = defineProps({
  selectedTaskIds: {
    type: Set,
    default: () => new Set()
  }
})

const emit = defineEmits(['selection-changed'])

const { t } = useI18n()
const projectStore = useProjectStore()
const tableRoot = ref(null)

const clipboardText = ref('')
const { copy: copyToClipboard } = useClipboard({ legacy: true })
const dropdownRef = ref(null)

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

const statusOptions = computed(() => [
  { value: 'pending', label: t('status.pending') },
  { value: 'in_progress', label: t('status.in_progress') },
  { value: 'completed', label: t('status.completed') },
  { value: 'overdue', label: t('status.overdue') }
])

// 展示、编辑控件、底层文本都只由列类型决定
const columns = ref([
  { key: '_dragHandle', title: '', width: 40, editable: false, isDragHandle: true },
  { key: 'id', title: 'ID', width: 80, editable: false, type: 'text' },
  { key: 'name', titleKey: 'table.name', width: 250, editable: true, type: 'text', display: 'tree' },
  { key: 'start_date', titleKey: 'table.start', width: 120, editable: true, type: 'date' },
  { key: 'end_date', titleKey: 'table.end', width: 120, editable: true, type: 'date' },
  { key: 'duration', titleKey: 'table.duration', width: 90, editable: true, type: 'number' },
  { key: 'status', titleKey: 'table.status', width: 100, editable: true, type: 'select' },
  { key: 'level', titleKey: 'table.level', width: 70, editable: true, type: 'number' },
  { key: 'resource_groups', titleKey: 'table.groups', width: 150, editable: true, type: 'tags' },
  { key: 'dependencies', titleKey: 'table.dependencies', width: 150, editable: true, type: 'tags' },
  { key: 'note', titleKey: 'table.note', width: 200, editable: true, type: 'text' }
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
function selectedTaskIdsFromTable() {
  const ids = []
  const rowIndexes = new Set(selectedRows.value)
  if (selection.value) {
    const start = Math.min(selection.value.startRow, selection.value.endRow)
    const end = Math.max(selection.value.startRow, selection.value.endRow)
    for (let row = start; row <= end; row++) rowIndexes.add(row)
  }
  rowIndexes.forEach(rowIndex => {
    const task = visibleTasks.value[rowIndex]
    if (task) ids.push(task.id)
  })
  return ids
}

watch([() => props.selectedTaskIds, visibleTasks], () => {
  // 拖选进行中不回写，避免 emit 回声清空本地选择
  if (isSelecting.value || isRowSelecting.value) return
  const current = selectedTaskIdsFromTable()
  const incoming = props.selectedTaskIds
  if (incoming.size === current.length && current.every(id => incoming.has(id))) return
  selectedRows.value.clear()
  selection.value = null
  lastClickedCell.value = null
  visibleTasks.value.forEach((task, index) => {
    if (incoming.has(task.id)) selectedRows.value.add(index)
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

function columnOptions(col) {
  if (col.type === 'select') return statusOptions.value
  if (col.key === 'resource_groups') {
    return resourceGroupOptions.value.map(id => ({ value: id, label: id }))
  }
  if (col.key === 'dependencies') {
    return taskIdOptions.value.map(id => ({ value: id, label: id }))
  }
  return []
}

function isLockedCell(task, col) {
  return Boolean(task && col && childrenSet.value.has(task.id) && (col.key === 'status' || col.key === 'dependencies'))
}

function cellTip(task, col) {
  if (isLockedCell(task, col)) {
    return col.key === 'status' ? t('table.statusLocked') : t('table.depsLocked')
  }
  if (!task || !col || col.isDragHandle) return ''
  if (col.type === 'select') {
    const raw = task[col.key]
    const label = statusOptions.value.find(option => option.value === raw)?.label || raw
    return label ? t('table.tip', { title: t(col.titleKey), value: label }) : ''
  }
  const text = cellText(task, col)
  return text ? t('table.tip', { title: t(col.titleKey), value: text }) : ''
}

function onTableMouseMove(event) {
  if (isSelecting.value || isRowSelecting.value || editingCell.value) {
    hideHoverTip()
    return
  }
  const cell = event.target.closest?.('.table-cell')
  if (!cell?.dataset.cell) {
    hideHoverTip()
    return
  }
  const [row, col] = cell.dataset.cell.split('-').map(Number)
  showHoverTip(cellTip(visibleTasks.value[row], columns.value[col]), event)
}

function cellText(task, col) {
  if (!task || !col || col.isDragHandle) return ''
  if (col.key === 'duration') return String(diffISODays(task.start_date, task.end_date))
  if (col.type === 'tags') return parseDependencies(task[col.key]).join(';')
  const value = task[col.key]
  return value == null ? '' : String(value)
}

function applyCellText(task, col, text) {
  if (isLockedCell(task, col)) return

  const raw = text ?? ''
  if (col.type === 'tags') {
    task[col.key] = parseDependencies(raw)
    return
  }
  if (col.type === 'number') {
    const value = toInteger(raw)
    if (col.key === 'duration') {
      task.duration = value
      if (task.start_date) task.end_date = addISODays(task.start_date, value)
      projectStore.refreshTaskSchedule(task)
    } else if (col.key === 'level') {
      task.level = Math.max(0, value)
    } else {
      task[col.key] = value
    }
    return
  }
  if (col.key === 'start_date' || col.key === 'end_date') {
    task[col.key] = raw
    if (task.start_date && task.end_date) {
      task.duration = diffISODays(task.start_date, task.end_date)
    }
    projectStore.refreshTaskSchedule(task)
    return
  }
  if (col.key === 'status') {
    projectStore.applyTaskStatus(task, raw)
    return
  }
  task[col.key] = raw
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

const pendingEditTarget = ref(null)
const { start: scheduleEditorOpen, stop: cancelEditorOpen } = useTimeoutFn(() => {
  const target = pendingEditTarget.value
  if (!target) return
  beginEdit(target.row, target.col, 'editor')
  pendingEditTarget.value = null
}, 220, { immediate: false })

function onCellActivate(event, rowIndex, colIndex) {
  if (columns.value[colIndex]?.isDragHandle) return
  if (event.detail >= 3) {
    cancelEditorOpen()
    pendingEditTarget.value = null
    beginEdit(rowIndex, colIndex, 'text')
    return
  }
  if (event.detail === 2) {
    pendingEditTarget.value = { row: rowIndex, col: colIndex }
    scheduleEditorOpen()
    return
  }
  cancelEditorOpen()
  pendingEditTarget.value = null
  handleCellClick(event, rowIndex, colIndex)
}

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
  tableRoot.value?.focus()

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
}

// 拖拽把手单元格按下：开始行选择拖拽
function handleDragHandleCellMouseDown(event, rowIndex) {
  if (event.button !== 0) return

  // 点击拖拽图标时让 vuedraggable 处理排序
  if (event.target.closest('.drag-handle-icon')) return

  event.stopPropagation()
  event.preventDefault()
  tableRoot.value?.focus()

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
  if (!isSelecting.value) return
  isSelecting.value = false
  selectionStart.value = null
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
  if (!isRowSelecting.value) return
  isRowSelecting.value = false
  rowSelectionStart.value = null
  rowSelectionStartSelected.value = new Set()
}

function selectColumn(colIndex) {
  if (columns.value[colIndex]?.isDragHandle || visibleTasks.value.length === 0) return
  selectedRows.value.clear()
  lastSelectedRow.value = null
  selection.value = {
    startRow: 0,
    startCol: colIndex,
    endRow: visibleTasks.value.length - 1,
    endCol: colIndex
  }
  lastClickedCell.value = { row: 0, col: colIndex }
  emitSelectionChanged()
}

function emitSelectionChanged() {
  emit('selection-changed', selectedTaskIdsFromTable())
}

function clearSelection() {
  selectedRows.value.clear()
  lastSelectedRow.value = null
  selection.value = null
  lastClickedCell.value = null
  emitSelectionChanged()
}

// ==================== 编辑功能 ====================

function beginEdit(rowIndex, colIndex, mode) {
  const col = columns.value[colIndex]
  if (!col?.editable) return
  const task = visibleTasks.value[rowIndex]
  if (!task) return
  if (isLockedCell(task, col)) return

  const asText = mode === 'text' || col.type === 'text'
  if (!asText && col.type === 'tags') {
    editingCell.value = null
    openTagsEditor(rowIndex, colIndex)
    return
  }

  activeDropdown.value = null
  editingCell.value = {
    row: rowIndex,
    col: colIndex,
    key: col.key,
    value: cellText(task, col),
    input: asText ? 'text' : col.type,
    options: columnOptions(col)
  }

  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select?.()
  })
}

function onEditorClick(event, rowIndex, colIndex) {
  if (event.detail >= 3) {
    saveEdit()
    beginEdit(rowIndex, colIndex, 'text')
  }
  event.stopPropagation()
}

function saveEdit() {
  if (!editingCell.value) return

  const { row, col, value } = editingCell.value
  const column = columns.value[col]
  const task = visibleTasks.value[row]
  editingCell.value = null
  if (!task || !column) return

  const originalTask = find(allTasks.value, { id: task.id })
  if (!originalTask) return

  applyCellText(originalTask, column, value == null ? '' : String(value))
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
}

function handleResizeMove(event) {
  if (resizingCol.value === null) return

  const delta = event.clientX - resizeStartX.value
  columns.value[resizingCol.value].width = Math.max(40, resizeStartWidth.value + delta)
}

function handleResizeUp() {
  resizingCol.value = null
}

useEventListener(document, 'mousemove', (event) => {
  if (isSelecting.value) handleCellMouseMove(event)
  else if (isRowSelecting.value) handleRowSelectionMouseMove(event)
  else if (resizingCol.value !== null) handleResizeMove(event)
})

useEventListener(document, 'mouseup', () => {
  if (isSelecting.value) handleCellMouseUp()
  if (isRowSelecting.value) handleRowSelectionMouseUp()
  if (resizingCol.value !== null) handleResizeUp()
})

// ==================== 多选下拉框 ====================

const activeDropdown = ref(null)

function openTagsEditor(rowIndex, colIndex) {
  const col = columns.value[colIndex]
  const task = visibleTasks.value[rowIndex]
  const cell = tableRoot.value?.querySelector(`[data-cell="${rowIndex}-${colIndex}"]`)
  const rect = cell?.getBoundingClientRect()
  if (!col || !task || !rect) return

  if (activeDropdown.value?.row === rowIndex && activeDropdown.value?.col === colIndex) {
    activeDropdown.value = null
    return
  }

  activeDropdown.value = {
    row: rowIndex,
    col: colIndex,
    key: col.key,
    options: columnOptions(col),
    selectedValues: parseDependencies(task[col.key]),
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

  const originalTask = find(allTasks.value, { id: task.id })
  if (originalTask) {
    originalTask[key] = [...selectedValues]
    projectStore.saveCurrentProject()
  }
}

function removeTag(task, key, tag) {
  if (childrenSet.value.has(task.id) && key === 'dependencies') return
  const originalTask = find(allTasks.value, { id: task.id })
  if (!originalTask) return

  const currentValues = parseDependencies(originalTask[key])
  const index = currentValues.indexOf(tag)
  if (index > -1) {
    currentValues.splice(index, 1)
    originalTask[key] = [...currentValues]
    projectStore.saveCurrentProject()
  }
}

onClickOutside(dropdownRef, () => {
  activeDropdown.value = null
})

// ==================== 剪贴板 ====================

function selectedCellRange() {
  if (selection.value) {
    const { startRow, startCol, endRow, endCol } = selection.value
    return {
      r1: Math.min(startRow, endRow),
      r2: Math.max(startRow, endRow),
      c1: Math.min(startCol, endCol),
      c2: Math.max(startCol, endCol)
    }
  }
  if (selectedRows.value.size === 0) return null
  const rows = [...selectedRows.value]
  return {
    r1: Math.min(...rows),
    r2: Math.max(...rows),
    c1: 1,
    c2: columns.value.length - 1
  }
}

async function copySelectedTasks() {
  const range = selectedCellRange()
  if (!range) return

  const lines = []
  for (let row = range.r1; row <= range.r2; row++) {
    const task = visibleTasks.value[row]
    const cells = []
    for (let colIndex = range.c1; colIndex <= range.c2; colIndex++) {
      const col = columns.value[colIndex]
      cells.push(task && col && !col.isDragHandle ? cellText(task, col) : '')
    }
    lines.push(cells.join('\t'))
  }

  const text = lines.join('\n')
  clipboardText.value = text
  try {
    await copyToClipboard(text)
  } catch {
    // 系统剪贴板不可用时仍保留内部文本
  }
}

async function pasteTasks() {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    text = ''
  }
  if (!text) text = clipboardText.value
  if (!text) return

  const range = selectedCellRange()
  const anchor = range
    ? { row: range.r1, col: range.c1 }
    : lastClickedCell.value
  if (!anchor) return

  const grid = text.replace(/\r/g, '').split('\n')
  if (grid.at(-1) === '') grid.pop()

  grid.forEach((line, rowOffset) => {
    const task = visibleTasks.value[anchor.row + rowOffset]
    if (!task) return
    const originalTask = find(allTasks.value, { id: task.id })
    if (!originalTask) return
    line.split('\t').forEach((cell, colOffset) => {
      const col = columns.value[anchor.col + colOffset]
      if (!col?.editable) return
      applyCellText(originalTask, col, cell)
    })
  })
  projectStore.saveCurrentProject()
}

function onTableKeydown(event) {
  if (event.target.closest('input, textarea, select')) return
  const key = event.key.toLowerCase()
  if (key === 'delete' || key === 'backspace') {
    event.preventDefault()
    deleteSelectedTasks()
    return
  }
  if (!(event.ctrlKey || event.metaKey)) return
  if (key === 'c') {
    event.preventDefault()
    copySelectedTasks()
  } else if (key === 'v') {
    event.preventDefault()
    pasteTasks()
  }
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
  projectStore.updateParentTaskStatus()
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
    id: createId('task'),
    name: t('table.newTask'),
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
    const task = find(tasks, { id: visibleTask.id })
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
    <div
      ref="tableRoot"
      class="flex-1 overflow-auto outline-none"
      tabindex="0"
      @keydown="onTableKeydown"
      @mousemove="onTableMouseMove"
      @mouseleave="hideHoverTip"
    >
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
              <div
                class="flex items-center justify-between py-2.5 px-3 relative"
                :class="col.isDragHandle ? '' : 'cursor-pointer'"
                @click="selectColumn(index)"
              >
                <span>{{ col.titleKey ? $t(col.titleKey) : '' }}</span>
                <div
                  class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-500"
                  @mousedown="startResize($event, index)"
                  @click.stop
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
                  'p-0 text-center bg-[var(--bg-secondary)] cursor-grab': col.isDragHandle,
                  'cursor-default': isLockedCell(task, col)
                }"
                :data-cell="`${rowIndex}-${colIndex}`"
                :style="getSelectionOutlineStyle(rowIndex, colIndex)"
                @click="onCellActivate($event, rowIndex, colIndex)"
                @mousedown="handleCellMouseDown($event, rowIndex, colIndex)"
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
                      :title="$t('gantt.dragHandle')"
                      @mousedown.prevent
                      @click.stop="handleDragHandleClick($event, rowIndex)"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2zM5 5h2v2H5V5zm0 4h2v2H5V9zm0 4h2v2H5v-2zm0 4h2v2H5v-2z"/>
                      </svg>
                    </div>
                  </div>
                </template>

                <template v-else-if="col.display === 'tree'">
                  <div
                    class="flex items-center gap-1.5"
                    :style="{ paddingLeft: (task.level * 20) + 'px' }"
                  >
                    <span
                      v-if="childrenSet.has(task.id)"
                      class="w-4 h-4 flex items-center justify-center cursor-pointer text-xs rounded select-none text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                      @click.stop="toggleCollapse(task.id)"
                    >
                      {{ collapsedTasks.has(task.id) ? '▶' : '▼' }}
                    </span>
                    <span v-else class="w-5 shrink-0"></span>
                    <span class="text-[var(--text-primary)]">{{ cellText(task, col) }}</span>
                  </div>
                </template>

                <template v-else-if="col.type === 'select'">
                  <StatusBadge :status="task[col.key]" />
                </template>

                <template v-else-if="col.type === 'tags'">
                  <div class="flex flex-wrap gap-1 overflow-hidden">
                    <Tag
                      v-for="tag in parseDependencies(task[col.key])"
                      :key="tag"
                      :label="tag"
                      :removable="!isLockedCell(task, col)"
                      @remove="removeTag(task, col.key, tag)"
                    />
                  </div>
                </template>

                <template v-else>
                  <span class="text-[var(--text-primary)]">{{ cellText(task, col) }}</span>
                </template>

                <i
                  v-if="isLockedCell(task, col)"
                  class="pi pi-lock absolute top-1 right-1 text-[10px] leading-none text-[var(--text-muted)] pointer-events-none"
                ></i>

                <div
                  v-if="editingCell?.row === rowIndex && editingCell?.col === colIndex"
                  class="absolute inset-0 z-10 bg-[var(--bg-card)]"
                  @click="onEditorClick($event, rowIndex, colIndex)"
                >
                  <input
                    v-if="editingCell.input !== 'select'"
                    ref="editInputRef"
                    v-model="editingCell.value"
                    :type="editingCell.input === 'number' ? 'number' : editingCell.input === 'date' ? 'date' : 'text'"
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
                    @click.stop
                  >
                    <option
                      v-for="option in editingCell.options"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
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
        ref="dropdownRef"
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
          {{ activeDropdown.key === 'resource_groups' ? $t('table.noGroups') : $t('table.noOptions') }}
        </div>
        <div
          v-for="option in activeDropdown.options"
          :key="option.value"
          class="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          :class="{ 'bg-[var(--accent-color)] text-white': activeDropdown.selectedValues.includes(option.value) }"
          @click.stop="toggleOption(option.value)"
        >
          <span class="text-sm">{{ activeDropdown.selectedValues.includes(option.value) ? '☑' : '☐' }}</span>
          <span>{{ option.label }}</span>
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
