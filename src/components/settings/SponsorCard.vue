<script setup>
import { Card } from '../ui'
</script>

<template>
  <Card :title="$t('sponsor.title')" icon="pi pi-heart" icon-class="text-red-500">
    <p class="text-sm text-(--text-secondary) mb-4">
      {{ $t('sponsor.description') }}
    </p>
    <div class="flex flex-wrap gap-3">
      <button class="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-yellow-400 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all shadow-sm">
        <i class="pi pi-bolt"></i>
        {{ $t('sponsor.donate') }}
      </button>
      <button class="flex items-center gap-2 px-4 py-2 bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-sm font-medium rounded-lg hover:bg-(--bg-secondary) transition-colors">
        <i class="pi pi-github"></i>
        {{ $t('sponsor.github') }}
      </button>
      <button class="flex items-center gap-2 px-4 py-2 bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-sm font-medium rounded-lg hover:bg-(--bg-secondary) transition-colors">
        <i class="pi pi-envelope"></i>
        {{ $t('sponsor.contact') }}
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
