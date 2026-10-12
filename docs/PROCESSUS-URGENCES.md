# Processus des urgences et plan des lits

> **Évolution :** la spécification cible est [`PROCESSUS-URGENCES-V3.md`](./PROCESSUS-URGENCES-V3.md). Le code expose désormais `care_stage`, worklists calculées, états opérationnels des ressources et historique de triage, tout en conservant les statuts legacy (`waiting`, `placed`, `in_treatment`) pour la compatibilité des écrans existants.

Ce document décrit le fonctionnement actuel de la plateforme : le parcours d’un patient, puis le plan des lits. Il correspond au code en place (visites, file, lits, rôles).

## Idée générale

Une **visite** suit le patient pendant son passage. Le statut de la visite est la seule source de vérité.

Deux vues se complètent :

- La **file d’attente** montre qui est encore sans lit.
- Le **plan des lits** montre où sont les patients déjà placés, et quels lits sont libres.

Appeler un patient ne le retire pas de la file. Seul le placement sur un lit le fait passer sur le plan.

## Ce qui est enregistré à l’arrivée

L’accueil (ou le chef) crée le patient et la visite en une fois.

| Champ | Rôle |
|---|---|
| Prénom, nom | Obligatoires |
| CIN, téléphone | Facultatifs. Une CIN déjà connue rattache la visite au même patient. |
| Priorité P1–P5 | Obligatoire. P1 est le plus urgent, P5 le moins urgent. |
| Motif principal | Obligatoire, texte libre. Il n’est plus modifié ensuite. |
| Mode d’arrivée | À pied, ambulance, brancard ou autre. |

La visite démarre en `waiting`. Elle reçoit un code public du type `V-AAMMJJ-XXXX`.

Règles à l’enregistrement :

- Un patient ne peut avoir qu’une visite active (`waiting`, `placed` ou `in_treatment`).
- La priorité doit être un entier de 1 à 5.
- Le motif ne peut pas être vide.

## Ordre de la file

La place n’est pas stockée. Elle est recalculée à chaque lecture, uniquement pour les visites `waiting`.

1. Priorité croissante (P1 avant P5).
2. Heure d’arrivée, à priorité égale.
3. Identifiant de la visite, si les deux premiers sont identiques.

Deux patients n’ont donc jamais la même place. Un filtre d’écran masque des lignes, il ne renumérote pas la file.

Ce qui change la place : un nouvel arrivant plus prioritaire, une correction de priorité par l’infirmier, un placement ou une clôture qui retire quelqu’un de `waiting`.

Ce qui ne change pas la place : l’appel. Il enregistre l’heure et le nombre d’appels, et le badge « Appelé ». Le statut reste `waiting`.

## Parcours

```text
enregistrement → waiting
appel          → waiting (marqué appelé)
triage         → waiting (priorité éventuellement corrigée)
placement      → placed, lit occupé, sortie de la file
retour         → waiting, lit libéré
début consult. → in_treatment, même lit
clôture        → discharged | transferred | left_without_seen, lit libéré
```

| Action | Qui | Depuis | Vers | Effet |
|---|---|---|---|---|
| Enregistrer | Accueil, chef | — | `waiting` | Patient + visite, priorité et motif. |
| Appeler | Accueil, chef | `waiting` | `waiting` | `last_called_at` et `call_count`. Reste dans la file. |
| Trier | Infirmier | `waiting` | `waiting` | Priorité 1–5, note éventuelle dans l’historique. |
| Placer | Infirmier, chef | `waiting` | `placed` | Occupe un lit libre. Retire le patient de la file. |
| Rendre à la file | Infirmier, chef | `placed` | `waiting` | Libère le lit. Réservé à un placement erroné, avant la consultation. |
| Démarrer | Infirmier, médecin, chef | `placed` | `in_treatment` | Ouvre la consultation. Le patient reste sur le même lit. |
| Remplir | Infirmier, médecin, chef | consultation ouverte | — | Diagnostic et notes. |
| Clôturer | Infirmier, médecin, chef | `placed` ou `in_treatment` | issue finale | Libère le lit. La visite quitte le tableau. |

Issues finales :

- `discharged` — sortie
- `transferred` — transfert
- `left_without_seen` — parti sans avoir été vu

Chaque action est une transaction et laisse une ligne dans l’historique (`visit_events`).

