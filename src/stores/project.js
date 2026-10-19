import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { todayISO, isValidISODate, diffISODays } from '../utils/date'
import { collectDescendants, directChildren, parseDependencies, taskLevel } from '../components/gantt/utils/taskUtils'

export const useProjectStore = defineStore('project', () => {
  const currentProject = ref(null)
  const projects = ref([])

  const currentResourceGroups = computed(() =>
    currentProject.value?.data?.resource_groups || []
  )

  function setCurrentProject(project) {
    currentProject.value = project
  }

  function addProject(project) {
    projects.value.push(project)
  }

  function removeProject(projectId) {
    const index = projects.value.findIndex(p => p.meta?.id === projectId)
    if (index === -1) return null

    const [project] = projects.value.splice(index, 1)
    if (currentProject.value?.meta?.id === project.meta?.id) {
      currentProject.value = projects.value[0] || null
    }
    return project
  }

  function copyProject(projectId) {
    const original = projects.value.find(p => p.meta?.id === projectId)
    if (!original) return null

    const copied = {
      meta: {
        ...original.meta,
        id: `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `${original.meta?.name || '未命名项目'} 副本`
      },
      data: original.data
        ? JSON.parse(JSON.stringify(original.data))
        : { tasks: [], resource_groups: [] }
    }

    projects.value.push(copied)
    return copied
  }

  // ========== 资源组与资源 ==========

  function addResourceGroup(group) {
    const data = currentProject.value?.data
    if (!data) return

    if (!data.resource_groups) {
      data.resource_groups = []
    }
    data.resource_groups.push({
      ...group,
      id: group.id || `group${Date.now()}`,
      resources: group.resources || []
    })
  }

  function updateResourceGroup(groupId, updates) {
    const group = currentProject.value?.data?.resource_groups?.find(g => g.id === groupId)
    if (group) {
      Object.assign(group, updates)
    }
  }

  function removeResourceGroup(groupId) {
    const groups = currentProject.value?.data?.resource_groups
    const index = groups?.findIndex(g => g.id === groupId)
    if (index > -1) {
      groups.splice(index, 1)
    }
  }

  function addResource(groupId, resource) {
    const group = currentProject.value?.data?.resource_groups?.find(g => g.id === groupId)
    if (!group) return

    if (!group.resources) {
      group.resources = []
    }
    group.resources.push({
      ...resource,
      id: resource.id || `resource${Date.now()}`
    })
  }

  function updateResource(groupId, resourceId, updates) {
    const resource = currentProject.value?.data?.resource_groups
      ?.find(g => g.id === groupId)
      ?.resources?.find(r => r.id === resourceId)
    if (resource) {
      Object.assign(resource, updates)
    }
  }

  function removeResource(groupId, resourceId) {
    const resources = currentProject.value?.data?.resource_groups
      ?.find(g => g.id === groupId)
      ?.resources
    const index = resources?.findIndex(r => r.id === resourceId)
    if (index > -1) {
      resources.splice(index, 1)
    }
  }

  // ========== 任务层级工具 ==========

  // 进度只由用户指定。父任务仅在直接子任务全部完成时一并完成，不按子任务比例改写进度。
  function applyParentCompletion(tasks, index) {
    const children = directChildren(tasks, index)
    if (children.length === 0) return false

    const task = tasks[index]
    if (!children.every(child => child.status === 'completed')) return false
    if (task.status === 'completed' && task.progress === 100) return false

    task.status = 'completed'
    task.progress = 100
    task.actual_end_date = todayISO()
    return true
  }

  function parentIndexOf(tasks, index) {
    const level = taskLevel(tasks[index])
    if (level === 0) return -1
    for (let i = index - 1; i >= 0; i--) {
      if (taskLevel(tasks[i]) < level) return i
    }
    return -1
  }

  function updateParentTaskStatus(changedTaskId) {
    const tasks = currentProject.value?.data?.tasks
    if (!tasks?.length || !changedTaskId) return

    let index = tasks.findIndex(task => task.id === changedTaskId)
    if (index === -1) return

    while (index >= 0) {
      const parentIndex = parentIndexOf(tasks, index)
      if (parentIndex === -1) return
      if (!applyParentCompletion(tasks, parentIndex)) return
      index = parentIndex
    }
  }

  function syncAllParentCompletion() {
    const tasks = currentProject.value?.data?.tasks
    if (!tasks) return
    for (let i = tasks.length - 1; i >= 0; i--) {
      applyParentCompletion(tasks, i)
    }
  }

  function updateTasks(newTasks) {
    if (currentProject.value?.data) {
      currentProject.value.data.tasks = newTasks
    }
  }

  // ========== 数据校验与自动修复 ==========

  function validateProjectData() {
    const errors = []
    const tasks = currentProject.value?.data?.tasks || []

    if (tasks.length === 0) return { valid: true, errors: [] }

    // 1. 父任务时间必须包含所有后代任务
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const descendants = collectDescendants(tasks, i)
      if (descendants.length === 0) continue

      for (const child of descendants) {
        if (isValidISODate(task.start_date) && isValidISODate(child.start_date) && child.start_date < task.start_date) {
          errors.push(`任务 "${task.name}" 的开始时间(${task.start_date})晚于子任务 "${child.name}" 的开始时间(${child.start_date})`)
        }
        if (isValidISODate(task.end_date) && isValidISODate(child.end_date) && child.end_date > task.end_date) {
          errors.push(`任务 "${task.name}" 的结束时间(${task.end_date})早于子任务 "${child.name}" 的结束时间(${child.end_date})`)
        }
      }
    }

    // 2. 层级最多比上一个任务大 1
    for (let i = 1; i < tasks.length; i++) {
      const prevLevel = taskLevel(tasks[i - 1])
      const currLevel = taskLevel(tasks[i])
      if (currLevel > prevLevel + 1) {
        errors.push(`任务 "${tasks[i].name}" 的层级(${currLevel})比上一个任务 "${tasks[i - 1].name}" 的层级(${prevLevel})大超过1`)
      }
    }

    // 3. 数据格式
    const seenIds = new Set()
    for (const task of tasks) {
      if (!task.id) {
        errors.push('存在没有ID的任务')
      } else if (seenIds.has(task.id)) {
        errors.push(`任务 ID "${task.id}" 重复`)
      } else {
        seenIds.add(task.id)
      }
      if (parseDependencies(task.dependencies).includes(task.id)) {
        errors.push(`任务 "${task.name}" 不能依赖自身`)
      }
      if (!task.name) {
        errors.push(`任务 "${task.id || '未知'}" 没有名称`)
      }
      if (task.start_date && !isValidISODate(task.start_date)) {
        errors.push(`任务 "${task.name}" 的开始日期格式不正确: ${task.start_date}`)
      }
      if (task.end_date && !isValidISODate(task.end_date)) {
        errors.push(`任务 "${task.name}" 的结束日期格式不正确: ${task.end_date}`)
      }
      if (isValidISODate(task.start_date) && isValidISODate(task.end_date) && task.start_date > task.end_date) {
        errors.push(`任务 "${task.name}" 的开始时间晚于结束时间`)
      }
      if (task.progress !== undefined && (task.progress < 0 || task.progress > 100)) {
        errors.push(`任务 "${task.name}" 的进度(${task.progress})不在0-100范围内`)
      }
      const validStatuses = ['pending', 'in_progress', 'completed', 'overdue']
      if (task.status && !validStatuses.includes(task.status)) {
        errors.push(`任务 "${task.name}" 的状态 "${task.status}" 不是有效值`)
      }
      if (task.level !== undefined && (task.level < 0 || !Number.isInteger(task.level))) {
        errors.push(`任务 "${task.name}" 的层级(${task.level})必须是大于等于0的整数`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // 自动修复项目数据 - 返回修复后的任务数组和修复日志
  function autoFixProjectData() {
    const tasks = currentProject.value?.data?.tasks || []
    const fixes = []

    if (tasks.length === 0) return { fixedTasks: tasks, fixes }

    const fixedTasks = tasks.map(t => ({ ...t }))

    // 1. 修复父任务时间以包含所有后代任务（从后向前，保证多层父任务收敛）
    for (let i = fixedTasks.length - 1; i >= 0; i--) {
      const task = fixedTasks[i]
      const descendants = collectDescendants(fixedTasks, i)
      if (descendants.length === 0) continue

      let earliestStart = null
      let latestEnd = null
      for (const child of descendants) {
        if (isValidISODate(child.start_date) && (!earliestStart || child.start_date < earliestStart)) {
          earliestStart = child.start_date
        }
        if (isValidISODate(child.end_date) && (!latestEnd || child.end_date > latestEnd)) {
          latestEnd = child.end_date
        }
      }

      if (earliestStart && (!isValidISODate(task.start_date) || earliestStart < task.start_date)) {
        const oldStart = task.start_date
        task.start_date = earliestStart
        if (oldStart !== task.start_date) {
          fixes.push(`任务 "${task.name}" 的开始时间从 ${oldStart} 调整为 ${task.start_date}`)
        }
      }

      if (latestEnd && (!isValidISODate(task.end_date) || latestEnd > task.end_date)) {
        const oldEnd = task.end_date
        task.end_date = latestEnd
        if (oldEnd !== task.end_date) {
          fixes.push(`任务 "${task.name}" 的结束时间从 ${oldEnd} 调整为 ${task.end_date}`)
        }
      }

      if (isValidISODate(task.start_date) && isValidISODate(task.end_date)) {
        const newDuration = diffISODays(task.start_date, task.end_date)
        if (task.duration !== newDuration) {
          fixes.push(`任务 "${task.name}" 的持续时间从 ${task.duration} 调整为 ${newDuration}`)
          task.duration = newDuration
        }
      }
    }

    // 2. 修复层级（最多比上一个任务大 1）
    for (let i = 1; i < fixedTasks.length; i++) {
      const prevLevel = taskLevel(fixedTasks[i - 1])
      const currLevel = taskLevel(fixedTasks[i])
      if (currLevel > prevLevel + 1) {
        fixedTasks[i].level = prevLevel + 1
        fixes.push(`任务 "${fixedTasks[i].name}" 的层级从 ${currLevel} 调整为 ${fixedTasks[i].level}`)
      }
    }

    return { fixedTasks, fixes }
  }

  // ========== 持久化 ==========

  // 保存当前项目到文件。先同步应用自动修复，再一次性写入，
  // 避免旧实现中 setTimeout 补丁造成的内存与文件不一致。
  async function saveProject(project = currentProject.value) {
    if (!project?.filename || !project.data) return false

    try {
      if (project === currentProject.value) {
        const validation = validateProjectData()
        if (!validation.valid) {
          console.warn('项目数据验证失败:', validation.errors)
        }

        const { fixedTasks, fixes } = autoFixProjectData()
        if (fixes.length > 0) {
          console.log('自动修复项目数据:', fixes)
          project.data.tasks = fixedTasks
        }
      }

      await invoke('write_file', {
        path: project.filename,
        content: JSON.stringify({ meta: project.meta, data: project.data }, null, 2)
      })
      return true
    } catch (error) {
      console.error('保存项目失败:', error)
      return false
    }
  }

  function saveCurrentProject() {
    return saveProject(currentProject.value)
  }

  return {
    currentProject,
    projects,
    currentResourceGroups,
    setCurrentProject,
    addProject,
    removeProject,
    copyProject,
    addResourceGroup,
    updateResourceGroup,
    removeResourceGroup,
    addResource,
    updateResource,
    removeResource,
    updateTasks,
    saveProject,
    saveCurrentProject,
    updateParentTaskStatus,
    syncAllParentCompletion
  }
})
