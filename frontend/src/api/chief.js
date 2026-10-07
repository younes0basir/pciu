import { fetchApi } from '@/api.js'

export function fetchChiefOverview() {
  return fetchApi('/chief/overview')
}

export function fetchChiefTeams() {
  return fetchApi('/chief/teams')
}

export function saveRoomTeam(roomId, payload) {
  return fetchApi(`/chief/rooms/${roomId}/team`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function clearRoomTeam(roomId) {
  return fetchApi(`/chief/rooms/${roomId}/team`, {
    method: 'DELETE',
  })
}
