import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Users,
  Stethoscope,
  HeartPulse,
  ClipboardList,
  Award,
  KeyRound,
  Edit3,
  Trash2,
  Download,
  Activity,
  Database,
  ChevronRight,
  Link2,
  Check,
  Clock,
} from 'lucide-react'

import { getHomeRouteForRole, getStoredAuth, logout } from '@/api/auth.js'
import { RoleDashboardHeader, RolePrimaryButton } from '@/components/layout/RoleDashboardHeader.jsx'
import { DashboardShell } from '@/components/layout/DashboardShell.jsx'
import { checkBackendHealth } from '@/api.js'
import {
  fetchUserStats,
  fetchUsers,
  createStaffUser,
  updateStaffUser,
  generateStaffTempToken,
  deleteStaffUser,
} from '@/api/adminUsers.js'

import { RoleBadge } from '@/components/admin/RoleBadge.jsx'
import { ROLE_CONFIG } from '@/components/admin/roleConfig.js'
import { CreateUserModal } from '@/components/admin/CreateUserModal.jsx'
import { EditUserModal } from '@/components/admin/EditUserModal.jsx'
import { ResetPasswordModal } from '@/components/admin/ResetPasswordModal.jsx'
import { DeleteUserModal } from '@/components/admin/DeleteUserModal.jsx'
import { Toast } from '@/components/admin/Toast.jsx'

