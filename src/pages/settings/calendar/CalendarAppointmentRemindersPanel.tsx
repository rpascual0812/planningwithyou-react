import {
  type SubmitEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import CompanyFilterSelect from "../../../components/CompanyFilterSelect";
import { useCompanyFilter } from "../../../hooks/useCompanyFilter";
import { useFeatureAccess } from "../../../hooks/useFeatureAccess";
import {
  createAppointmentReminder,
  deleteAppointmentReminder,
  fetchAppointmentReminders,
  formatReminderOffset,
  normalizeReminderUnit,
  REMINDER_CALENDAR_OPTIONS,
  REMINDER_TYPE_OPTIONS,
  REMINDER_UNIT_OPTIONS,
  updateAppointmentReminder,
  type AppointmentReminderPayload,
  type AppointmentReminderRecord,
  type ReminderCalendar,
  type ReminderType,
  type ReminderUnit,
} from "../../../services/appointmentReminders";
import {
  fetchCalendarStatuses,
  type CalendarStatusRecord,
} from "../../../services/calendar";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

type ReminderFormState = {
  mode: "create" | "edit";
  id: number | null;
  calendar_statuses: number[];
  calendar: ReminderCalendar;
  frequency: number;
  unit: ReminderUnit;
  type: ReminderType;
  is_active: boolean;
};

const EMPTY_FORM: Omit<ReminderFormState, "mode" | "id"> = {
  calendar_statuses: [],
  calendar: "start",
  frequency: 1,
  unit: "hour",
  type: "email",
  is_active: true,
};

const CalendarAppointmentRemindersPanel = () => {
  const { canWrite: calendarWrite } = useFeatureAccess("calendar_settings");
  const [error, setError] = useState<string | null>(null);
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
  } = useCompanyFilter({ onFetchError: setError });

  const [reminders, setReminders] = useState<AppointmentReminderRecord[]>([]);
  const [statuses, setStatuses] = useState<CalendarStatusRecord[]>([]);
  const [filterStatusIds, setFilterStatusIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ReminderFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<AppointmentReminderRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses],
  );

  const loadStatuses = useCallback(async () => {
    try {
      const statusRows = await fetchCalendarStatuses();
      setStatuses(
        [...statusRows].sort(
          (a, b) => a.sort_order - b.sort_order || a.id - b.id,
        ),
      );
    } catch {
      setStatuses([]);
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  const load = useCallback(async () => {
    if (activeCompanyId == null) {
      setReminders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAppointmentReminders(
        activeCompanyId,
        filterStatusIds,
      );
      setReminders(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, filterStatusIds]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setModal({ mode: "create", id: null, ...EMPTY_FORM });
  };

  const openEdit = (row: AppointmentReminderRecord) => {
    setModal({
      mode: "edit",
      id: row.id,
      calendar_statuses: [...row.calendar_statuses],
      calendar: row.calendar,
      frequency: row.frequency,
      unit: row.unit,
      type: row.type,
      is_active: row.is_active,
    });
  };

  const toggleStatus = (statusId: number) => {
    if (!modal) return;
    const set = new Set(modal.calendar_statuses);
    if (set.has(statusId)) set.delete(statusId);
    else set.add(statusId);
    setModal({ ...modal, calendar_statuses: [...set] });
  };

  const buildPayload = (
    form: ReminderFormState,
  ): AppointmentReminderPayload => ({
    calendar_statuses: form.calendar_statuses,
    calendar: form.calendar,
    frequency: form.frequency,
    unit: normalizeReminderUnit(form.frequency, form.unit),
    type: form.type,
    is_active: form.is_active,
  });

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modal || activeCompanyId == null) return;
    if (modal.frequency < 1) {
      showErrorToast("Frequency must be at least 1.");
      return;
    }
    const payload = buildPayload(modal);
    setSaving(true);
    try {
      if (modal.mode === "create") {
        await createAppointmentReminder(payload, activeCompanyId);
        showSuccessToast("Reminder created.");
      } else if (modal.id) {
        await updateAppointmentReminder(modal.id, payload);
        showSuccessToast("Reminder updated.");
      }
      setModal(null);
      await load();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAppointmentReminder(deleteTarget.id);
      showSuccessToast("Reminder deleted.");
      setDeleteTarget(null);
      if (modal?.id === deleteTarget.id) setModal(null);
      await load();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Delete failed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const toggleFilterStatus = (statusId: number) => {
    setFilterStatusIds((prev) => {
      const set = new Set(prev);
      if (set.has(statusId)) set.delete(statusId);
      else set.add(statusId);
      return [...set];
    });
  };

  const statusLabels = (ids: number[]) => {
    if (!ids.length) return "All statuses";
    return ids.map((id) => statusById.get(id)?.title ?? `#${id}`).join(", ");
  };

  return (
    <div>
      <div className="row g-2 align-items-end mb-3">
        <CompanyFilterSelect
          id="calendar-reminders-company"
          companies={companies}
          loading={companiesLoading}
          value={selectedCompanyId}
          onChange={setSelectedCompanyId}
        />
        <div className="col-auto ms-sm-auto">
          {calendarWrite && activeCompanyId != null && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={openAdd}
            >
              <i className="bi bi-plus-lg me-1" />
              Add reminder
            </button>
          )}
        </div>
      </div>

      {activeCompanyId != null && statuses.length > 0 && (
        <div className="mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="text-muted small">Filter by status:</span>
            {statuses.map((status) => {
              const active = filterStatusIds.includes(status.id);
              return (
                <button
                  key={status.id}
                  type="button"
                  className={`btn btn-sm ${active ? "" : "btn-outline-secondary"}`}
                  style={
                    active
                      ? {
                          color: status.text_color,
                          backgroundColor: status.background_color,
                          borderColor: status.background_color,
                        }
                      : undefined
                  }
                  onClick={() => toggleFilterStatus(status.id)}
                >
                  {status.title}
                </button>
              );
            })}
            {filterStatusIds.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-link text-secondary"
                onClick={() => setFilterStatusIds([])}
              >
                Clear
              </button>
            )}
          </div>
          {filterStatusIds.length > 0 && (
            <p className="text-muted small mb-0 mt-2">
              Showing reminders that apply to{" "}
              {filterStatusIds
                .map((id) => statusById.get(id)?.title ?? `#${id}`)
                .join(", ")}
              , including rules set for all statuses.
            </p>
          )}
        </div>
      )}

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {activeCompanyId == null ? (
        <div className="text-muted small">
          Select a company to manage appointment reminders.
        </div>
      ) : loading && reminders.length === 0 ? (
        <div className="text-muted">Loading…</div>
      ) : reminders.length === 0 ? (
        <div className="text-muted small">
          {filterStatusIds.length
            ? "No appointment reminders match the selected statuses."
            : "No appointment reminders for this company yet."}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Statuses</th>
                <th>Calendar</th>
                <th>When</th>
                <th>Type</th>
                <th>Active</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((row) => (
                <tr key={row.id}>
                  <td className="small">
                    {statusLabels(row.calendar_statuses)}
                  </td>
                  <td className="small">
                    {REMINDER_CALENDAR_OPTIONS.find(
                      (o) => o.value === row.calendar,
                    )?.label ?? row.calendar}
                  </td>
                  <td className="small">{formatReminderOffset(row)}</td>
                  <td className="text-capitalize">{row.type}</td>
                  <td>{row.is_active ? "Yes" : "No"}</td>
                  <td className="text-end">
                    {calendarWrite && (
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEdit(row)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => !saving && setModal(null)}
          />
          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <form onSubmit={(e) => void handleSubmit(e)}>
                  <div className="modal-header">
                    <h2 className="modal-title fs-5">
                      {modal.mode === "create"
                        ? "Add reminder"
                        : "Edit reminder"}
                    </h2>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => setModal(null)}
                      disabled={saving}
                    />
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <span className="form-label d-block">
                        Calendar statuses
                      </span>
                      <p className="text-muted small mb-2">
                        Leave none selected to apply this reminder to all
                        appointment statuses.
                      </p>
                      {statuses.length === 0 ? (
                        <p className="text-muted small mb-0">
                          No calendar statuses available.
                        </p>
                      ) : (
                        <div className="d-flex flex-wrap gap-2">
                          {statuses.map((status) => {
                            const checked = modal.calendar_statuses.includes(
                              status.id,
                            );
                            return (
                              <label
                                key={status.id}
                                className="form-check form-check-inline mb-0"
                              >
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={checked}
                                  onChange={() => toggleStatus(status.id)}
                                />
                                <span
                                  className="form-check-label badge"
                                  style={{
                                    color: status.text_color,
                                    backgroundColor: status.background_color,
                                  }}
                                >
                                  {status.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="reminder-calendar">
                        Calendar
                      </label>
                      <select
                        id="reminder-calendar"
                        className="form-select"
                        value={modal.calendar}
                        onChange={(e) =>
                          setModal({
                            ...modal,
                            calendar: e.target.value as ReminderCalendar,
                          })
                        }
                      >
                        {REMINDER_CALENDAR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-sm-4">
                        <label
                          className="form-label"
                          htmlFor="reminder-frequency"
                        >
                          Frequency
                        </label>
                        <input
                          id="reminder-frequency"
                          type="number"
                          min={1}
                          className="form-control"
                          value={modal.frequency}
                          onChange={(e) => {
                            const frequency = Math.max(
                              1,
                              Number(e.target.value) || 1,
                            );
                            setModal({
                              ...modal,
                              frequency,
                              unit: normalizeReminderUnit(
                                frequency,
                                modal.unit,
                              ),
                            });
                          }}
                          required
                        />
                      </div>
                      <div className="col-sm-8">
                        <label className="form-label" htmlFor="reminder-unit">
                          Unit
                        </label>
                        <select
                          id="reminder-unit"
                          className="form-select"
                          value={modal.unit}
                          onChange={(e) =>
                            setModal({
                              ...modal,
                              unit: e.target.value as ReminderUnit,
                            })
                          }
                        >
                          {REMINDER_UNIT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mb-3" hidden={true}>
                      <label className="form-label" htmlFor="reminder-type">
                        Type
                      </label>
                      <select
                        id="reminder-type"
                        className="form-select"
                        value={modal.type}
                        onChange={(e) =>
                          setModal({
                            ...modal,
                            type: e.target.value as ReminderType,
                          })
                        }
                      >
                        {REMINDER_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-check">
                      <input
                        id="reminder-active"
                        type="checkbox"
                        className="form-check-input"
                        checked={modal.is_active}
                        onChange={(e) =>
                          setModal({ ...modal, is_active: e.target.checked })
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="reminder-active"
                      >
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setModal(null)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">Delete reminder</h2>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete this {formatReminderOffset(deleteTarget)}{" "}
                    {deleteTarget.type} reminder?
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void confirmDelete()}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarAppointmentRemindersPanel;
