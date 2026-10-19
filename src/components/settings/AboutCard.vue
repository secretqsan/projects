<script setup>
import { Card } from '../ui'
import LogoUrl from '../../assets/logo.svg'

defineProps({
  appVersion: {
    type: String,
    default: '0.1.0'
  }
})

const githubUrl = 'https://github.com/secretqsan'
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
          <p class="text-(--text-primary) font-medium mt-0.5">{{ $t('about.developerName') }}</p>
        </div>
        <div>
          <span class="text-(--text-secondary)">{{ $t('about.license') }}</span>
          <p class="text-(--text-primary) font-medium mt-0.5">{{ $t('about.licenseName') }}</p>
        </div>
        <div>
          <span class="text-(--text-secondary)">{{ $t('about.homepage') }}</span>
          <a
            :href="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="block mt-0.5 text-(--accent-color) font-medium hover:underline"
          >
            github.com/secretqsan
          </a>
        </div>
        <div>
          <span class="text-(--text-secondary)">{{ $t('about.techStack') }}</span>
          <p class="text-(--text-primary) font-medium mt-0.5 text-xs leading-5">
            {{ $t('about.techStackValue') }}
          </p>
        </div>
      </div>
    </div>
  </Card>
</template>
