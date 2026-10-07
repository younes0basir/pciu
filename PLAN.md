# PICU rebuild plan

The rebuild is one floor board driven by named actions. A role only turns buttons on or off. The waiting list is a view of visits still in `waiting`, and calling a name does not remove anyone from it.

The Vite app in `frontend` (React, Tailwind) is the UI. The backend comes after the board behaves correctly on local data.

## One stage machine

A visit moves only through these actions. The server runs each one as a single transaction. The screen never writes a status string itself.

| Action | From | To | What else happens |
|---|---|---|---|
| `register` | — | `waiting` | Patient is created with the visit. Priority is set here. |
| `call` | `waiting` | `waiting` | Stores `called_at` so the row can show "appelé". The row stays in the waiting column. |
| `place` | `waiting` | `placed` | Occupies one free bed. Rejected if that visit already has a bed, or the bed is taken. |
| `start` | `placed` | `in_treatment` | Doctor opens the consultation. The patient stays on the same bed. |
| `close` | `placed` or `in_treatment` | `discharged`, `transferred`, or `left_without_seen` | Frees the bed. Visit leaves the board. |
| `return` | `placed` | `waiting` | Frees the bed. Used when the placement was wrong. |

`waiting` is the only stage on the waiting list. Order is priority, then arrival time. Position is calculated when the list is read, so two patients cannot hold the same slot.

`called_at` is a label on the card. It is never a filter.

## Three screens

1. **Board** (`/`) — the whole shift.
   - **Waiting**: one list, grouped P1–P5. Each card shows priority, name, complaint, wait time, and "appelé" if `call` already ran.
   - **Rooms**: every bed, free or occupied, with the patient name on an occupied bed.
   - **Sheet**: the selected patient. One primary button, chosen from their stage and the user's permissions.
2. **Register** (`/register`) — short form (name, CIN, complaint, priority). On save, return to the board with that patient selected.
3. **People** (`/people`) — create a user and assign one role. No patients on this screen.

Chef uses the same board. There is no stats app, no second queue, and no per-role dashboard.

## Permissions

The user stores one role. The backend maps that role to capabilities and enforces them; the board only hides unavailable buttons.

| Capability | Accueil | Infirmier | Médecin | Chef |
|---|---|---|---|---|
| `register`, `call` | yes | | | |
| `place`, `return` | | yes | | |
| `start`, `close` | | | yes | |
| `override` | | | | yes |

`override` can `return` or `close` any open visit. Admin manages users and configuration only.

## Database

The PostgreSQL schema is live in the Neon project `pciu`.

### Source of truth

`visits.status` is the single source of truth for the patient workflow. There is no queue table and no stored queue position.

The database has nine focused tables:

- `users` — account, password hash, one role, active state
- `patients` — identity and contact information
- `zones` — operational hospital zones
- `rooms` — rooms within zones
- `beds` — beds within rooms
- `visits` — current workflow status, priority, complaint, call state and timestamps
- `bed_assignments` — complete placement history
- `consultations` — doctor and consultation history
- `visit_events` — immutable operational timeline

It also exposes two read views:

- `waiting_board` — waiting patients ordered by priority and arrival time, with a calculated queue position
- `bed_board` — active rooms and beds with their current occupant

### Roles

Each user has exactly one role:

- `receptionist`
- `nurse`
- `doctor`
- `chief`
- `admin`

The backend maps each role to allowed actions. There are no role-specific dashboards and no many-to-many role tables.

### Integrity rules

- Only one active visit is allowed per patient.
- Only one active bed assignment is allowed per visit.
- Only one active patient is allowed per bed.
- Only one active consultation is allowed per visit.
- Bed availability is derived from active assignments; it is not stored separately.
- Queue position is calculated; it is never stored.
- Calling updates `last_called_at` and `call_count` without changing `waiting`.
- Terminal visits require `closed_at`; active visits cannot have it.
- Patient, visit and assignment history uses restricted deletion.

## Build order

**0. Database schema — complete.** The optimized schema, indexes, constraints, and board views are deployed to Neon.

**1. Board on local data.** Seed a few visits and beds in the React app. Prove `call` leaves the patient in Waiting, `place` moves them onto a bed, `start` keeps them there, and `close` frees the bed. This is the part that failed last time, so it comes before connecting the API.

**2. Actions API.** Build Express endpoints backed by Neon. Each workflow action runs in one transaction and records a `visit_events` row. `GET /api/board` reads `waiting_board` and `bed_board` and returns the signed-in user's permissions.

**3. Connect the board.** Replace local seed data with `GET /api/board`. Refresh the snapshot after each action. Add realtime synchronization after the workflow is stable.

**4. Login and People.** Add JWT authentication, server-side role checks on every action, and the People screen.

## Done when

- Calling a waiting patient leaves them in Waiting, with "appelé" on the card.
- Placing them puts their name on that bed and removes them from Waiting.
- Placing them again, or onto a taken bed, is rejected.
- Starting the consultation keeps the same bed.
- Closing frees the bed and removes the patient from the board.
- Accueil cannot place. Infirmier cannot register. Médecin cannot place. The server returns 403.
- Two open boards show the same rooms after one action.

## After this works

AI pre-triage as a suggested priority, public tracking by CIN, and a short timeline on the patient sheet. Those stay off the board until the six actions are solid.
