<script setup>
import AppearanceSettings from './settings/AppearanceSettings.vue'
import LanguageSettings from './settings/LanguageSettings.vue'
import AboutCard from './settings/AboutCard.vue'
import SponsorCard from './settings/SponsorCard.vue'

const appVersion = '0.1.0'
</script>

<template>
  <div class="flex-1 overflow-auto p-8 bg-(--bg-secondary)">
    <div class="max-w-2xl mx-auto space-y-6">
      <!-- 页面标题 -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-(--text-primary)">{{ $t('settings.title') }}</h1>
        <p class="text-sm text-(--text-secondary) mt-1">{{ $t('settings.subtitle') }}</p>
      </div>

      <!-- 外观设置 -->
      <AppearanceSettings />

      <!-- 语言设置 -->
      <LanguageSettings />

      <!-- 关于 -->
      <AboutCard :app-version="appVersion" />

      <!-- 赞助 -->
      <SponsorCard />

      <!-- 版权信息 -->
      <div class="text-center text-xs text-(--text-muted) pt-4">
        <p>{{ $t('copyright') }}</p>
      </div>
    </div>
  </div>
</template>
