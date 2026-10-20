import keyBy from 'lodash/keyBy'

export function taskLevel(task) {
  return task?.level ?? 0
}

export function parseDependencies(deps) {
  if (Array.isArray(deps)) return deps.map(id => String(id).trim()).filter(Boolean)
  if (typeof deps === 'string') return deps.split(';').map(id => id.trim()).filter(Boolean)
  return []
}

export function descendantEndIndex(tasks, index) {
  const level = taskLevel(tasks[index])
  let end = index + 1
  while (end < tasks.length && taskLevel(tasks[end]) > level) end++
  return end
}

export function collectDescendants(tasks, index) {
  if (index < 0 || index >= tasks.length) return []
  return tasks.slice(index + 1, descendantEndIndex(tasks, index))
}

export function directChildren(tasks, index) {
  const parentLevel = taskLevel(tasks[index])
  return collectDescendants(tasks, index).filter(task => taskLevel(task) === parentLevel + 1)
}

export function isParentTask(tasks, task) {
  const index = tasks.findIndex(item => item.id === task?.id)
  return index !== -1 && directChildren(tasks, index).length > 0
}

export function ancestorTasks(tasks, index) {
  const ancestors = []
  let level = taskLevel(tasks[index])
  for (let i = index - 1; i >= 0 && level > 0; i--) {
    const itemLevel = taskLevel(tasks[i])
    if (itemLevel < level) {
      ancestors.push(tasks[i])
      level = itemLevel
    }
  }
  return ancestors
}

export function effectiveDependencies(tasks, task) {
  const index = tasks.findIndex(item => item.id === task?.id)
  if (index === -1) return parseDependencies(task?.dependencies)
  const blocked = new Set([task.id, ...collectDescendants(tasks, index).map(item => item.id)])
  const seen = new Set()
  const ids = []
  const chain = [...ancestorTasks(tasks, index)].reverse()
  chain.push(tasks[index])
  for (const item of chain) {
    for (const id of parseDependencies(item.dependencies)) {
      if (blocked.has(id) || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

export function statusFromChildren(children) {
  const statuses = children.map(child => child.status || 'pending')
  if (statuses.every(status => status === 'completed')) return 'completed'
  if (statuses.some(status => status === 'overdue')) return 'overdue'
  if (statuses.some(status => status === 'in_progress' || status === 'completed')) return 'in_progress'
  return 'pending'
}

export function canCompleteTask(task, tasks) {
  return !isParentTask(tasks, task)
}

export function canStartTask(task, tasks) {
  return Boolean(task)
    && task.status === 'pending'
    && canCompleteTask(task, tasks)
    && areDependenciesCompleted(task, tasks)
}

export function indexAfterSubtree(tasks, taskId) {
  const index = tasks.findIndex(task => task.id === taskId)
  if (index === -1) return tasks.length
  return descendantEndIndex(tasks, index)
}

export function buildChildrenSet(tasks) {
  const hasChildren = new Set()
  const ancestors = []

  for (const task of tasks) {
    const level = taskLevel(task)
    while (ancestors.length && ancestors[ancestors.length - 1].level >= level) {
      ancestors.pop()
    }
    const parent = ancestors[ancestors.length - 1]
    if (parent && parent.level === level - 1) {
      hasChildren.add(parent.id)
    }
    ancestors.push({ id: task.id, level })
  }

  return hasChildren
}

export function areDependenciesCompleted(task, allTasks) {
  const deps = effectiveDependencies(allTasks, task)
  if (!deps.length) return true

  const taskMap = keyBy(allTasks, 'id')
  return deps.every(depId => {
    const depTask = taskMap[depId]
    return !depTask || depTask.status === 'completed'
  })
}

const statusColors = {
  in_progress: '#3b82f6',
  completed: '#22c55e',
  overdue: '#ef4444'
}

export function taskStatusColor(task, allTasks) {
  if (task?.status === 'pending') {
    return areDependenciesCompleted(task, allTasks) ? '#f97316' : '#94a3b8'
  }
  return statusColors[task?.status] || task?.color || '#3b82f6'
}

export function getVisibleRowRange(scrollTop, viewportHeight, rowHeight, totalRows, buffer = 2) {
  if (totalRows <= 0 || rowHeight <= 0) return { startRow: 0, endRow: -1 }

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer)
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer
  )
  return { startRow, endRow }
}
