import { appDataDir, basename, dirname, extname, join, resolveResource } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import i18n from '../i18n'
import { createId } from './id'

const t = (key, params) => i18n.global.t(key, params)

export async function selectFileToOpen() {
  const selected = await open({
    title: t('file.openTitle'),
    multiple: false,
    filters: [{ name: t('file.jsonFilter'), extensions: ['json'] }]
  })
  return typeof selected === 'string' ? selected : null
}

export async function selectFileToSave() {
  return await save({
    title: t('file.saveTitle'),
    defaultPath: 'output.json',
    filters: [{ name: t('file.jsonFilter'), extensions: ['json'] }]
  })
}

async function readProjectFile(path) {
  return readTextFile(path)
}

export async function writeProjectFile(path, content) {
  return writeTextFile(path, content)
}

async function copyCandidate(dir, fileName) {
  return dir ? join(dir, fileName) : fileName
}

export async function nextCopyFilePath(originalPath) {
  const [dir, extension] = await Promise.all([
    dirname(originalPath).catch(() => ''),
    extname(originalPath).catch(() => '')
  ])
  const ext = extension ? `.${extension}` : '.json'
  const stem = await basename(originalPath, extension ? ext : undefined)

  let candidate = await copyCandidate(dir, t('file.copy', { stem, ext }))
  let n = 2
  while (await exists(candidate)) {
    candidate = await copyCandidate(dir, t('file.copyN', { stem, n, ext }))
    n += 1
  }
  return candidate
}

function createEmptyProject() {
  return {
    meta: {
      id: createId('project'),
      name: t('project.newName'),
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

const EXAMPLE_RESOURCE = '../demo/example_project.json'

export async function ensureExampleProject() {
  if (!window.__TAURI_INTERNALS__) return null
  try {
    const dir = await appDataDir()
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true })
    }
    const target = await join(dir, 'example_project.json')
    if (!(await exists(target))) {
      const bundled = await resolveResource(EXAMPLE_RESOURCE)
      await writeTextFile(target, await readTextFile(bundled))
    }
    return target
  } catch (error) {
    console.error('准备示例项目失败:', error)
    return null
  }
}

export async function openProject(filename, configStore, projectStore) {
  try {
    let project
    let isNew = false

    if (!(await exists(filename))) {
      project = createEmptyProject()
      await writeProjectFile(filename, JSON.stringify(project, null, 2))
      isNew = true
    } else {
      let content
      try {
        content = await readProjectFile(filename)
      } catch (error) {
        const message = typeof error === 'string' ? error : (error?.message || String(error))
        return { success: false, project: null, isNew: false, error: message }
      }

      try {
        project = JSON.parse(content)
      } catch {
        return { success: false, project: null, isNew: false, error: t('file.invalidJson') }
      }
      if (!isValidProject(project)) {
        return { success: false, project: null, isNew: false, error: t('file.invalidProject') }
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
