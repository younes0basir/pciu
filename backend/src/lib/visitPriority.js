/** Maps DB visit priority columns to API fields (V4: registration vs clinical). */

function mapVisitPriorityFields(row) {
  const priority = row.priority != null ? Number(row.priority) : null;
  const registrationPriority =
    row.registration_priority != null ? Number(row.registration_priority) : priority;
  const validatedAt = row.clinical_priority_validated_at || null;
  const priorityValidated = Boolean(validatedAt);
  const displayPriority = priorityValidated ? priority : registrationPriority;

  return {
    priority,
    registrationPriority,
    clinicalPriorityValidatedAt: validatedAt,
    priorityValidated,
    displayPriority,
  };
}

module.exports = {
  mapVisitPriorityFields,
};
