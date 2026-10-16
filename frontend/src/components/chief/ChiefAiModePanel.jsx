import { useCallback, useEffect, useState } from 'react'
import { Bot, Loader2, Power, Shield, Sparkles } from 'lucide-react'

import { fetchAiSettings, patchAiSettings, requestCapacityAnalyze } from '@/api/ai.js'
import { ChiefDashboardSection } from '@/components/chief/ChiefDashboardSection.jsx'

const MODE_OPTIONS = [
  { value: 'collaborative', label: 'Collaboratif (suggestions)' },
  { value: 'supervised_autonomy', label: 'Autonomie supervisée' },
  { value: 'full_control_simulation', label: 'Simulation (démo)' },
]

const MODE_RANK = {
  collaborative: 1,
  supervised_autonomy: 2,
  full_control_simulation: 3,
}

function modesUpToCeiling(ceiling) {
  if (!ceiling || ceiling === 'disabled') {
    return [MODE_OPTIONS[0]]
  }
  const cap = MODE_RANK[ceiling] ?? 1
  const list = MODE_OPTIONS.filter((opt) => (MODE_RANK[opt.value] ?? 0) <= cap)
  return list.length > 0 ? list : [MODE_OPTIONS[0]]
}

function normalizeModeValue(mode) {
  if (!mode || mode === 'disabled') return 'collaborative'
  return mode
}

const AGENT_TOGGLES = [
  { key: 'documentation', label: 'Documentation' },
  { key: 'triage', label: 'Triage (UI)' },
  { key: 'triageShadow', label: 'Triage shadow' },
  { key: 'bedFlow', label: 'Routage lits' },
  { key: 'capacity', label: 'Charge (chef)' },
]

export function ChiefAiModePanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [capacitySummary, setCapacitySummary] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAiSettings()
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les réglages IA.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function savePatch(payload) {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = await patchAiSettings(payload)
      setSettings(data)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const infraBlocked = settings != null && !settings.platformEnabled
  const serviceOn = Boolean(settings?.serviceEnabled)
  const effectiveMode = settings?.effectiveMode ?? 'disabled'
  const modeValue = normalizeModeValue(settings?.requestedMode)
  const modeChoices = modesUpToCeiling(settings?.envMaxMode)
  const canEdit = Boolean(settings) && !infraBlocked && !saving

  return (
    <div className="space-y-6">
      <ChiefDashboardSection
        id="chief-ai-overview"
        title="Pilotage du mode IA"
        description="Activation et mode du service d’urgences — enregistrés en base (sans redémarrage serveur)."
      >
        {loading ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Chargement…
          </p>
        ) : null}

        {infraBlocked ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
            {settings?.platformKillSwitch
              ? 'Coupure ops active (AI_OPS_KILL_SWITCH). Contactez l’administrateur plateforme.'
              : 'Infrastructure IA indisponible — configurez NVIDIA_API_KEY sur le serveur ou activez AI_CHIEF_CAN_ENABLE.'}
          </div>
        ) : null}

        {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
        {saved ? <p className="text-sm font-semibold text-emerald-700">Réglages enregistrés.</p> : null}

        {settings && !infraBlocked ? (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex items-start gap-3">
                <Power className="mt-0.5 size-5 text-violet-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-extrabold text-violet-950">Assistance IA sur le service</p>
                  <p className="mt-0.5 text-xs font-semibold text-violet-900/80">
                    Interrupteur principal pour tout le plateau d’urgences.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => savePatch({ serviceEnabled: !serviceOn })}
                className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                  serviceOn
                    ? 'bg-violet-700 text-white hover:bg-violet-800'
                    : 'border border-violet-300 bg-white text-violet-900 hover:bg-violet-100'
                } disabled:opacity-60`}
              >
                {saving ? '…' : serviceOn ? 'Activée — cliquer pour arrêter' : 'Arrêtée — cliquer pour activer'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-extrabold text-slate-600" htmlFor="chief-ai-mode">
                Mode du service
              </label>
              <select
                id="chief-ai-mode"
                disabled={!canEdit}
                value={modeValue}
                onChange={(e) => savePatch({ mode: e.target.value, serviceEnabled: true })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-60"
              >
                {modeChoices.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-violet-800">
                Effectif : {effectiveMode}
              </span>
              <span className="text-[10px] font-bold text-slate-500">Plafond infra : {settings.envMaxMode}</span>
            </div>
          </div>
        ) : null}
      </ChiefDashboardSection>

      <ChiefDashboardSection
        id="chief-ai-agents"
        title="Agents par périmètre"
        description="Activez les suggestions par domaine (aucune écriture clinique automatique en mode collaboratif)."
      >
        <ul className="grid gap-3 lg:grid-cols-2">
          {AGENT_TOGGLES.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4"
            >
              <p className="text-sm font-extrabold text-slate-900">{item.label}</p>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={Boolean(settings?.agentFlags?.[item.key])}
                  onChange={(e) =>
                    savePatch({
                      serviceEnabled: true,
                      agentFlags: { [item.key]: e.target.checked },
                    })
                  }
                  className="size-4 rounded border-slate-300"
                />
                <span className="text-xs font-bold text-slate-500">Activé</span>
              </label>
            </li>
          ))}
        </ul>
        {!serviceOn && canEdit ? (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Cocher un agent active automatiquement l’assistance IA sur le service.
          </p>
        ) : null}
      </ChiefDashboardSection>

      <ChiefDashboardSection
        id="chief-ai-capacity"
        title="Signaux charge (IA)"
        description="Synthèse opérationnelle — sans modification des priorités cliniques."
      >
        <button
          type="button"
          disabled={!canEdit || !settings?.agentFlags?.capacity || effectiveMode === 'disabled'}
          onClick={async () => {
            setSaving(true)
            setError(null)
            try {
              const result = await requestCapacityAnalyze()
              setCapacitySummary(result.output)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Analyse indisponible.')
            } finally {
              setSaving(false)
            }
          }}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
        >
          Lancer l’analyse
        </button>
        {capacitySummary ? (
          <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-700">{capacitySummary.summary}</p>
        ) : null}
      </ChiefDashboardSection>

      <ChiefDashboardSection
        id="chief-ai-governance"
        title="Gouvernance & traçabilité"
        description="Principes appliqués par le Action Gateway backend."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <Shield className="size-5 text-emerald-700" aria-hidden="true" />
            <p className="mt-2 text-sm font-extrabold text-emerald-950">Validation humaine</p>
            <p className="mt-1 text-xs font-semibold text-emerald-900/80">
              Propositions dans agent_recommendations ; triage via recordTriage.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
            <Bot className="size-5 text-sky-700" aria-hidden="true" />
            <p className="mt-2 text-sm font-extrabold text-sky-950">Journal des agents</p>
            <p className="mt-1 text-xs font-semibold text-sky-900/80">Runs et recommandations persistés (agent_runs).</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <Sparkles className="size-5 text-violet-700" aria-hidden="true" />
            <p className="mt-2 text-sm font-extrabold text-violet-950">Mode service</p>
            <p className="mt-1 text-xs font-semibold text-violet-900/80">
              Réglages persistés pour tout le service — modifiables ici en temps réel.
            </p>
          </div>
        </div>
      </ChiefDashboardSection>
    </div>
  )
}
