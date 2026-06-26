import { apiFetch, authHeaders, buildApiUrl } from "./api";

const BASE = "/appointment-reminders/";

export type ReminderUnit =
  | "minute"
  | "minutes"
  | "hour"
  | "hours"
  | "day"
  | "days"
  | "week"
  | "weeks";

export type ReminderType = "email" | "sms";

export type ReminderCalendar = "start" | "end";

export type AppointmentReminderRecord = {
  id: number;
  company: number;
  calendar_statuses: number[];
  calendar: ReminderCalendar;
  frequency: number;
  unit: ReminderUnit;
  type: ReminderType;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AppointmentReminderPayload = {
  calendar_statuses: number[];
  calendar: ReminderCalendar;
  frequency: number;
  unit: ReminderUnit;
  type: ReminderType;
  is_active: boolean;
};

export const REMINDER_UNIT_OPTIONS: { value: ReminderUnit; label: string }[] = [
  { value: "minutes", label: "minutes" },
  { value: "hours", label: "hours" },
  { value: "days", label: "days" },
  { value: "weeks", label: "weeks" },
];

export const REMINDER_CALENDAR_OPTIONS: {
  value: ReminderCalendar;
  label: string;
}[] = [
  { value: "start", label: "Before event start" },
  { value: "end", label: "Before event end" },
];

export const REMINDER_TYPE_OPTIONS: { value: ReminderType; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

/** Pick singular/plural unit label based on frequency. */
export function normalizeReminderUnit(
  frequency: number,
  unit: ReminderUnit,
): ReminderUnit {
  const singular = unit.replace(/s$/, "") as ReminderUnit;
  const plural = (
    singular.endsWith("s") ? singular : `${singular}s`
  ) as ReminderUnit;
  return frequency === 1 ? singular : plural;
}

export function formatReminderOffset(
  reminder: Pick<AppointmentReminderRecord, "frequency" | "unit" | "calendar">,
): string {
  const unit = normalizeReminderUnit(reminder.frequency, reminder.unit);
  const anchor =
    reminder.calendar === "end" ? "before event end" : "before event start";
  return `${reminder.frequency} ${unit} ${anchor}`;
}

function extractError(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const obj = body as Record<string, unknown>;
  for (const val of Object.values(obj)) {
    if (typeof val === "string") return val;
    if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  }
  return "";
}

export async function fetchAppointmentReminders(
  companyId?: number | null,
  calendarStatusIds?: number[],
): Promise<AppointmentReminderRecord[]> {
  const params = new URLSearchParams()
  if (companyId != null) params.set('company_id', String(companyId))
  if (calendarStatusIds?.length) {
    params.set('calendar_status_ids', calendarStatusIds.join(','))
  }
  const qs = params.toString();
  const res = await apiFetch(buildApiUrl(`${BASE}${qs ? `?${qs}` : ""}`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load appointment reminders");
  return res.json();
}

export async function createAppointmentReminder(
  data: AppointmentReminderPayload,
  companyId?: number | null,
): Promise<AppointmentReminderRecord> {
  const params = new URLSearchParams();
  if (companyId != null) params.set("company_id", String(companyId));
  const qs = params.toString();
  const res = await apiFetch(buildApiUrl(`${BASE}${qs ? `?${qs}` : ""}`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body) || "Failed to create reminder");
  }
  return res.json();
}

export async function updateAppointmentReminder(
  id: number,
  data: Partial<AppointmentReminderPayload>,
): Promise<AppointmentReminderRecord> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body) || "Failed to update reminder");
  }
  return res.json();
}

export async function deleteAppointmentReminder(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete reminder");
}
