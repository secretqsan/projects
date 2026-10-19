<script setup>
import { openUrl } from '@tauri-apps/plugin-opener'
import { Card } from '../ui'

const githubUrl = 'https://github.com/secretqsan'

async function openGithub() {
  try {
    await openUrl(githubUrl)
  } catch {
    window.open(githubUrl, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <Card :title="$t('sponsor.title')" icon="pi pi-heart" icon-class="text-red-500">
    <p class="text-sm text-(--text-secondary) mb-4">
      {{ $t('sponsor.description') }}
    </p>
    <div class="flex flex-wrap gap-3">
      <button
        class="flex items-center gap-2 px-4 py-2 bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-sm font-medium rounded-lg hover:bg-(--bg-secondary) transition-colors"
        @click="openGithub"
      >
        <i class="pi pi-github"></i>
        {{ $t('sponsor.github') }}
      </button>
    </div>
    <div class="mt-4 p-3 bg-(--bg-secondary) rounded-lg">
      <p class="text-xs text-(--text-muted) text-center">
        <i class="pi pi-heart-fill text-red-400 mr-1"></i>
        {{ $t('sponsor.thanks') }}
      </p>
    </div>
  </Card>
</template>
