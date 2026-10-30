# n8n workflows

Importable n8n workflow exports used by the frontend.

## user_cancelled_appointments_count

Endpoint that returns how many appointments a patient has in status `cancelled`.

- **Method / path:** `GET /user_cancelled_appointments_count`
- **Query param:** `user_id` (the patient's `users.id`)
- **Response:** `{ "user_id": "...", "cancelled_count": <int> }`
- **Frontend usage:** `API_ROUTES.USER_CANCELLED_APPOINTMENTS_COUNT` (`src/constants/routes.ts`); consumed in the appointments page to show the count next to the patient debt in the in-calendar appointment form.

### Import steps
1. n8n → Workflows → Import from File → `user_cancelled_appointments_count.json`.
2. Open the **Count cancelled appointments** node and bind your Postgres credential
   (the export has a placeholder credential id).
3. Activate the workflow.

### SQL
```sql
SELECT COUNT(*)::int AS cancelled_count
FROM public.appointments
WHERE user_id = $1
  AND status = 'cancelled';
```

> Assumption: the patient is stored in `appointments.user_id`. If your schema uses a
> different column (e.g. `patient_id`), adjust the query accordingly.
