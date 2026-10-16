import { fetchApi } from '@/api.js'

export function fetchDatabaseSnapshot() {
  return fetchApi('/admin/database')
}

export function resetDatabase(payload) {
  return fetchApi('/admin/database/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
