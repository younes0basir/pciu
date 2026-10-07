import { useEffect, useState } from 'react'
import { Loader2, Stethoscope } from 'lucide-react'

import { clinicianLabel } from '@/components/chief/chiefUtils.js'

const MODE_COPY = {
  chief: {
    subtitle: 'Vous pouvez la rédiger en votre nom ou au nom de n’importe quel médecin.',
    doctorRequired: 'Choisissez le médecin au nom duquel la note est rédigée.',
  },
  doctor: {
    subtitle: 'Consultation en votre nom de médecin responsable.',
    doctorRequired: null,
  },
  nurse: {
    subtitle:
      'Vous pouvez compléter ou clôturer la consultation au nom du médecin de la salle s’il est indisponible.',
    doctorRequired: 'Le médecin responsable de la salle doit être défini par le chef de service.',
  },
}

export function ChiefConsultationPanel({
  detail,
  clinicians,
  suggestedDoctorId,
  currentUserId,
  roomTeam,
  actionBusy,
  consultationMode = 'chief',
  onOpen,
  onSave,
}) {
  const [doctorId, setDoctorId] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState(null)

  const consultation = detail?.consultation
  const isOpen = detail?.status === 'in_treatment'
  const modeCopy = MODE_COPY[consultationMode] ?? MODE_COPY.chief
  const lockDoctor =
    consultationMode === 'doctor'
      ? String(currentUserId || '')
      : consultationMode === 'nurse'
        ? String(suggestedDoctorId || consultation?.doctorId || '')
        : null

  useEffect(() => {
    const existingDoctor = consultation?.doctorId
    let nextDoctor = existingDoctor || suggestedDoctorId || currentUserId || ''
    if (consultationMode === 'doctor') {
      nextDoctor = currentUserId || existingDoctor
    } else if (consultationMode === 'nurse') {
      nextDoctor = suggestedDoctorId || existingDoctor
    }
    setDoctorId(nextDoctor ? String(nextDoctor) : '')
    setDiagnosis(consultation?.diagnosis || '')
    setNotes(consultation?.notes || '')
    setLocalError(null)
  }, [
    detail?.visitId,
    consultation?.id,
    consultation?.doctorId,
    consultation?.diagnosis,
    consultation?.notes,
    suggestedDoctorId,
    currentUserId,
    consultationMode,
  ])

  const knownIds = new Set((clinicians || []).map((person) => String(person.id)))
  const missingDoctor =
    consultation?.doctorId && !knownIds.has(String(consultation.doctorId))
      ? consultation
      : null

  const writtenForSomeoneElse =
    consultation?.recordedById &&
    consultation?.doctorId &&
    String(consultation.recordedById) !== String(consultation.doctorId)

  async function submit(event) {
    event.preventDefault()
    setLocalError(null)
    const effectiveDoctorId = lockDoctor || doctorId
    if (!effectiveDoctorId) {
      setLocalError(modeCopy.doctorRequired || 'Médecin requis.')
      return
    }
    const payload = {
      doctorId: Number(effectiveDoctorId),
      diagnosis: diagnosis.trim(),
      notes: notes.trim(),
    }
    try {
      if (isOpen) await onSave(payload)
      else await onOpen(payload)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-4 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
          <Stethoscope className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Consultation médicale</h3>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">{modeCopy.subtitle}</p>
        </div>
      </div>

      {roomTeam?.doctor ? (
        <p className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-amber-100">
          Salle en charge : {roomTeam.name}
          {' · '}
          {clinicianLabel(roomTeam.doctor)}
          {roomTeam.nurses?.length
            ? ` · ${roomTeam.nurses.map((nurse) => `${nurse.firstName} ${nurse.lastName}`).join(', ')}`
            : ''}
        </p>
      ) : null}

      {writtenForSomeoneElse ? (
        <p className="mt-3 text-xs font-semibold text-amber-900">
          {`Dernière rédaction par ${consultation.recordedByName} pour ${consultation.doctorName}.`}
        </p>
      ) : null}

      {consultationMode === 'chief' ? (
        <>
          <label className="mt-4 block text-xs font-extrabold text-slate-700" htmlFor="consult-doctor">
            Au nom de
          </label>
          <select
            id="consult-doctor"
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          >
            <option value="">Choisir un médecin</option>
            {missingDoctor ? (
              <option value={String(missingDoctor.doctorId)}>{missingDoctor.doctorName}</option>
            ) : null}
            {(clinicians || []).map((person) => (
              <option key={person.id} value={String(person.id)}>
                {clinicianLabel(person)}
                {String(person.id) === String(currentUserId) ? ' (vous)' : ''}
                {person.assignedRoomName ? ` — ${person.assignedRoomName}` : ''}
              </option>
            ))}
          </select>
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 ring-1 ring-amber-100">
          Au nom de{' '}
          {lockDoctor && (clinicians || []).find((p) => String(p.id) === lockDoctor)
            ? clinicianLabel((clinicians || []).find((p) => String(p.id) === lockDoctor))
            : roomTeam?.doctor
              ? clinicianLabel(roomTeam.doctor)
              : '— médecin non défini —'}
        </p>
      )}

      <label className="mt-3 block text-xs font-extrabold text-slate-700" htmlFor="consult-diagnosis">
        Diagnostic
      </label>
      <textarea
        id="consult-diagnosis"
        rows={2}
        maxLength={2000}
        value={diagnosis}
        onChange={(event) => setDiagnosis(event.target.value)}
        placeholder="Hypothèse ou diagnostic retenu"
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
      />

      <label className="mt-3 block text-xs font-extrabold text-slate-700" htmlFor="consult-notes">
        Notes cliniques
      </label>
      <textarea
        id="consult-notes"
        rows={4}
        maxLength={4000}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Examen, conduite à tenir, prescriptions"
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
      />

      {localError ? <p className="mt-3 text-xs font-semibold text-rose-700">{localError}</p> : null}

      <button
        type="submit"
        disabled={actionBusy}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-sm font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
      >
        {actionBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isOpen ? 'Enregistrer la consultation' : 'Ouvrir la consultation'}
      </button>
    </form>
  )
}
