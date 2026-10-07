import { fetchApi } from '@/api.js'

export async function fetchUserStats() {
  const data = await fetchApi('/users/stats')
  return data.stats
}

export async function fetchUsers() {
  const data = await fetchApi('/users')
  return data.users || []
}

export async function createStaffUser({ firstName, lastName, email, role }) {
  const data = await fetchApi('/users', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, email, role }),
  })
  return data
}

export async function updateStaffUser(id, updateData) {
  const data = await fetchApi(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  })
  return data.user
}

export async function generateStaffTempToken(id) {
  return await fetchApi(`/users/${id}/temp-token`, {
    method: 'POST',
  })
}

export async function deleteStaffUser(id) {
  return await fetchApi(`/users/${id}`, {
    method: 'DELETE',
  })
}
