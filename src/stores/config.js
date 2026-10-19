import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useConfigStore = defineStore('config', () => {
  const mode = ref('light')
  const language = ref('zh')
  const themeColor = ref('blue')
  const history = ref([])

  const languages = [
    { code: 'zh', name: '简体中文', flag: '🇨🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' }
  ]

  const themeColors = [
    { code: 'blue', name: '蓝色', color: '#3B82F6', hoverColor: '#2563EB' },
    { code: 'purple', name: '紫色', color: '#8B5CF6', hoverColor: '#7C3AED' },
    { code: 'green', name: '绿色', color: '#10B981', hoverColor: '#059669' },
    { code: 'orange', name: '橙色', color: '#F59E0B', hoverColor: '#D97706' },
    { code: 'red', name: '红色', color: '#EF4444', hoverColor: '#DC2626' },
    { code: 'pink', name: '粉色', color: '#EC4899', hoverColor: '#DB2777' }
  ]

  // 应用主题色到 CSS 变量
  function applyThemeColor(colorCode) {
    const theme = themeColors.find(t => t.code === colorCode)
    if (theme) {
      document.documentElement.style.setProperty('--accent-color', theme.color)
      document.documentElement.style.setProperty('--accent-hover', theme.hoverColor)
    }
  }

  watch(themeColor, applyThemeColor, { immediate: true })

  function toggleMode() {
    mode.value = mode.value === 'light' ? 'dark' : 'light'
  }

  function setLanguage(langCode) {
    language.value = langCode
  }

  function setThemeColor(colorCode) {
    themeColor.value = colorCode
  }

  // 添加文件名到 history（去重，添加到开头）
  function addToHistory(filename) {
    const index = history.value.indexOf(filename)
    if (index > -1) {
      history.value.splice(index, 1)
    }
    history.value.unshift(filename)
  }

  function removeFromHistory(filename) {
    const index = history.value.indexOf(filename)
    if (index > -1) {
      history.value.splice(index, 1)
    }
  }

  return {
    mode,
    language,
    themeColor,
    languages,
    themeColors,
    history,
    toggleMode,
    setLanguage,
    setThemeColor,
    addToHistory,
    removeFromHistory
  }
}, {
  persist: true
})
