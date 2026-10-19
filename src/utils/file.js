import { invoke } from '@tauri-apps/api/core'

/**
 * 显示打开文件对话框
 */
export async function selectFileToOpen() {
  return await invoke('open_file_dialog')
}

/**
 * 显示保存文件对话框
 */
export async function selectFileToSave() {
  return await invoke('save_file_dialog')
}

/**
 * 创建空项目结构
 */
function createEmptyProject() {
  return {
    meta: {
      id: `project${Date.now()}`,
      name: '新建项目',
      app: 'project-manager',
      version: '1.0'
    },
    data: {
      tasks: [],
      resource_groups: []
    }
  }
}

function isValidProject(project) {
  return project
    && typeof project === 'object'
    && project.meta && typeof project.meta === 'object'
    && project.data && typeof project.data === 'object'
}

/**
 * 打开项目。文件不存在时创建空项目（新建项目流程）；
 * 文件存在但不是有效项目结构时返回错误，不修改原文件。
 */
export async function openProject(filename, configStore, projectStore) {
  try {
    let project
    let isNew = false

    let content
    try {
      content = await invoke('read_file', { path: filename })
    } catch (error) {
      const message = typeof error === 'string' ? error : (error?.message || String(error))
      if (!message.includes('NOT_FOUND')) {
        return { success: false, project: null, isNew: false, error: message }
      }
      project = createEmptyProject()
      await invoke('write_file', {
        path: filename,
        content: JSON.stringify(project, null, 2)
      })
      isNew = true
    }

    if (!project) {
      try {
        project = JSON.parse(content)
      } catch {
        return { success: false, project: null, isNew: false, error: '文件不是有效的 JSON' }
      }
      if (!isValidProject(project)) {
        return { success: false, project: null, isNew: false, error: '文件不是有效的项目格式（缺少 meta 或 data 字段）' }
      }
    }

    project.filename = filename
    configStore.addToHistory(filename)

    const existingIndex = projectStore.projects.findIndex(p => p.filename === filename)
    if (existingIndex > -1) {
      projectStore.projects[existingIndex] = project
    } else {
      projectStore.addProject(project)
    }

    projectStore.setCurrentProject(project)

    return { success: true, project, isNew }
  } catch (error) {
    return { success: false, project: null, isNew: false, error: error.toString() }
  }
}
