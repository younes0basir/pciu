import { fetchApi } from '@/api.js'

export function fetchClinicianWorkspace() {
  return fetchApi('/clinician/workspace')
}
