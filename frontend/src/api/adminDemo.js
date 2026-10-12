import { fetchApi } from '@/api.js'

export function fetchDemoArrivals() {
  return fetchApi('/admin/demo-arrivals')
}

export function createDemoArrivals() {
  return fetchApi('/admin/demo-arrivals', { method: 'POST' })
}

export function deleteDemoArrivals() {
  return fetchApi('/admin/demo-arrivals', { method: 'DELETE' })
}
