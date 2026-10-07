import { Shield, Stethoscope, HeartPulse, ClipboardList, Award } from 'lucide-react'

export const ROLE_CONFIG = {
  doctor: {
    label: 'Médecin',
    enLabel: 'Doctor',
    icon: Stethoscope,
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    avatarBg: 'from-emerald-500 to-teal-600',
    capabilities: ['Consultation', 'Prise en charge', 'Clôture visite', 'Vue file'],
    description:
      'Consulte et clôture les patients de sa salle, avec plan des lits et file d’attente en lecture seule.',
  },
  nurse: {
    label: 'Infirmier',
    enLabel: 'Nurse',
    icon: HeartPulse,
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    avatarBg: 'from-sky-500 to-blue-600',
    capabilities: ['Triage', 'Placement lits', 'Consultation pour le médecin', 'Clôture visite'],
    description:
      'Place les patients, complète la consultation au nom du médecin de salle et peut clôturer si besoin.',
  },
  receptionist: {
    label: 'Accueil',
    enLabel: 'Receptionist',
    icon: ClipboardList,
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    avatarBg: 'from-indigo-500 to-violet-600',
    capabilities: ['Enregistrement', 'File d’attente'],
    description: 'Enregistre les arrivées et consulte la file d’attente.',
  },
  chief: {
    label: 'Chef de Service',
    enLabel: 'Chief',
    icon: Award,
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    avatarBg: 'from-amber-500 to-orange-600',
    capabilities: ['Supervision', 'Équipes & salles', 'Consultation pour un médecin'],
    description: 'Compose les équipes de salle et peut rédiger une consultation au nom de n’importe quel médecin.',
  },
  admin: {
    label: 'Administrateur',
    enLabel: 'Admin',
    icon: Shield,
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    avatarBg: 'from-purple-600 to-indigo-700',
    capabilities: ['Gestion comptes', 'Sécurité', 'Configuration'],
    description: 'Gère les comptes utilisateurs, les droits et la sécurité du système.',
  },
}