export default function AdminPage() {
  const navigate = useNavigate()
  const auth = getStoredAuth()
  const currentUserId = auth?.user?.id

  // Data states
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [backendHealth, setBackendHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'pending' | 'inactive'

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [resettingUser, setResettingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)

  // Toast state
  const [toast, setToast] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const showToast = useCallback((type, title, message) => {
    setToast({ type, title, message })
  }, [])

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [usersData, statsData, healthData] = await Promise.all([
        fetchUsers(),
        fetchUserStats().catch(() => null),
        checkBackendHealth().catch(() => ({ status: 'down' })),
      ])

      setUsers(usersData)
      setStats(statsData)
      setBackendHealth(healthData)
    } catch (err) {
      showToast('error', 'Erreur de chargement', err instanceof Error ? err.message : 'Impossible de récupérer les données.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showToast])

  // Check auth on mount
  useEffect(() => {
    if (!auth || !auth.token) {
      navigate('/login')
      return
    }
    if (auth.user?.role !== 'admin') {
      navigate(getHomeRouteForRole(auth.user?.role))
      return
    }
    loadData()
  }, [auth?.token, auth?.user?.role, navigate, loadData])

  // Handlers for CRUD
  async function handleCreateUser(formData) {
    const response = await createStaffUser(formData)
    const newUser = response.user
    setUsers((prev) => [newUser, ...prev])
    showToast('success', 'Collaborateur créé', `Jeton d’activation généré pour ${newUser.fullName}.`)
    fetchUserStats().then(setStats).catch(() => {})
    return response
  }

  async function handleUpdateUser(id, updateData) {
    const updated = await updateStaffUser(id, updateData)
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)))
    showToast('success', 'Compte mis à jour', `Les modifications pour ${updated.fullName} ont été enregistrées.`)
    fetchUserStats().then(setStats).catch(() => {})
  }

  async function handleToggleStatus(user) {
    const newStatus = !user.isActive
    try {
      await updateStaffUser(user.id, { isActive: newStatus })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: newStatus } : u)))
      showToast(
        'success',
        newStatus ? 'Compte activé' : 'Compte désactivé',
        `Le compte de ${user.fullName} est maintenant ${newStatus ? 'actif' : 'suspendu'}.`
      )
      fetchUserStats().then(setStats).catch(() => {})
    } catch (err) {
      showToast('error', 'Erreur', err instanceof Error ? err.message : 'Échec du changement de statut.')
    }
  }

  async function handleGenerateTempToken(id) {
    const res = await generateStaffTempToken(id)
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, mustChangePassword: true, tempToken: res.tempToken } : u))
    )
    showToast('success', 'Jeton d’accès généré', res.message)
    fetchUserStats().then(setStats).catch(() => {})
    return res
  }

  async function handleDeleteUser(id) {
    const result = await deleteStaffUser(id)
    if (result.action === 'deactivated') {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: false } : u)))
      showToast('info', 'Compte désactivé', result.message)
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== id))
      showToast('success', 'Compte supprimé', result.message || 'Le compte a été définitivement supprimé.')
    }
    fetchUserStats().then(setStats).catch(() => {})
  }

  async function handleCopyActivationLink(u) {
    const token = u.tempToken
    if (!token) {
      // If token not on user object, generate one
      try {
        const res = await generateStaffTempToken(u.id)
        const link = `${window.location.origin}/setup-password?token=${res.tempToken}`
        await navigator.clipboard.writeText(link)
        setCopiedId(u.id)
        setTimeout(() => setCopiedId(null), 2500)
        showToast('success', 'Lien copié', `Lien d'activation copié pour ${u.fullName}.`)
      } catch {
        showToast('error', 'Erreur', 'Impossible de copier le lien.')
      }
      return
    }

    const link = `${window.location.origin}/setup-password?token=${token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(u.id)
      setTimeout(() => setCopiedId(null), 2500)
      showToast('success', 'Lien copié', `Lien d'activation copié pour ${u.fullName}.`)
    } catch {
      showToast('error', 'Erreur', 'Impossible de copier le lien.')
    }
  }

  function handleExportCsv() {
    if (filteredUsers.length === 0) return
    const headers = ['ID', 'Nom', 'Prénom', 'Email', 'Rôle', 'Statut', 'Mot de passe configuré', 'Date Création']
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.lastName || ''}"`,
      `"${u.firstName || ''}"`,
      `"${u.email}"`,
      `"${ROLE_CONFIG[u.role]?.label || u.role}"`,
      u.isActive ? 'Actif' : 'Inactif',
      u.mustChangePassword ? 'En attente' : 'Configuré',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `picu_personnel.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('info', 'Export CSV', `${filteredUsers.length} comptes exportés avec succès.`)
  }

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (selectedRole !== 'all' && u.role !== selectedRole) return false

      // Status filter
      if (statusFilter === 'active' && (!u.isActive || u.mustChangePassword)) return false
      if (statusFilter === 'pending' && !u.mustChangePassword) return false
      if (statusFilter === 'inactive' && u.isActive) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase()
        const email = (u.email || '').toLowerCase()
        const role = (ROLE_CONFIG[u.role]?.label || u.role || '').toLowerCase()
        if (!fullName.includes(q) && !email.includes(q) && !role.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [users, selectedRole, statusFilter, searchQuery])

  // Counts for pills
  const counts = useMemo(() => {
    return {
      total: stats?.totalUsers ?? users.length,
      active: users.filter((u) => u.isActive && !u.mustChangePassword).length,
      pending: users.filter((u) => u.mustChangePassword).length,
      inactive: stats?.inactiveUsers ?? users.filter((u) => !u.isActive).length,
      doctor: stats?.roles?.doctor ?? users.filter((u) => u.role === 'doctor').length,
      nurse: stats?.roles?.nurse ?? users.filter((u) => u.role === 'nurse').length,
      receptionist: stats?.roles?.receptionist ?? users.filter((u) => u.role === 'receptionist').length,
      chief: stats?.roles?.chief ?? users.filter((u) => u.role === 'chief').length,
      admin: stats?.roles?.admin ?? users.filter((u) => u.role === 'admin').length,
    }
  }, [users, stats])

  return (
    <DashboardShell role="admin">
      <RoleDashboardHeader
        role="admin"
        badgeLabel="Admin Console"
        subtitle="Plateforme Intelligente de Coordination des Urgences"
        maxWidthClass="max-w-7xl"
        backendHealth={backendHealth}
        refreshing={refreshing}
        onRefresh={() => loadData(true)}
        user={auth?.user}
        onLogout={() => {
          logout()
          navigate('/login')
        }}
        trailing={
          <Link
            to="/board"
            className="hidden items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50/60 px-4 py-2 text-xs font-extrabold text-purple-800 shadow-2xs transition hover:bg-purple-100 sm:inline-flex"
          >
            <Activity className="size-4 animate-pulse text-purple-600" />
            <span>Tableau des Urgences</span>
            <ChevronRight className="size-3.5" />
          </Link>
        }
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* Title & Fast Actions Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Gestion du Personnel & Comptes
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Création par jetons temporaires, activation autonome par mot de passe et contrôle des accès.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <Download className="size-4 text-slate-500" />
              Exporter CSV
            </button>

            <RolePrimaryButton
              role="admin"
              onClick={() => setCreateModalOpen(true)}
              className="cursor-pointer px-5 py-2.5 text-xs"
            >
              <UserPlus className="size-4" />
              Nouveau Collaborateur (Jeton)
            </RolePrimaryButton>
          </div>
        </div>

        {/* Executive KPI Stats Cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {/* Total Staff */}
          <div
            onClick={() => {
              setSelectedRole('all')
              setStatusFilter('all')
            }}
            className="cursor-pointer rounded-3xl border border-sky-100 bg-white p-4 shadow-sm hover:border-sky-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Personnel</span>
              <div className="rounded-xl bg-sky-50 p-2 text-sky-600 group-hover:scale-110 transition">
                <Users className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{counts.total}</p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500"></span>
              {counts.active} configurés
            </p>
          </div>

          {/* Médecins */}
          <div
            onClick={() => setSelectedRole(selectedRole === 'doctor' ? 'all' : 'doctor')}
            className={`cursor-pointer rounded-3xl border p-4 shadow-sm transition-all group ${
              selectedRole === 'doctor'
                ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-400/20 shadow-md'
                : 'border-slate-100 bg-white hover:border-emerald-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Médecins</span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 group-hover:scale-110 transition">
                <Stethoscope className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-emerald-700">{counts.doctor}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Consultation & Soins</p>
          </div>

          {/* Infirmiers */}
          <div
            onClick={() => setSelectedRole(selectedRole === 'nurse' ? 'all' : 'nurse')}
            className={`cursor-pointer rounded-3xl border p-4 shadow-sm transition-all group ${
              selectedRole === 'nurse'
                ? 'border-sky-400 bg-sky-50/40 ring-2 ring-sky-400/20 shadow-md'
                : 'border-slate-100 bg-white hover:border-sky-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Infirmiers</span>
              <div className="rounded-xl bg-sky-50 p-2 text-sky-600 group-hover:scale-110 transition">
                <HeartPulse className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-sky-700">{counts.nurse}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Placement & Triage</p>
          </div>

          {/* Accueil */}
          <div
            onClick={() => setSelectedRole(selectedRole === 'receptionist' ? 'all' : 'receptionist')}
            className={`cursor-pointer rounded-3xl border p-4 shadow-sm transition-all group ${
              selectedRole === 'receptionist'
                ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-400/20 shadow-md'
                : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Accueil</span>
              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 group-hover:scale-110 transition">
                <ClipboardList className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-indigo-700">{counts.receptionist}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Entrées & Appel</p>
          </div>

          {/* Chefs de Service */}
          <div
            onClick={() => setSelectedRole(selectedRole === 'chief' ? 'all' : 'chief')}
            className={`cursor-pointer rounded-3xl border p-4 shadow-sm transition-all group ${
              selectedRole === 'chief'
                ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20 shadow-md'
                : 'border-slate-100 bg-white hover:border-amber-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chefs</span>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600 group-hover:scale-110 transition">
                <Award className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-amber-700">{counts.chief}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Supervision Globale</p>
          </div>

          {/* System Health Status */}
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Système & Base</span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <Database className="size-4" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`size-2 rounded-full ${
                  backendHealth?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              ></span>
              <span className="text-sm font-extrabold text-slate-800">
                {backendHealth?.status === 'ok' ? 'Neon Connecté' : 'Vérification'}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Sécurité Jetons Active</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="rounded-3xl border border-sky-100 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, prénom, email ou rôle…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/50 p-1 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tous ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === 'active' ? 'bg-emerald-500 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Actifs ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                En attente ({counts.pending})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === 'inactive' ? 'bg-rose-500 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Inactifs ({counts.inactive})
              </button>
            </div>
          </div>

          {/* Role Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="font-bold text-slate-400 flex items-center gap-1 pr-1 shrink-0">
              <Filter className="size-3" /> Rôles :
            </span>

            <button
              type="button"
              onClick={() => setSelectedRole('all')}
              className={`rounded-xl px-3 py-1.5 font-bold transition shrink-0 ${
                selectedRole === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous ({counts.total})
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('doctor')}
              className={`rounded-xl px-3 py-1.5 font-bold transition shrink-0 ${
                selectedRole === 'doctor'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Médecins ({counts.doctor})
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('nurse')}
              className={`rounded-xl px-3 py-1.5 font-bold transition shrink-0 ${
                selectedRole === 'nurse'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
              }`}
            >
              Infirmiers ({counts.nurse})
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('receptionist')}
              className={`rounded-xl px-3 py-1.5 font-bold transition shrink-0 ${
                selectedRole === 'receptionist'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              Accueil ({counts.receptionist})
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('chief')}
              className={`rounded-xl px-3 py-1.5 font-bold transition shrink-0 ${
                selectedRole === 'chief'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              Chefs ({counts.chief})
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={`rounded-xl px-3 py-1.5 font-bold transition shrink-0 ${
                selectedRole === 'admin'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              Admins ({counts.admin})
            </button>
          </div>
        </div>

        {/* Users Data Table */}
        <div className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <RefreshCw className="size-5 animate-spin" />
              </div>
              <p className="text-xs font-bold text-slate-500">Chargement des comptes collaborateurs…</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Users className="size-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">Aucun collaborateur trouvé</h3>
              <p className="text-xs font-semibold text-slate-500 max-w-sm mx-auto">
                Aucun compte ne correspond à vos critères de recherche actuels.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedRole('all')
                  setStatusFilter('all')
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 pl-6 pr-4">Personnel & Praticien</th>
                    <th className="py-3.5 px-4">Rôle Métier</th>
                    <th className="py-3.5 px-4 hidden lg:table-cell">Activation / Mot de Passe</th>
                    <th className="py-3.5 px-4">Statut</th>
                    <th className="py-3.5 px-4 hidden md:table-cell">Créé le</th>
                    <th className="py-3.5 pr-6 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredUsers.map((u) => {
                    const isSelf = String(u.id) === String(currentUserId)
                    const roleConf = ROLE_CONFIG[u.role] || {
                      label: u.role,
                      avatarBg: 'from-slate-400 to-slate-600',
                      capabilities: [],
                    }
                    const initials =
                      (u.firstName?.[0] || '').toUpperCase() + (u.lastName?.[0] || '').toUpperCase() || 'U'

                    return (
                      <tr key={u.id} className="hover:bg-sky-50/30 transition-colors group">
                        {/* Name and Email */}
                        <td className="py-3.5 pl-6 pr-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${roleConf.avatarBg} text-white font-extrabold text-xs shadow-xs`}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900">
                                  {u.fullName || `${u.firstName} ${u.lastName}`}
                                </span>
                                {isSelf && (
                                  <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-700">
                                    Vous
                                  </span>
                                )}
                              </div>
                              <span className="font-semibold text-slate-500 text-[11px]">{u.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          <RoleBadge role={u.role} />
                        </td>

                        {/* Password / Activation Status */}
                        <td className="py-3.5 px-4 hidden lg:table-cell">
                          {u.mustChangePassword ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                <Clock className="size-3 text-amber-600" />
                                En attente d'activation
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyActivationLink(u)}
                                title="Copier le lien d'invitation avec le jeton"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline"
                              >
                                {copiedId === u.id ? (
                                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                                    <Check className="size-3" /> Copié
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Link2 className="size-3" /> Copier lien
                                  </span>
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                              <Check className="size-3" />
                              Mot de passe actif
                            </span>
                          )}
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf || u.role === 'admin'}
                            title={
                              isSelf || u.role === 'admin'
                                ? 'Compte administrateur verrouillé'
                                : u.isActive
                                ? 'Cliquer pour désactiver'
                                : 'Cliquer pour activer'
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border transition ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                u.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`}
                            />
                            {u.isActive ? 'Actif' : 'Désactivé'}
                          </button>
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-4 hidden md:table-cell text-slate-500 font-semibold text-[11px]">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 pr-6 pl-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Generate Temp Token (Access Reset) */}
                            <button
                              type="button"
                              onClick={() => setResettingUser(u)}
                              title="Générer un jeton temporaire d'accès"
                              className="rounded-xl p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
                            >
                              <KeyRound className="size-4" />
                            </button>

                            {/* Edit Profile */}
                            <button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              title="Modifier les informations"
                              className="rounded-xl p-2 text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition"
                            >
                              <Edit3 className="size-4" />
                            </button>

                            {/* Delete User */}
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              disabled={isSelf || u.role === 'admin'}
                              title={
                                isSelf || u.role === 'admin'
                                  ? 'Suppression non autorisée'
                                  : 'Supprimer ce collaborateur'
                              }
                              className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreateUser}
      />

      <EditUserModal
        isOpen={Boolean(editingUser)}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onUpdated={handleUpdateUser}
      />

      <ResetPasswordModal
        isOpen={Boolean(resettingUser)}
        user={resettingUser}
        onClose={() => setResettingUser(null)}
        onGenerateTempToken={handleGenerateTempToken}
      />

      <DeleteUserModal
        isOpen={Boolean(deletingUser)}
        user={deletingUser}
        currentUserId={currentUserId}
        onClose={() => setDeletingUser(null)}
        onDelete={handleDeleteUser}
      />

      {/* Toast notifications */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </DashboardShell>
  )
}
