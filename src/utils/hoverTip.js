import { reactive, shallowRef } from 'vue'
import { useThrottleFn } from '@vueuse/core'

export const hoverTip = reactive({
  visible: false,
  text: ''
})

function rectAt(x, y) {
  return {
    width: 0,
    height: 0,
    x,
    y,
    top: y,
    left: x,
    right: x,
    bottom: y
  }
}

export const tipReference = shallowRef({
  getBoundingClientRect: () => rectAt(0, 0)
})

function place(event) {
  const x = event.clientX
  const y = event.clientY
  tipReference.value = {
    getBoundingClientRect: () => rectAt(x, y),
    contextElement: event.target instanceof Element ? event.target : undefined
  }
}

export function showHoverTip(text, event) {
  const content = String(text ?? '').trim()
  if (!content) {
    hoverTip.visible = false
    return
  }
  hoverTip.text = content
  place(event)
  hoverTip.visible = true
}

export const moveHoverTip = useThrottleFn((event) => {
  if (!hoverTip.visible) return
  place(event)
}, 16)

export function hideHoverTip() {
  hoverTip.visible = false
}
