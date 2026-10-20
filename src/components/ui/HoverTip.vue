<script setup>
import { computed, ref, watch } from 'vue'
import { flip, offset, shift, useFloating } from '@floating-ui/vue'
import { hoverTip, tipReference } from '../../utils/hoverTip'

const floatingEl = ref(null)
const open = computed(() => hoverTip.visible)

const { floatingStyles, update } = useFloating(tipReference, floatingEl, {
  strategy: 'fixed',
  placement: 'bottom-start',
  open,
  middleware: [offset(12), flip(), shift({ padding: 8 })]
})

watch(tipReference, () => {
  if (hoverTip.visible) update()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="hoverTip.visible"
      ref="floatingEl"
      class="pointer-events-none max-w-xs px-2.5 py-1.5 rounded-md text-xs leading-relaxed whitespace-pre-line shadow-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
      :style="{ ...floatingStyles, zIndex: 100000 }"
    >
      {{ hoverTip.text }}
    </div>
  </Teleport>
</template>
