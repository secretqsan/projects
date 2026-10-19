<script setup>
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-(--bg-secondary) p-8">
    <div class="text-center max-w-md">
      <!-- Logo -->
      <div class="mb-6">
        <div class="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
          <img src="/logo.svg" alt="Projects Logo" class="w-full h-full" />
        </div>
      </div>

      <!-- 标题 -->
      <h1 class="text-2xl font-bold text-(--text-primary) mb-2">
        欢迎使用 Projects
      </h1>

      <!-- 描述 -->
      <p class="text-(--text-secondary) mb-8">
        开始管理您的项目，让工作更高效
      </p>

      <!-- 提示 -->
      <p class="mt-6 text-sm text-(--text-muted)">
        从左侧菜单开始
      </p>
    </div>
  </div>
</template>
