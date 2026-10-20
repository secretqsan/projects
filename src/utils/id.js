import { nanoid } from 'nanoid'

export function createId(prefix) {
  return prefix ? `${prefix}_${nanoid(10)}` : nanoid(10)
}
