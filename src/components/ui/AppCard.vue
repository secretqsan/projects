<script setup>
const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  iconClass: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="bg-(--bg-card) rounded-lg border border-(--border-color) overflow-hidden shadow-sm">
    <div v-if="title" class="px-6 py-4 border-b border-(--border-color)">
      <h2 class="text-base font-semibold text-(--text-primary) flex items-center gap-2">
        <i v-if="props.icon" :class="[props.icon, props.iconClass || 'text-(--accent-color)']" />
        {{ props.title }}
      </h2>
    </div>
    <div class="p-6">
      <slot />
    </div>
  </div>
</template>
