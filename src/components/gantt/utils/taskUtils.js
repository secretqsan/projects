export function taskLevel(task) {
  return task?.level || 0
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
  const deps = parseDependencies(task.dependencies)
  if (!deps.length) return true

  const taskMap = new Map(allTasks.map(t => [t.id, t]))
  return deps.every(depId => {
    const depTask = taskMap.get(depId)
    return !depTask || depTask.status === 'completed'
  })
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
