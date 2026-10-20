<script setup>
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-(--bg-secondary) p-8">
    <div class="text-center max-w-md">
      <!-- Logo -->
      <img src="/logo.svg" alt="Projects Logo" class="w-20 h-20 mx-auto mb-6" />

      <!-- 标题 -->
      <h1 class="text-2xl font-bold text-(--text-primary) mb-2">
        {{ $t('welcome.title') }}
      </h1>

      <!-- 描述 -->
      <p class="text-(--text-secondary) mb-8">
        {{ $t('welcome.description') }}
      </p>

      <!-- 提示 -->
      <p class="mt-6 text-sm text-(--text-muted)">
        {{ $t('welcome.hint') }}
      </p>
    </div>
  </div>
</template>
