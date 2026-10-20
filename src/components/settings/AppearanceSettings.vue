<script setup>
import { useConfigStore } from '../../stores/config'
import { Card, Switch } from '../ui'

const config = useConfigStore()
</script>

<template>
  <Card :title="$t('appearance.title')" icon="pi pi-palette" icon-class="text-[var(--accent-color)]">
    <div class="space-y-6">
      <!-- 夜间模式 -->
      <Switch
        :model-value="config.mode === 'dark'"
        :label="$t('appearance.darkMode')"
        :description="$t('appearance.darkModeDesc')"
        @update:model-value="() => config.toggleMode()"
      />

      <!-- 主题色选择 -->
      <div class="pt-4 border-t border-(--border-color)">
        <div class="mb-3">
          <p class="text-sm font-medium text-(--text-primary)">{{ $t('appearance.themeColor') }}</p>
          <p class="text-xs text-(--text-muted) mt-0.5">{{ $t('appearance.themeColorDesc') }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="theme in config.themeColors"
            :key="theme.code"
            class="w-10 h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center"
            :class="[
              config.themeColor === theme.code
                ? 'border-(--text-primary) scale-110'
                : 'border-transparent hover:scale-105'
            ]"
            :style="{ backgroundColor: theme.color }"
            :title="$t(`theme.${theme.code}`)"
            @click="config.setThemeColor(theme.code)"
          >
            <i
              v-if="config.themeColor === theme.code"
              class="pi pi-check text-white text-sm"
            ></i>
          </button>
        </div>
      </div>
    </div>
  </Card>
</template>
