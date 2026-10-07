import { fetchApi } from '@/api.js'

export function fetchBoard() {
  return fetchApi('/board')
}
