<script setup>
import { useConfigStore } from '../../stores/config'
import { setI18nLanguage } from '../../i18n'
import { Card, Dropdown } from '../ui'

const config = useConfigStore()

function handleLanguageChange(langCode) {
  config.setLanguage(langCode)
  setI18nLanguage(langCode)
}
</script>

<template>
  <Card
    class="relative z-10"
    overflow-visible
    :title="$t('language.title')"
    icon="pi pi-globe"
    icon-class="text-[var(--accent-color)]"
  >
    <div class="space-y-3">
      <p class="text-sm text-(--text-secondary)">{{ $t('language.description') }}</p>

      <Dropdown
        v-model="config.language"
        :options="config.languages"
        :placeholder="$t('language.placeholder')"
        option-key="code"
        option-label="name"
        option-icon="flag"
        @change="handleLanguageChange"
      />
    </div>
  </Card>
</template>