## Qui fait quoi

| | Accueil | Infirmier | Médecin | Chef |
|---|---|---|---|---|
| Enregistrer, appeler | oui | | | oui |
| Ajuster la priorité | | oui | | |
| Placer, rendre à la file | | oui | | oui |
| Démarrer, remplir, clôturer | | oui, dans sa salle | oui, pour ses patients | oui |

L’infirmier ne démarre, ne remplit et ne clôture que les visites de **sa salle** (équipe de salle). Le médecin ne le fait que pour les patients de la salle dont il est le médecin, ou pour la consultation qu’il a ouverte. Le placement lui-même accepte tout lit libre encore actif : le choix du lit se fait au moment de poser le patient.

L’admin gère les comptes. Il ne fait pas partie du parcours de soins.

## Équipes de salle

Une salle a au plus une équipe : un médecin et des infirmiers. Un médecin n’est titulaire que d’une salle. Un infirmier n’appartient qu’à une équipe.

Le plan des lits s’en sert pour marquer « Votre salle » et pour limiter les dossiers ouvrables.

## Plan des lits

Le plan est le bâtiment, pas une liste de spécialités. Il est lu dans la vue `bed_board` : zones actives, salles actives, lits actifs, et l’occupant s’il y en a un.

Un lit est **occupé** seulement s’il existe une affectation sans date de libération. Dès la clôture ou le retour en file, le lit redevient libre. Deux visites ne peuvent pas occuper le même lit. Une visite ne peut pas occuper deux lits.

### Configuration actuelle

| Zone | Salles | Lits |
|---|---|---|
| Déchoquage / SAUV | Salle SAUV 1 | Lit D1, Lit D2 |
| Déchoquage / SAUV | Salle SAUV 2 | Lit D3 |
| Surveillance rapide | Box A | Lit A1, Lit A2 |
| Surveillance rapide | Box B | Lit B1, Lit B2 |
| Soins ambulatoires | Secteur ambulatoire | Fauteuil 1, Fauteuil 2, Fauteuil 3 |

### Ce qu’une case montre

Lit libre : le nom du lit et « Libre ». Il n’y a pas de motif ni de priorité, puisqu’il n’y a pas de patient.

Lit occupé : initiales, nom, priorité, code de visite, statut (« Au lit » ou « Consultation ») et heure de placement. Le motif principal n’est pas sur la case. Il reste dans la file et dans la fiche.

Le bandeau compte les lits libres, occupés et urgents. Urgent veut dire occupé et priorité P1 ou P2.

| Taux d’occupation | Libellé |
|---|---|
| moins de 70 % | Disponible |
| de 70 % à moins de 90 % | Chargé |
| 90 % et plus | Saturé |

Filtres : tous, libres, occupés, urgents, et « Ma salle » quand l’utilisateur a une salle. Recherche sur le nom, le code, le lit, la salle ou la zone.

S’il n’y a aucune salle active, l’écran affiche « Plan des lits indisponible ».

### Selon le rôle

| Rôle | Plan des lits |
|---|---|
| Infirmier | Voit tout l’hôpital. Un lit libre ouvre le placement. Un lit occupé ouvre le dossier. Sa salle est mise en avant. |
| Médecin | Voit tout l’hôpital. Il n’ouvre que les patients de sa salle. Il ne place personne. |
| Chef | Voit l’occupation en temps réel et ouvre n’importe quel lit occupé. Le plan ne sert pas à placer. |
| Accueil | Pas de plan des lits. L’accueil s’arrête à la file. |

## Exemple

1. L’accueil enregistre Amina, P2, motif « douleur thoracique ». Elle est en file, devant les P3 arrivés avant elle.
2. L’accueil l’appelle. Elle reste en file, avec le badge Appelé.
3. L’infirmier confirme P2, ou la passe en P1.
4. L’infirmier la place sur le lit D1. Elle disparaît de la file. D1 affiche son nom et P2.
5. Le médecin de la Salle SAUV 1 démarre la consultation. D1 passe à « Consultation ». Le lit ne change pas.
6. La clôture en sortie libère D1. La visite quitte le plan et la file.

Si le lit D1 était une erreur et que la consultation n’a pas commencé, l’infirmier rend la visite à la file : D1 redevient libre, et Amina reprend une place selon sa priorité et son heure d’arrivée d’origine.
