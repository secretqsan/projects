<script setup>
import { Card } from '../ui'
import LogoUrl from '../../assets/logo.svg'

defineProps({
  appVersion: {
    type: String,
    default: '1.0.0'
  }
})
</script>

<template>
  <Card :title="$t('about.title')" icon="pi pi-info-circle" icon-class="text-[var(--accent-color)]">
    <div class="flex items-center gap-4">
      <div class="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg overflow-hidden bg-(--bg-card)">
        <img :src="LogoUrl" alt="Logo" class="w-12 h-12" />
      </div>
      <div>
        <h3 class="text-lg font-bold text-(--text-primary)">{{ $t('about.appName') }}</h3>
        <p class="text-sm text-(--text-secondary)">{{ $t('about.version') }} {{ appVersion }}</p>
        <p class="text-xs text-(--text-muted) mt-1">{{ $t('about.description') }}</p>
      </div>
    </div>
    <div class="mt-6 pt-6 border-t border-(--border-color)">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-(--text-secondary)">{{ $t('about.developer') }}</span>
          <p class="text-(--text-primary) font-medium mt-0.5">Your Name</p>
        </div>
        <div>
          <span class="text-(--text-secondary)">{{ $t('about.license') }}</span>
          <p class="text-(--text-primary) font-medium mt-0.5">LGPL</p>
        </div>
      </div>
    </div>
  </Card>
</template>
