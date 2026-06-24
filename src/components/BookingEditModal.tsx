import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import type { DragEvent, SubmitEvent } from "react";
import { FIELD_TYPE_OPTIONS, type FieldType } from "../services/formTemplates";
import { storedValueToTimeInput, timeInputToStored } from "../lib/timeInput";
import {
  DEFAULT_BOOKING_GROUP_NAME,
  mergeBookingFieldGroups,
  normalizeBookingGroupName,
} from "../lib/bookingFieldGroups";
import {
  applyBookingFieldMove,
  applyBookingFieldMoveToGroupEnd,
} from "../lib/bookingFieldReorder";
import type { BookingField } from "../lib/bookingFieldTypes";
import { finalizeBookingFieldDefinitions } from "../lib/bookingFieldSave";
import {
  bookingPriceSummaryRequiredDownpayment,
  bookingStoredTotalAmountHasValue,
  getBookingGroupSubtotalMap,
  getBookingPriceGroups,
  resolveBookingFieldPriceRaw,
  sumBookingPriceGroups,
} from "../lib/bookingPriceSummary";
import { fetchBookingsGroupNameConfig } from "../services/config";
import { fetchCurrentAccount } from "../services/accounts";
import {
  currencyFormatFromAccount,
  formatCurrency,
  type CurrencyFormatOptions,
} from "../utils/currency";
import BookingHistoryPanel from "./BookingHistoryPanel";
import QuotationDocumentsPanel from "./QuotationDocumentsPanel";
import QuotationEmailLogsPanel from "./QuotationEmailLogsPanel";
import BookingPaymentsModal from "./BookingPaymentsModal";
import ContactFormModal from "./ContactFormModal";
import SupplierFieldInput from "./SupplierFieldInput";
import SearchableSelect from "./SearchableSelect";
import QuotationAiPanel from "./QuotationAiPanel";
import { fetchAiAssistantStatus } from "../services/aiAssistant";
import { hasAiPlusSubscription } from "../lib/aiPlusPlan";
import { useAuthSession } from "../context/AuthSessionContext";
import { fetchBookingItem, type BookingItemRecord } from "../services/bookings";
import {
  createContact,
  fetchContact,
  fetchContacts,
  type ContactPayload,
  type ContactRecord,
} from "../services/contacts";
import { fetchCompanies, type CompanyRecord } from "../services/companies";
import {
  fetchActiveSupplierTypes,
  type SupplierTypeRecord,
} from "../services/supplierTypes";
import { fetchMe, type UserRecord } from "../services/users";
import {
  contactAddressLabel,
  contactDefaultAddress,
  contactDefaultPhone,
  contactDisplayName,
  contactPhoneLabel,
  formatContactAddress,
} from "../lib/contactDisplay";
import EmailSenderModal from "./EmailSenderModal";
import { applyEmailMergeVariables } from "../lib/applyEmailMergeVariables";
import { buildEmailMergeContext } from "../lib/emailMergeContext";
import { fetchBookingPaymentLinks } from "../services/bookingPaymentLinks";
import { sendEmail, type EmailPayload } from "../services/emails";
import { EMPTY_CONTACT_FORM, validateContactPayload } from "../lib/contactForm";
import { fetchSecuredFileBlobUrl } from "../lib/securedFileUrl";
import {
  computeQuotationEffectiveTotal,
  quotationPricingAdjustmentFromForm,
  type QuotationDiscountType,
  type QuotationPricingAdjustment,
} from "../lib/quotationPricingAdjustments";
import QuotationPricingModal from "./QuotationPricingModal";
import { showErrorToast, showSuccessToast } from "../utils/toast";

export type {
  BookingField,
  BookingFieldOption,
} from "../lib/bookingFieldTypes";

export type BookingFormState = {
  mode: "create" | "edit";
  id: number | null;
  /** ``bookings.unique_id`` (edit only). */
  uniqueId?: string;
  statusId: number;
  contactId: number | null;
  title: string;
  dateOfEvent: string;
  timeOfEvent: string;
  fields: BookingField[];
  /** Empty group accordions (no fields yet); persisted via quotation ``groups`` on save. */
  extraGroupNames?: string[];
  notes: string;
  /** Public URL for the generated booking quote PDF, when available. */
  pdfUrl?: string;
  /** Persisted ``bookings.total_amount`` (set after save). */
  totalAmount?: string;
  /** Optional percent or fixed discount applied to the line-item subtotal. */
  discountAmount?: string;
  discountType?: QuotationDiscountType;
  /** When set, replaces the computed/discounted total. */
  overrideTotalAmount?: string;
  /** Persisted ``bookings.required_downpayment_amount`` (set after save). */
  requiredDownpaymentAmount?: string;
  /** Sum of successful ``quotation_payments`` base credited (edit). */
  paidAmount?: string;
  paidChargeAmount?: string;
  paidProcessingFees?: string;
  paidPlatformFees?: string;
  refundedAmount?: string;
  /** False when another company appears on the quotation; view-only in the UI. */
  canEdit?: boolean;
  /** Owner company name (``bookings.company_id``); shown in view-only mode. */
  companyName?: string;
};

export type BookingStatus = {
  id: number;
  title: string;
};

export type BookingTemplateField = {
  label: string;
  field_type: FieldType;
  is_required: boolean;
  options: { label: string; price: string | null; sort_order: number }[];
  price: string | null;
  supplier_type?: number | null;
  sort_order: number;
};

export type BookingTemplate = {
  id: number;
  name: string;
  is_default: boolean;
  is_active?: boolean;
  fields: BookingTemplateField[];
};

export type BookingGroupRef = {
  id: number;
  name: string;
};

type BookingEditModalProps = {
  form: BookingFormState;
  statuses: BookingStatus[];
  templates: BookingTemplate[];
  bookingGroups?: BookingGroupRef[];
  onChange: (next: BookingFormState) => void;
  onDeleteGroup?: (bookingId: number, groupId: number) => Promise<void>;
  onClose: () => void;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void | Promise<void>;
  onSendToCalendar?: () => void;
  onDuplicated?: (item: BookingItemRecord) => void | Promise<void>;
  onPricingApplied?: (adjustment: QuotationPricingAdjustment) => Promise<void>;
  historyRefreshKey?: number;
  /** When false, the modal is view-only (no save / field edits). */
  canWrite?: boolean;
  saving?: boolean;
  /** Full quotation payload is still loading (board/cards slim list). */
  loadingDetails?: boolean;
};

const EMPTY_FIELD: BookingField = {
  label: "",
  group_name: DEFAULT_BOOKING_GROUP_NAME,
  field_type: "text",
  is_required: false,
  options: [],
  price: null,
  requiredDownpayment: null,
  supplier_type_id: null,
  sort_order: 0,
  saved: false,
  value: "",
};

const EMPTY_OPTION: BookingField["options"][number] = {
  label: "",
  price: null,
  sort_order: 0,
};

const DRAFT_KEY_PREFIX = "bookingDraft:";

type DraftData = Omit<BookingFormState, "mode" | "id">;

function draftKey(bookingId: number | null): string {
  const idPart = bookingId != null ? String(bookingId) : "new";
  return `${DRAFT_KEY_PREFIX}${idPart}`;
}

function loadDraft(key: string): DraftData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DraftData) : null;
  } catch {
    return null;
  }
}

function saveDraft(key: string, form: BookingFormState) {
  try {
    const { mode: _, id: __, ...data } = form;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota exceeded */
  }
}

function isDraftNonEmpty(data: Partial<BookingFormState>): boolean {
  if (data.title && data.title.trim()) return true;
  if (data.dateOfEvent && data.dateOfEvent.trim()) return true;
  if (data.timeOfEvent && data.timeOfEvent.trim()) return true;
  if (data.notes && data.notes.trim()) return true;
  if (data.contactId != null) return true;
  if (data.fields && data.fields.length > 0) return true;
  return false;
}

export function clearBookingDraft(bookingId: number | null) {
  localStorage.removeItem(draftKey(bookingId));
}

const BookingEditModal = ({
  form,
  statuses,
  templates,
  bookingGroups = [],
  onChange,
  onDeleteGroup,
  onClose,
  onSubmit,
  onSendToCalendar,
  onPricingApplied,
  historyRefreshKey = 0,
  canWrite = true,
  saving = false,
  loadingDetails = false,
}: BookingEditModalProps) => {
  const viewOnly =
    !canWrite || (form.mode === "edit" && form.canEdit === false);
  const showHistoryTab = form.mode === "edit" && form.id != null;
  const showDocumentsTab = showHistoryTab;
  const showEmailLogsTab = showHistoryTab;

  useEffect(() => {
    setModalTab("details");
    setManagingGroup(null);
    setContactDetailsOpen(true);
    setContactPickerOpen(false);
    setMoreActionsOpen(false);
    createSeededRef.current = false;
  }, [form.id, form.mode]);
  const readOnlyFieldProps = viewOnly
    ? ({ readOnly: true, disabled: true } as const)
    : {};
  type FieldDragOver =
    | { kind: "field"; idx: number }
    | { kind: "group-end"; groupName: string }
    | null;
  const fieldDragIdxRef = useRef<number | null>(null);
  const [fieldDragOver, setFieldDragOver] = useState<FieldDragOver>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyFormatOptions>(
    {
      currencyCode: "USD",
      locale: "en-US",
    },
  );
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [linkedContact, setLinkedContact] = useState<ContactRecord | null>(
    null,
  );
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addContactForm, setAddContactForm] = useState<ContactPayload>({
    ...EMPTY_CONTACT_FORM,
  });
  const [addContactError, setAddContactError] = useState<string | null>(null);
  const [addContactSaving, setAddContactSaving] = useState(false);
  const [userCompanyId, setUserCompanyId] = useState<number | null>(null);
  const [emailMergeUser, setEmailMergeUser] = useState<UserRecord | null>(null);
  const [emailMergeCompany, setEmailMergeCompany] =
    useState<CompanyRecord | null>(null);
  const [modalTab, setModalTab] = useState<
    "details" | "documents" | "email_logs" | "history"
  >("details");
  const [localHistoryRefresh, setLocalHistoryRefresh] = useState(0);
  const [emailLogsRefresh, setEmailLogsRefresh] = useState(0);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPaymentLinkMode, setEmailPaymentLinkMode] = useState(false);
  const [paymentLinkUrlForEmail, setPaymentLinkUrlForEmail] = useState<
    string | null
  >(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [defaultGroupName, setDefaultGroupName] = useState(
    DEFAULT_BOOKING_GROUP_NAME,
  );
  const [extraGroupNames, setExtraGroupNames] = useState<string[]>(
    form.extraGroupNames ?? [],
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  /** Group whose field definitions (schema) are being edited. */
  const [managingGroup, setManagingGroup] = useState<string | null>(null);
  const [contactDetailsOpen, setContactDetailsOpen] = useState(true);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const { subscriptionPlan } = useAuthSession();
  const hasAiPlusPlan = hasAiPlusSubscription(subscriptionPlan);
  const [emailAiComposeDefaults, setEmailAiComposeDefaults] =
    useState<Partial<EmailPayload> | null>(null);
  const [supplierTypes, setSupplierTypes] = useState<SupplierTypeRecord[]>([]);
  const [supplierTypesLoading, setSupplierTypesLoading] = useState(false);
  const createSeededRef = useRef(false);
  type GroupNameModal =
    | { type: "add" }
    | { type: "edit"; originalName: string }
    | null;
  const [groupNameModal, setGroupNameModal] = useState<GroupNameModal>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupNameError, setGroupNameError] = useState<string | null>(null);
  const [addGroupTemplateId, setAddGroupTemplateId] = useState<number | null>(
    null,
  );
  /** API group names hidden after rename until the quotation is saved. */
  const [dismissedApiGroupNames, setDismissedApiGroupNames] = useState<
    string[]
  >([]);
  const originalFormJson = useRef(JSON.stringify(form));
  const groupLabel = defaultGroupName;
  const skipSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCurrentAccount(), fetchBookingsGroupNameConfig()])
      .then(([account, groupConfig]) => {
        if (cancelled) return;
        setCurrencyOptions(currencyFormatFromAccount(account));
        const name = groupConfig.value?.trim();
        if (name) setDefaultGroupName(name);
      })
      .catch(() => {
        // Keep defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMe(), fetchCompanies()])
      .then(([user, companies]) => {
        if (cancelled) return;
        setUserCompanyId(user.company);
        setEmailMergeUser(user);
        const company =
          user.company != null
            ? (companies.find((c) => c.id === user.company) ?? null)
            : null;
        setEmailMergeCompany(company);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (form.mode !== "edit" || form.id == null || !hasAiPlusPlan) {
      setAiAvailable(false);
      return;
    }
    fetchAiAssistantStatus()
      .then((status) => {
        if (!cancelled) {
          setAiAvailable(status.available);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiAvailable(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form.mode, form.id, hasAiPlusPlan]);

  useEffect(() => {
    if (!moreActionsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreActionsRef.current?.contains(target)) return;
      setMoreActionsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreActionsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreActionsOpen]);

  useEffect(() => {
    let cancelled = false;
    setSupplierTypesLoading(true);
    fetchActiveSupplierTypes()
      .then((data) => {
        if (!cancelled) setSupplierTypes(data);
      })
      .catch(() => {
        if (!cancelled) setSupplierTypes([]);
      })
      .finally(() => {
        if (!cancelled) setSupplierTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setContactsLoading(true);
    fetchContacts()
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      setContacts(await fetchContacts());
    } catch {
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const openAddContact = () => {
    setAddContactForm({
      ...EMPTY_CONTACT_FORM,
      company_id: userCompanyId,
    });
    setAddContactError(null);
    setAddContactOpen(true);
  };

  const closeAddContact = () => {
    setAddContactOpen(false);
    setAddContactError(null);
  };

  const handleAddContactSave = async () => {
    setAddContactError(null);
    const validated = validateContactPayload(addContactForm);
    if (validated.ok === false) {
      setAddContactError(validated.error);
      return;
    }
    setAddContactSaving(true);
    try {
      const created = await createContact(validated.payload);
      await reloadContacts();
      onChange({ ...form, contactId: created.id });
      setLinkedContact(created);
      setContactPickerOpen(false);
      closeAddContact();
      showSuccessToast("Contact created.");
    } catch (e) {
      setAddContactError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setAddContactSaving(false);
    }
  };

  const setAddContactField = <K extends keyof ContactPayload>(
    key: K,
    val: ContactPayload[K],
  ) => setAddContactForm((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    let cancelled = false;
    const contactId = form.contactId;
    if (contactId == null) {
      setLinkedContact(null);
      return;
    }
    fetchContact(contactId)
      .then((contact) => {
        if (cancelled) return;
        setLinkedContact(contact);
        setContacts((prev) => {
          const idx = prev.findIndex((c) => c.id === contact.id);
          if (idx === -1) return [...prev, contact];
          const next = [...prev];
          next[idx] = contact;
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setLinkedContact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.contactId]);

  const selectedContact = useMemo(() => {
    if (form.contactId == null) return null;
    const id = Number(form.contactId);
    if (linkedContact?.id === id) return linkedContact;
    return contacts.find((c) => c.id === id) ?? null;
  }, [contacts, form.contactId, linkedContact]);

  const defaultContactPhone = useMemo(
    () => (selectedContact ? contactDefaultPhone(selectedContact) : null),
    [selectedContact],
  );

  const defaultContactAddress = useMemo(
    () => (selectedContact ? contactDefaultAddress(selectedContact) : null),
    [selectedContact],
  );

  const bookingEmailDefaults = useMemo((): Partial<EmailPayload> => {
    const to = selectedContact?.email?.trim();
    const subject = form.title.trim()
      ? `Quotation: ${form.title.trim()}`
      : "Quotation details";
    return {
      to: to ? [to] : [],
      subject,
      attachments: form.pdfUrl ? [form.pdfUrl] : [],
    };
  }, [selectedContact, form.title, form.pdfUrl]);

  const paymentLinkEmailDefaults = useMemo((): Partial<EmailPayload> => {
    const to = selectedContact?.email?.trim();
    return {
      to: to ? [to] : [],
      subject: "",
      body: "",
      attachments: [],
    };
  }, [selectedContact]);

  const openPaymentLinkEmailModal = (link: { public_url: string }) => {
    const to = selectedContact?.email?.trim();
    if (!to) {
      showErrorToast(
        "Add a contact with an email address before sending the payment link.",
      );
      return;
    }
    setEmailError(null);
    setPaymentLinkUrlForEmail(link.public_url);
    setEmailPaymentLinkMode(true);
    setEmailModalOpen(true);
  };

  const openBookingEmailModal = async () => {
    setEmailPaymentLinkMode(false);
    setPaymentLinkUrlForEmail(null);
    setEmailError(null);
    if (form.id) {
      try {
        const item = await fetchBookingItem(form.id);
        const pdfUrl = item.pdf_url ?? "";
        if (pdfUrl !== (form.pdfUrl ?? "")) {
          onChange({ ...form, pdfUrl });
        }
      } catch {
        // Keep any pdfUrl already on the form.
      }
    }
    setEmailModalOpen(true);
  };

  const handleDownloadBookingPdf = async () => {
    setPdfDownloading(true);
    try {
      let pdfUrl = (form.pdfUrl ?? "").trim();
      if (form.id) {
        try {
          const item = await fetchBookingItem(form.id);
          pdfUrl = (item.pdf_url ?? "").trim();
          if (pdfUrl !== (form.pdfUrl ?? "").trim()) {
            onChange({ ...form, pdfUrl });
          }
        } catch {
          /* keep form.pdfUrl */
        }
      }
      if (!pdfUrl) {
        showErrorToast(
          "PDF is not available yet. Save the quotation and wait a moment, then try again.",
        );
        return;
      }
      const objectUrl = await fetchSecuredFileBlobUrl(pdfUrl);
      try {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = "quotations.pdf";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      showErrorToast("Could not download the quotation PDF.");
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleOpenAiAssistant = () => {
    setMoreActionsOpen(false);
    if (!hasAiPlusPlan) {
      showErrorToast("AI assistant requires an AI Plus subscription.");
      return;
    }
    if (!aiAvailable) {
      showErrorToast("AI assistant is not configured on the server yet.");
      return;
    }
    setAiPanelOpen(true);
  };

  const handleUseAiEmailDraft = (draft: {
    subject: string;
    body_html: string;
  }) => {
    setEmailAiComposeDefaults({
      subject: draft.subject,
      body: draft.body_html,
    });
    void openBookingEmailModal();
  };

  const handleBookingEmailSend = async (data: EmailPayload) => {
    setEmailSending(true);
    setEmailError(null);
    try {
      let paymentUrl = (paymentLinkUrlForEmail ?? "").trim();
      if (!paymentUrl && form.id != null) {
        try {
          const { links: paymentLinks } = await fetchBookingPaymentLinks(
            form.id,
          );
          const pending = paymentLinks.find((l) => l.status === "pending");
          paymentUrl = (pending ?? paymentLinks[0])?.public_url ?? "";
        } catch {
          paymentUrl = "";
        }
      }
      const mergeContext = buildEmailMergeContext({
        user: emailMergeUser,
        company: emailMergeCompany,
        paymentLinkUrl: paymentUrl,
        quotationId: form.uniqueId?.trim() || form.id,
        quotationTitle: form.title,
        amountPaid: form.paidChargeAmount || form.paidAmount || "0",
      });
      const payload: EmailPayload = {
        ...data,
        subject: applyEmailMergeVariables(data.subject ?? "", mergeContext),
        body: applyEmailMergeVariables(data.body ?? "", mergeContext),
      };
      await sendEmail(payload, userCompanyId, form.id ?? undefined);
      setEmailModalOpen(false);
      setEmailPaymentLinkMode(false);
      setPaymentLinkUrlForEmail(null);
      setEmailLogsRefresh((n) => n + 1);
      showSuccessToast("Email queued for delivery.");
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : "Failed to send email",
      );
    } finally {
      setEmailSending(false);
    }
  };

  useEffect(() => {
    setDismissedApiGroupNames([]);
  }, [form.id, form.mode]);

  const dismissedApiGroupSet = useMemo(
    () => new Set(dismissedApiGroupNames.map(normalizeBookingGroupName)),
    [dismissedApiGroupNames],
  );

  const activeApiGroups = useMemo(
    () =>
      bookingGroups.filter(
        (g) => !dismissedApiGroupSet.has(normalizeBookingGroupName(g.name)),
      ),
    [bookingGroups, dismissedApiGroupSet],
  );

  const groupIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of activeApiGroups) {
      map.set(normalizeBookingGroupName(group.name), group.id);
    }
    for (const field of form.fields) {
      if (field.quotation_group_id != null) {
        map.set(
          normalizeBookingGroupName(field.group_name),
          field.quotation_group_id,
        );
      }
    }
    return map;
  }, [activeApiGroups, form.fields]);

  const fieldGroups = useMemo(
    () =>
      mergeBookingFieldGroups(form.fields, extraGroupNames, activeApiGroups),
    [form.fields, extraGroupNames, activeApiGroups],
  );

  useEffect(() => {
    const namesWithFields = new Set(
      form.fields.map((f) => normalizeBookingGroupName(f.group_name)),
    );
    const emptyFromApi = activeApiGroups
      .map((g) => normalizeBookingGroupName(g.name))
      .filter((name) => !namesWithFields.has(name));
    if (emptyFromApi.length === 0) return;
    setExtraGroupNames((prev) => {
      const merged = [...prev];
      let changed = false;
      for (const name of emptyFromApi) {
        if (!merged.includes(name)) {
          merged.push(name);
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
  }, [activeApiGroups, form.fields]);

  const fieldGroupNamesKey = useMemo(
    () => fieldGroups.map((g) => g.groupName).join("\0"),
    [fieldGroups],
  );

  const accordionSessionKey = `${form.mode}:${form.id ?? "new"}`;
  const multiGroupAccordionInitRef = useRef<string | null>(null);

  useEffect(() => {
    multiGroupAccordionInitRef.current = null;
  }, [accordionSessionKey]);

  useEffect(() => {
    if (fieldGroups.length === 0) {
      setOpenGroups({});
    }
  }, [fieldGroupNamesKey, fieldGroups.length]);

  useEffect(() => {
    if (fieldGroups.length !== 1) return;
    const name = fieldGroups[0].groupName;
    setOpenGroups((prev) =>
      prev[name] === true && Object.keys(prev).length === 1
        ? prev
        : { [name]: true },
    );
  }, [fieldGroupNamesKey, fieldGroups.length, fieldGroups]);

  useEffect(() => {
    if (fieldGroups.length <= 1) return;

    if (multiGroupAccordionInitRef.current !== accordionSessionKey) {
      const next: Record<string, boolean> = {};
      for (const group of fieldGroups) {
        next[group.groupName] = false;
      }
      setOpenGroups(next);
      multiGroupAccordionInitRef.current = accordionSessionKey;
      return;
    }

    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const group of fieldGroups) {
        if (next[group.groupName] === undefined) {
          next[group.groupName] = false;
          changed = true;
        }
      }
      for (const key of Object.keys(next)) {
        if (!fieldGroups.some((g) => g.groupName === key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [accordionSessionKey, fieldGroupNamesKey, fieldGroups]);

  const priceGroups = useMemo(
    () => getBookingPriceGroups(fieldGroups),
    [fieldGroups],
  );
  const priceTotal = useMemo(
    () => sumBookingPriceGroups(priceGroups),
    [priceGroups],
  );
  const pricingAdjustment = useMemo(
    () => quotationPricingAdjustmentFromForm(form),
    [form.discountAmount, form.discountType, form.overrideTotalAmount],
  );
  const effectivePriceTotal = useMemo(
    () => computeQuotationEffectiveTotal(priceTotal, pricingAdjustment),
    [priceTotal, pricingAdjustment],
  );
  const showPaymentsButton =
    !viewOnly &&
    form.mode === "edit" &&
    form.id != null &&
    (bookingStoredTotalAmountHasValue(form.totalAmount) ||
      effectivePriceTotal > 0);
  const hasPricingAdjustment = useMemo(
    () =>
      Boolean(pricingAdjustment.overrideTotalAmount.trim()) ||
      Boolean(pricingAdjustment.discountAmount.trim()),
    [pricingAdjustment],
  );
  const requiredDownpaymentTotal = useMemo(
    () => bookingPriceSummaryRequiredDownpayment(form.fields),
    [form.fields],
  );
  const parseAmount = (raw: string | undefined): number => {
    const n = Number((raw ?? "").trim());
    return !Number.isNaN(n) && n >= 0 ? n : 0;
  };
  const paidTotal = useMemo(
    () => parseAmount(form.paidAmount),
    [form.paidAmount],
  );
  const paidChargeTotal = useMemo(
    () => parseAmount(form.paidChargeAmount),
    [form.paidChargeAmount],
  );
  const paidProcessingTotal = useMemo(
    () => parseAmount(form.paidProcessingFees),
    [form.paidProcessingFees],
  );
  const paidPlatformTotal = useMemo(
    () => parseAmount(form.paidPlatformFees),
    [form.paidPlatformFees],
  );
  const refundedTotal = useMemo(
    () => parseAmount(form.refundedAmount),
    [form.refundedAmount],
  );
  const balanceTotal = effectivePriceTotal;
  const remainingBalance = Math.max(0, balanceTotal - paidTotal);
  const showPaymentBalance =
    form.mode === "edit" && form.id != null && balanceTotal > 0;
  const groupSubtotals = useMemo(
    () => getBookingGroupSubtotalMap(fieldGroups),
    [fieldGroups],
  );

  const activeFormTemplates = useMemo(
    () => templates.filter((t) => t.is_active !== false && t.fields.length > 0),
    [templates],
  );

  const formatFieldPriceAmount = (
    raw: string | null | undefined,
  ): string | null => {
    if (raw === null || raw === undefined || raw === "") return null;
    const amount = Number(raw);
    if (Number.isNaN(amount)) return String(raw);
    return formatCurrency(amount, currencyOptions);
  };

  const getSavedFieldDisplayPrice = (field: BookingField): string | null =>
    formatFieldPriceAmount(resolveBookingFieldPriceRaw(field));

  const getSavedFieldDisplayDownpayment = (
    field: BookingField,
  ): string | null => {
    if (!field.saved) return null;
    const raw =
      field.field_type === "supplier"
        ? field.packageRequiredDownpayment
        : field.requiredDownpayment;
    if (raw === null || raw === undefined || raw === "") return null;
    return formatFieldPriceAmount(raw);
  };

  useEffect(() => {
    if (viewOnly || hasPricingAdjustment) return;
    const next = effectivePriceTotal.toFixed(2);
    if ((form.totalAmount ?? "").trim() === next) return;
    onChange({ ...form, totalAmount: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePriceTotal, hasPricingAdjustment, viewOnly, form.fields]);

  // Restore draft on mount (create only — edit keeps server contact/status)
  useEffect(() => {
    originalFormJson.current = JSON.stringify(form);
    if (form.mode !== "create") return;
    const key = draftKey(form.id);
    const draft = loadDraft(key);
    if (draft && isDraftNonEmpty(draft)) {
      onChange({ ...form, ...draft });
      setRestoredDraft(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New quotations: pre-fill fields from the default form template when none exist.
  useEffect(() => {
    if (form.mode !== "create" || createSeededRef.current || restoredDraft)
      return;
    if (form.fields.length > 0) return;
    const tpl =
      templates.find((t) => t.is_default && t.is_active !== false) ??
      templates.find((t) => t.is_active !== false);
    if (!tpl?.fields?.length) return;
    createSeededRef.current = true;
    onChange({
      ...form,
      fields: templateFieldsToBookingFields(tpl, defaultGroupName),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.mode,
    form.fields.length,
    restoredDraft,
    templates,
    defaultGroupName,
  ]);

  // Auto-save draft on every form change (skip initial render)
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const key = draftKey(form.id);
    if (isDraftNonEmpty(form)) {
      saveDraft(key, form);
    } else {
      localStorage.removeItem(key);
    }
  }, [form]);

  const templateFieldsToBookingFields = (
    tpl: BookingTemplate,
    groupName: string,
  ): BookingField[] => {
    const normalized = normalizeBookingGroupName(groupName);
    const quotation_group_id = groupIdByName.get(normalized) ?? null;
    const baseOrder = form.fields.length;
    return tpl.fields.map((f, idx) => ({
      label: f.label,
      group_name: normalized,
      quotation_group_id,
      field_type: f.field_type,
      is_required: f.is_required,
      options: f.options.map((o) => ({
        label: o.label,
        price: o.price,
        sort_order: o.sort_order,
      })),
      price: f.price,
      requiredDownpayment: null,
      sort_order: baseOrder + idx,
      saved: true,
      value: "",
      supplier_type_id: f.supplier_type ?? null,
    }));
  };

  const handleReset = () => {
    const key = draftKey(form.id);
    localStorage.removeItem(key);
    setRestoredDraft(false);
    onChange(JSON.parse(originalFormJson.current) as BookingFormState);
  };

  const addFieldToGroup = (groupName: string) => {
    const normalized = normalizeBookingGroupName(groupName);
    const quotation_group_id = groupIdByName.get(normalized) ?? null;
    onChange({
      ...form,
      fields: [
        ...form.fields,
        {
          ...EMPTY_FIELD,
          group_name: normalized,
          quotation_group_id,
          sort_order: form.fields.length,
        },
      ],
    });
  };

  const groupNameNormalized = (groupName: string) =>
    normalizeBookingGroupName(groupName);

  const isManagingGroup = (groupName: string) =>
    managingGroup === groupNameNormalized(groupName);

  const countUnsavedInGroup = (groupName: string) =>
    form.fields.filter(
      (f) =>
        groupNameNormalized(f.group_name) === groupNameNormalized(groupName) &&
        !f.saved,
    ).length;

  const openManageGroup = (groupName: string) => {
    const norm = groupNameNormalized(groupName);
    setManagingGroup(norm);
    setOpenGroups((prev) => ({ ...prev, [norm]: true }));
  };

  const addCustomFieldToGroup = (groupName: string) => {
    openManageGroup(groupName);
    addFieldToGroup(groupName);
  };

  const applyTemplateToGroup = (groupName: string, templateId: number) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl?.fields.length) return;
    openManageGroup(groupName);
    const normalized = groupNameNormalized(groupName);
    const quotation_group_id = groupIdByName.get(normalized) ?? null;
    const baseOrder = form.fields.length;
    const appended = tpl.fields.map((f, idx) => ({
      label: f.label,
      group_name: normalized,
      quotation_group_id,
      field_type: f.field_type,
      is_required: f.is_required,
      options: f.options.map((o) => ({
        label: o.label,
        price: o.price,
        sort_order: o.sort_order,
      })),
      price: f.price,
      requiredDownpayment: null,
      sort_order: baseOrder + idx,
      saved: true,
      value: "",
      supplier_type_id: f.supplier_type ?? null,
    }));
    onChange({ ...form, fields: [...form.fields, ...appended] });
  };

  const finishManagingGroup = (groupName: string) => {
    const norm = groupNameNormalized(groupName);
    const indices = form.fields
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => groupNameNormalized(f.group_name) === norm);
    const { fields: finalized, error } = finalizeBookingFieldDefinitions(
      indices.map(({ f }) => f),
    );
    if (error) {
      showErrorToast(error);
      return;
    }
    onChange({
      ...form,
      fields: form.fields.map((f, i) => {
        const pos = indices.findIndex(({ i: fieldIdx }) => fieldIdx === i);
        if (pos === -1) return f;
        return finalized[pos];
      }),
    });
    setManagingGroup(null);
  };

  const cancelManagingGroup = () => {
    const norm = managingGroup;
    if (!norm) return;
    const draftIndices = form.fields
      .map((f, i) => ({ f, i }))
      .filter(
        ({ f }) => groupNameNormalized(f.group_name) === norm && !f.saved,
      );
    if (draftIndices.length > 0) {
      onChange({
        ...form,
        fields: form.fields.filter(
          (_, i) => !draftIndices.some((d) => d.i === i),
        ),
      });
    }
    setManagingGroup(null);
  };

  const removeGroupFromForm = (normalized: string) => {
    const nextFields = form.fields.filter(
      (f) => normalizeBookingGroupName(f.group_name) !== normalized,
    );
    const nextExtra = extraGroupNames.filter(
      (n) => normalizeBookingGroupName(n) !== normalized,
    );
    setExtraGroupNames(nextExtra);
    onChange({ ...form, fields: nextFields, extraGroupNames: nextExtra });
  };

  const deleteFieldGroup = async (groupName: string) => {
    const normalized = normalizeBookingGroupName(groupName);
    const result = await Swal.fire({
      title: `Delete "${groupName}"?`,
      text: "This will permanently delete the group and all fields in it.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d65a5a",
    });
    if (!result.isConfirmed) return;

    const groupId = groupIdByName.get(normalized);
    if (
      form.mode === "edit" &&
      form.id != null &&
      groupId != null &&
      onDeleteGroup
    ) {
      try {
        await onDeleteGroup(form.id, groupId);
      } catch {
        await Swal.fire("Error", "Failed to delete group.", "error");
        return;
      }
    }
    removeGroupFromForm(normalized);
  };

  const toggleFieldGroup = (groupName: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const openAddGroupModal = () => {
    setGroupNameInput("");
    setGroupNameError(null);
    setAddGroupTemplateId(null);
    setGroupNameModal({ type: "add" });
  };

  const openEditGroupModal = (originalName: string) => {
    setGroupNameInput(originalName);
    setGroupNameError(null);
    setAddGroupTemplateId(null);
    setGroupNameModal({ type: "edit", originalName });
  };

  const closeGroupNameModal = () => {
    setGroupNameModal(null);
    setGroupNameInput("");
    setGroupNameError(null);
    setAddGroupTemplateId(null);
  };

  const dedupeGroupNames = (names: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of names) {
      const norm = normalizeBookingGroupName(raw);
      if (seen.has(norm)) continue;
      seen.add(norm);
      result.push(norm);
    }
    return result;
  };

  const renameBookingGroup = (oldName: string, newName: string) => {
    const oldNorm = normalizeBookingGroupName(oldName);
    const newNorm = normalizeBookingGroupName(newName);
    if (oldNorm === newNorm) return;

    const nextFields = form.fields.map((f) =>
      normalizeBookingGroupName(f.group_name) === oldNorm
        ? { ...f, group_name: newNorm }
        : f,
    );
    const nextExtra = dedupeGroupNames(
      extraGroupNames.map((n) =>
        normalizeBookingGroupName(n) === oldNorm ? newNorm : n,
      ),
    );
    setDismissedApiGroupNames((prev) => {
      const next = new Set(prev.map(normalizeBookingGroupName));
      next.add(oldNorm);
      next.delete(newNorm);
      return [...next];
    });
    setExtraGroupNames(nextExtra);
    onChange({ ...form, fields: nextFields, extraGroupNames: nextExtra });
  };

  const handleGroupNameSave = () => {
    const name = normalizeBookingGroupName(groupNameInput);
    if (!groupNameInput.trim()) {
      setGroupNameError(`Enter a ${groupLabel} name.`);
      return;
    }

    if (groupNameModal?.type === "add") {
      if (fieldGroups.some((g) => g.groupName === name)) {
        setGroupNameError(
          `A ${groupLabel} group with that name already exists.`,
        );
        return;
      }
      const nextExtra = [...extraGroupNames, name];
      setExtraGroupNames(nextExtra);
      let nextFields = form.fields;
      if (addGroupTemplateId != null) {
        const tpl = templates.find((t) => t.id === addGroupTemplateId);
        if (tpl && tpl.fields.length > 0) {
          nextFields = [
            ...form.fields,
            ...templateFieldsToBookingFields(tpl, name),
          ];
        }
      }
      onChange({ ...form, fields: nextFields, extraGroupNames: nextExtra });
      closeGroupNameModal();
      return;
    }

    if (groupNameModal?.type === "edit") {
      const oldNorm = normalizeBookingGroupName(groupNameModal.originalName);
      if (name !== oldNorm && fieldGroups.some((g) => g.groupName === name)) {
        setGroupNameError(
          `A ${groupLabel} group with that name already exists.`,
        );
        return;
      }
      renameBookingGroup(groupNameModal.originalName, name);
      closeGroupNameModal();
    }
  };

  const updateField = (idx: number, patch: Partial<BookingField>) => {
    onChange({
      ...form,
      fields: form.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    });
  };

  const removeField = (idx: number) => {
    onChange({
      ...form,
      fields: form.fields.filter((_, i) => i !== idx),
    });
  };

  const addOption = (fieldIdx: number) => {
    updateField(fieldIdx, {
      options: [
        ...form.fields[fieldIdx].options,
        { ...EMPTY_OPTION, sort_order: form.fields[fieldIdx].options.length },
      ],
    });
  };

  const updateOption = (
    fieldIdx: number,
    optIdx: number,
    patch: Partial<BookingField["options"][number]>,
  ) => {
    const updated = form.fields[fieldIdx].options.map((o, i) =>
      i === optIdx ? { ...o, ...patch } : o,
    );
    updateField(fieldIdx, { options: updated });
  };

  const removeOption = (fieldIdx: number, optIdx: number) => {
    updateField(fieldIdx, {
      options: form.fields[fieldIdx].options.filter((_, i) => i !== optIdx),
    });
  };

  const clearFieldDrag = () => {
    fieldDragIdxRef.current = null;
    setDragIdx(null);
    setFieldDragOver(null);
  };

  const resolveFieldDragSourceIdx = (
    e: DragEvent<HTMLElement>,
  ): number | null => {
    const fromRef = fieldDragIdxRef.current;
    if (fromRef !== null) return fromRef;
    try {
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const handleFieldDragStart = (e: DragEvent<HTMLElement>, idx: number) => {
    fieldDragIdxRef.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(idx));
    } catch {
      /* noop */
    }
  };

  const handleSavedFieldDragOver = (e: DragEvent<HTMLElement>, idx: number) => {
    if (fieldDragIdxRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (fieldDragOver?.kind !== "field" || fieldDragOver.idx !== idx) {
      setFieldDragOver({ kind: "field", idx });
    }
  };

  const handleGroupEndDragOver = (
    e: DragEvent<HTMLElement>,
    groupName: string,
  ) => {
    if (fieldDragIdxRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const norm = normalizeBookingGroupName(groupName);
    if (
      fieldDragOver?.kind !== "group-end" ||
      fieldDragOver.groupName !== norm
    ) {
      setFieldDragOver({ kind: "group-end", groupName: norm });
    }
  };

  const handleFieldDrop = (
    e: DragEvent<HTMLElement>,
    targetIdx: number,
    targetGroupName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIdx = resolveFieldDragSourceIdx(e);
    if (sourceIdx === null) {
      clearFieldDrag();
      return;
    }
    const nextFields = applyBookingFieldMove(
      form.fields,
      sourceIdx,
      targetIdx,
      targetGroupName,
      groupIdByName,
    );
    onChange({ ...form, fields: nextFields });
    clearFieldDrag();
  };

  const handleGroupEndDrop = (
    e: DragEvent<HTMLElement>,
    targetGroupName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIdx = resolveFieldDragSourceIdx(e);
    if (sourceIdx === null) {
      clearFieldDrag();
      return;
    }
    const nextFields = applyBookingFieldMoveToGroupEnd(
      form.fields,
      sourceIdx,
      targetGroupName,
      groupIdByName,
    );
    onChange({ ...form, fields: nextFields });
    clearFieldDrag();
  };

  const handleFieldDragEnd = () => {
    // Drop may fire after dragend in some browsers; defer clearing state.
    window.setTimeout(() => clearFieldDrag(), 0);
  };

  const handleFieldBuilderDragOver = (
    e: DragEvent<HTMLElement>,
    idx: number,
  ) => {
    if (fieldDragIdxRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (fieldDragOver?.kind !== "field" || fieldDragOver.idx !== idx) {
      setFieldDragOver({ kind: "field", idx });
    }
  };

  const renderGroupDropZone = (groupName: string) => {
    if (viewOnly) return null;
    const norm = normalizeBookingGroupName(groupName);
    const isActive = dragIdx !== null;
    const isOver =
      fieldDragOver?.kind === "group-end" && fieldDragOver.groupName === norm;
    return (
      <div
        className={`booking-fields-group-drop-zone${isActive ? " is-active" : ""}${isOver ? " is-drag-over" : ""}`}
        onDragOver={(e) => handleGroupEndDragOver(e, norm)}
        onDrop={(e) => handleGroupEndDrop(e, norm)}
        aria-hidden={!isActive}
      >
        <span className="booking-fields-group-drop-zone__label">
          <i className="bi bi-arrows-move me-1" aria-hidden="true" />
          Drop here to move to end of {norm}
        </span>
      </div>
    );
  };

  const renderDraggableSavedField = (
    field: BookingField,
    idx: number,
    showSchemaActions: boolean,
    groupName: string,
  ) => {
    const isDragging = dragIdx === idx;
    const isDragOver =
      fieldDragOver?.kind === "field" && fieldDragOver.idx === idx;
    return (
      <div
        key={idx}
        className={`booking-saved-field-row${isDragOver ? " is-drag-over" : ""}${isDragging ? " is-dragging" : ""}`}
        onDragOver={
          viewOnly ? undefined : (e) => handleSavedFieldDragOver(e, idx)
        }
        onDrop={
          viewOnly ? undefined : (e) => handleFieldDrop(e, idx, groupName)
        }
      >
        {!viewOnly && (
          <span
            className="booking-field-drag-handle"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleFieldDragStart(e, idx);
            }}
            onDragEnd={handleFieldDragEnd}
            title="Drag to reorder or move to another group"
            aria-label="Drag to reorder or move to another group"
          >
            <i className="bi bi-grip-vertical" aria-hidden="true" />
          </span>
        )}
        <div
          className="booking-saved-field flex-grow-1"
          onDragOver={
            viewOnly ? undefined : (e) => handleSavedFieldDragOver(e, idx)
          }
          onDrop={
            viewOnly ? undefined : (e) => handleFieldDrop(e, idx, groupName)
          }
        >
          {renderSavedField(field, idx, showSchemaActions)}
        </div>
      </div>
    );
  };

  const editField = (idx: number) => {
    const field = form.fields[idx];
    openManageGroup(field.group_name);
    updateField(idx, { saved: false });
  };

  const renderUnsavedFieldCard = (idx: number, groupName: string) => {
    const field = form.fields[idx];
    const showPricing =
      field.field_type !== "select" && field.field_type !== "supplier";
    const isSupplierField = field.field_type === "supplier";
    const supplierTypeSelectOptions = supplierTypes.map((type) => ({
      value: String(type.id),
      label: type.name,
    }));
    return (
      <div
        key={idx}
        className={`booking-field-builder${fieldDragOver?.kind === "field" && fieldDragOver.idx === idx ? " is-drag-over" : ""}${dragIdx === idx ? " is-dragging" : ""}`}
        onDragOver={(e) => handleFieldBuilderDragOver(e, idx)}
        onDrop={(e) => handleFieldDrop(e, idx, groupName)}
      >
        <div className="booking-field-builder__head">
          <span
            className="booking-field-drag-handle booking-field-builder__grip"
            draggable={!viewOnly}
            onDragStart={(e) => {
              e.stopPropagation();
              handleFieldDragStart(e, idx);
            }}
            onDragEnd={handleFieldDragEnd}
            title="Drag to reorder or move to another group"
            aria-label="Drag to reorder or move to another group"
          >
            <i className="bi bi-grip-vertical" aria-hidden="true" />
          </span>
          <span className="booking-field-builder__title">
            {field.label.trim() || "New field"}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-link text-danger p-0"
            title="Remove field"
            onClick={() => removeField(idx)}
          >
            <i className="bi bi-trash" aria-hidden="true" />
          </button>
        </div>
        <div className="row g-2">
          <div className="col-md-5">
            <label className="form-label">Label *</label>
            <input
              className="form-control form-control-sm"
              placeholder="e.g. Venue package"
              value={field.label}
              onChange={(e) => updateField(idx, { label: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Type</label>
            <select
              className="form-select form-select-sm"
              value={field.field_type}
              onChange={(e) => {
                const field_type = e.target.value as FieldType;
                if (field_type === "supplier") {
                  updateField(idx, {
                    field_type,
                    price: null,
                    requiredDownpayment: null,
                    supplier_type_id: null,
                    value: "",
                    options: [],
                  });
                  return;
                }
                if (field_type === "select") {
                  updateField(idx, {
                    field_type,
                    price: null,
                    supplier_type_id: null,
                    value: "",
                    options:
                      field.options.length > 0
                        ? field.options
                        : [{ ...EMPTY_OPTION }],
                  });
                  return;
                }
                updateField(idx, { field_type, supplier_type_id: null });
              }}
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <div className="form-check mb-1">
              <input
                className="form-check-input"
                type="checkbox"
                id={`booking-req-${idx}`}
                checked={field.is_required}
                onChange={(e) =>
                  updateField(idx, { is_required: e.target.checked })
                }
              />
              <label
                className="form-check-label"
                htmlFor={`booking-req-${idx}`}
              >
                Required
              </label>
            </div>
          </div>
        </div>

        {isSupplierField && (
          <div className="row g-2 mt-0 booking-field-builder__supplier-type-row">
            <div className="col-md-5 d-none d-md-block" aria-hidden="true" />
            <div className="col-12 col-md-4">
              <SearchableSelect
                label="Supplier type"
                labelClassName="form-label mb-1"
                wrapperClassName="booking-field-builder__supplier-type"
                size="sm"
                value={
                  field.supplier_type_id != null
                    ? String(field.supplier_type_id)
                    : ""
                }
                onChange={(next) =>
                  updateField(idx, {
                    supplier_type_id: next === "" ? null : Number(next),
                  })
                }
                options={supplierTypeSelectOptions}
                placeholder="Choose supplier type…"
                searchPlaceholder="Search supplier types…"
                required
                loading={supplierTypesLoading}
                emptyMessage="No supplier types match your search"
              />
            </div>
          </div>
        )}

        {(showPricing || field.field_type === "select") && (
          <div className="row g-2 mt-0">
            {showPricing && (
              <>
                <div className="col-sm-6">
                  <label className="form-label">Price</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={field.price ?? ""}
                    onChange={(e) =>
                      updateField(idx, {
                        price: e.target.value === "" ? null : e.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label">Downpayment</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={field.requiredDownpayment ?? ""}
                    onChange={(e) =>
                      updateField(idx, {
                        requiredDownpayment:
                          e.target.value === "" ? null : e.target.value,
                      })
                    }
                  />
                </div>
              </>
            )}
            {field.field_type === "select" && (
              <div className="col-sm-6">
                <label className="form-label">Downpayment</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={field.requiredDownpayment ?? ""}
                  onChange={(e) =>
                    updateField(idx, {
                      requiredDownpayment:
                        e.target.value === "" ? null : e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>
        )}

        {field.field_type === "select" && (
          <div className="booking-field-builder__options mt-2">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <small className="text-muted fw-semibold mb-0">
                Dropdown options
              </small>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => addOption(idx)}
              >
                <i className="bi bi-plus-lg me-1" aria-hidden="true" />
                Add option
              </button>
            </div>
            {field.options.length === 0 && (
              <p className="text-muted small mb-0">Add at least one option.</p>
            )}
            {field.options.map((opt, optIdx) => (
              <div key={optIdx} className="row g-1 mb-1 align-items-center">
                <div className="col">
                  <input
                    className="form-control form-control-sm"
                    placeholder={`Option ${optIdx + 1}`}
                    value={opt.label}
                    onChange={(e) =>
                      updateOption(idx, optIdx, { label: e.target.value })
                    }
                  />
                </div>
                <div className="col-auto" style={{ width: "110px" }}>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Price"
                    step="0.01"
                    min="0"
                    value={opt.price ?? ""}
                    onChange={(e) =>
                      updateOption(idx, optIdx, {
                        price: e.target.value === "" ? null : e.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    title="Remove option"
                    onClick={() => removeOption(idx, optIdx)}
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSavedField = (
    field: BookingField,
    idx: number,
    showSchemaActions: boolean,
  ) => {
    const requiredMark = field.is_required ? " *" : "";
    const fieldLabel = `${field.label}${requiredMark}`;
    const displayPrice = getSavedFieldDisplayPrice(field);
    const displayDownpayment = getSavedFieldDisplayDownpayment(field);

    return (
      <div className="booking-saved-field">
        <div className="booking-field-header">
          <label className="form-label mb-0 booking-field-header__label">
            {fieldLabel}
          </label>
          <div className="booking-field-header__end">
            {displayDownpayment && (
              <span className="booking-field-downpayment text-muted small">
                Down {displayDownpayment}
              </span>
            )}
            {displayPrice && (
              <span className="booking-field-price">{displayPrice}</span>
            )}
            {showSchemaActions && (
              <div className="d-flex gap-1">
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0"
                  title="Edit field definition"
                  onClick={() => editField(idx)}
                >
                  <i className="bi bi-pencil-square" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-danger"
                  title="Remove field"
                  onClick={() => removeField(idx)}
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            )}
          </div>
        </div>
        {field.field_type === "text" && (
          <input
            type="text"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === "textarea" && (
          <textarea
            className="form-control"
            rows={2}
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === "number" && (
          <input
            type="number"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === "date" && (
          <input
            type="date"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === "time" && (
          <input
            type="time"
            className="form-control"
            step={60}
            value={storedValueToTimeInput(field.value)}
            onChange={(e) =>
              updateField(idx, { value: timeInputToStored(e.target.value) })
            }
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === "email" && (
          <input
            type="email"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === "phone" && (
          <input
            type="tel"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === "checkbox" && (
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id={`booking-field-${idx}`}
              checked={field.value === "true"}
              onChange={(e) =>
                updateField(idx, { value: e.target.checked ? "true" : "" })
              }
              required={field.is_required && field.value !== "true"}
              {...readOnlyFieldProps}
            />
            <label
              className="form-check-label"
              htmlFor={`booking-field-${idx}`}
            >
              {field.label}
            </label>
          </div>
        )}
        {field.field_type === "select" && (
          <select
            className="form-select"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          >
            <option value="">Select...</option>
            {field.options
              .filter((o) => o.label.trim())
              .map((opt, oi) => {
                const optionPrice = formatFieldPriceAmount(opt.price);
                return (
                  <option key={oi} value={opt.label}>
                    {opt.label}
                    {optionPrice ? ` — ${optionPrice}` : ""}
                  </option>
                );
              })}
          </select>
        )}
        {field.field_type === "supplier" && (
          <SupplierFieldInput
            value={field.value}
            dateOfEvent={form.dateOfEvent}
            excludeQuotationId={form.mode === "edit" ? form.id : null}
            fixedSupplierTypeId={field.supplier_type_id ?? null}
            onChange={(value, price, packageRequiredDownpayment) =>
              updateField(idx, {
                value,
                price: price ?? null,
                packageRequiredDownpayment: packageRequiredDownpayment ?? null,
              })
            }
            required={field.is_required}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className="booking-edit-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="booking-edit-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookingEditTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable booking-edit-modal-dialog">
          <div className="modal-content">
            <form
              onSubmit={(e) => {
                if (viewOnly || loadingDetails) {
                  e.preventDefault();
                  return;
                }
                if (saving) {
                  e.preventDefault();
                  return;
                }
                if (managingGroup) {
                  e.preventDefault();
                  showErrorToast(
                    "Click Done on the section you are customizing before saving the quotation.",
                  );
                  return;
                }
                void onSubmit(e);
              }}
              noValidate
            >
              <div className="modal-header">
                <div className="me-auto">
                  <h1 id="bookingEditTitle" className="modal-title fs-5 mb-0">
                    {form.mode === "create"
                      ? "New quotation"
                      : viewOnly
                        ? "View quotation"
                        : "Edit quotation"}
                  </h1>
                  {form.mode === "edit" && form.id != null && (
                    <p className="booking-edit-modal__booking-id text-muted small mb-0 mt-1">
                      Quotation ID:{" "}
                      <span className="text-body">
                        {(form.uniqueId ?? "").trim() || `#${form.id}`}
                      </span>
                    </p>
                  )}
                </div>
                <div
                  ref={moreActionsRef}
                  className={`dropdown booking-edit-modal-header__more${
                    moreActionsOpen ? " show" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="btn btn-link booking-edit-modal-header__more-btn"
                    aria-label="More actions"
                    aria-expanded={moreActionsOpen}
                    onClick={() => setMoreActionsOpen((open) => !open)}
                  >
                    <i
                      className="bi bi-three-dots-vertical"
                      aria-hidden="true"
                    />
                  </button>
                  <ul
                    className={`dropdown-menu dropdown-menu-end${
                      moreActionsOpen ? " show" : ""
                    }`}
                  >
                    {form.mode === "edit" && !viewOnly && (
                      <>
                        {showPaymentsButton && (
                          <li>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setMoreActionsOpen(false);
                                setPaymentsModalOpen(true);
                              }}
                            >
                              <i
                                className="bi bi-credit-card me-2"
                                aria-hidden="true"
                              />
                              Payments
                            </button>
                          </li>
                        )}
                        <li>
                          <button
                            type="button"
                            className="dropdown-item"
                            disabled={!onSendToCalendar}
                            onClick={() => {
                              setMoreActionsOpen(false);
                              onSendToCalendar?.();
                            }}
                          >
                            <i
                              className="bi bi-calendar-event me-2"
                              aria-hidden="true"
                            />
                            Send to Calendar
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              setMoreActionsOpen(false);
                              void openBookingEmailModal();
                            }}
                          >
                            <i
                              className="bi bi-envelope me-2"
                              aria-hidden="true"
                            />
                            Send email to client
                          </button>
                        </li>
                        {hasAiPlusPlan && (
                          <li>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={handleOpenAiAssistant}
                            >
                              <i
                                className="bi bi-stars me-2"
                                aria-hidden="true"
                              />
                              AI Assistant
                            </button>
                          </li>
                        )}
                        <li>
                          <button
                            type="button"
                            className="dropdown-item"
                            disabled={pdfDownloading || form.id == null}
                            onClick={() => {
                              setMoreActionsOpen(false);
                              void handleDownloadBookingPdf();
                            }}
                          >
                            <i
                              className="bi bi-file-earmark-arrow-down me-2"
                              aria-hidden="true"
                            />
                            Download quotation PDF
                          </button>
                        </li>
                        <li>
                          <hr className="dropdown-divider" />
                        </li>
                      </>
                    )}
                    {form.mode === "edit" && viewOnly && (
                      <>
                        <li>
                          <button
                            type="button"
                            className="dropdown-item"
                            disabled={pdfDownloading || form.id == null}
                            onClick={() => {
                              setMoreActionsOpen(false);
                              void handleDownloadBookingPdf();
                            }}
                          >
                            <i
                              className="bi bi-file-earmark-arrow-down me-2"
                              aria-hidden="true"
                            />
                            Download quotation PDF
                          </button>
                        </li>
                        <li>
                          <hr className="dropdown-divider" />
                        </li>
                      </>
                    )}
                    <li>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setMoreActionsOpen(false);
                          onClose();
                        }}
                      >
                        <i className="bi bi-x-lg me-2" aria-hidden="true" />
                        Close
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="modal-body booking-edit-modal__body">
                {loadingDetails && (
                  <div
                    className="booking-edit-modal__loading"
                    role="status"
                    aria-live="polite"
                  >
                    <div
                      className="spinner-border text-primary"
                      aria-hidden="true"
                    />
                    <span className="visually-hidden">Loading quotation…</span>
                  </div>
                )}
                {viewOnly && modalTab === "details" && (
                  <div
                    className="alert alert-info py-2 small mb-3"
                    role="status"
                  >
                    This booking belongs to{" "}
                    <span className="fw-semibold">
                      {(form.companyName ?? "").trim() || "another company"}
                    </span>
                    . You can view details and download the PDF only.
                  </div>
                )}
                {showHistoryTab && (
                  <ul
                    className="nav nav-tabs booking-edit-modal-tabs mb-3"
                    role="tablist"
                  >
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        role="tab"
                        className={`nav-link${modalTab === "details" ? " active" : ""}`}
                        aria-selected={modalTab === "details"}
                        onClick={() => setModalTab("details")}
                      >
                        Details
                      </button>
                    </li>
                    {showDocumentsTab && (
                      <li className="nav-item" role="presentation">
                        <button
                          type="button"
                          role="tab"
                          className={`nav-link${modalTab === "documents" ? " active" : ""}`}
                          aria-selected={modalTab === "documents"}
                          onClick={() => setModalTab("documents")}
                        >
                          Documents
                        </button>
                      </li>
                    )}
                    {showEmailLogsTab && (
                      <li className="nav-item" role="presentation">
                        <button
                          type="button"
                          role="tab"
                          className={`nav-link${modalTab === "email_logs" ? " active" : ""}`}
                          aria-selected={modalTab === "email_logs"}
                          onClick={() => setModalTab("email_logs")}
                        >
                          Email Logs
                        </button>
                      </li>
                    )}
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        role="tab"
                        className={`nav-link${modalTab === "history" ? " active" : ""}`}
                        aria-selected={modalTab === "history"}
                        onClick={() => setModalTab("history")}
                      >
                        History
                      </button>
                    </li>
                  </ul>
                )}
                {modalTab === "history" && showHistoryTab && form.id != null ? (
                  <BookingHistoryPanel
                    bookingId={form.id}
                    refreshKey={historyRefreshKey + localHistoryRefresh}
                  />
                ) : modalTab === "documents" &&
                  showDocumentsTab &&
                  form.id != null ? (
                  <QuotationDocumentsPanel
                    quotationId={form.id}
                    readOnly={viewOnly}
                    onHistoryChange={() => setLocalHistoryRefresh((n) => n + 1)}
                  />
                ) : modalTab === "email_logs" &&
                  showEmailLogsTab &&
                  form.id != null ? (
                  <QuotationEmailLogsPanel
                    quotationId={form.id}
                    quotationLabel={
                      form.uniqueId?.trim()
                        ? `${form.title.trim() || "Quotation"} (${form.uniqueId.trim()})`
                        : form.title.trim() || undefined
                    }
                    refreshKey={emailLogsRefresh}
                  />
                ) : (
                  <fieldset
                    className={`booking-edit-modal__fieldset${
                      viewOnly ? " is-view-only" : ""
                    }`}
                  >
                    {restoredDraft && !viewOnly && (
                      <div
                        className="alert alert-info py-2 mb-3 d-flex align-items-center"
                        role="status"
                      >
                        <i className="bi bi-save me-2" />
                        <span className="flex-grow-1">
                          Your previous draft has been restored. Click Reset to
                          discard it and start fresh.
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning ms-2"
                          onClick={handleReset}
                        >
                          <i className="bi bi-arrow-counterclockwise me-1" />
                          Reset
                        </button>
                      </div>
                    )}
                    <div className="row align-items-stretch">
                      <div className="col-md-9">
                        <div className="mb-3">
                          <label htmlFor="booking-title" className="form-label">
                            Title
                          </label>
                          <input
                            id="booking-title"
                            type="text"
                            className="form-control"
                            value={form.title}
                            onChange={(e) =>
                              onChange({ ...form, title: e.target.value })
                            }
                            required
                            autoFocus
                            {...readOnlyFieldProps}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Date of event</label>
                          <div className="d-flex gap-2">
                            <input
                              id="booking-date"
                              type="date"
                              className="form-control"
                              value={form.dateOfEvent}
                              onChange={(e) =>
                                onChange({
                                  ...form,
                                  dateOfEvent: e.target.value,
                                })
                              }
                              {...readOnlyFieldProps}
                            />
                            <input
                              id="booking-time"
                              type="time"
                              className="form-control"
                              value={form.timeOfEvent}
                              onChange={(e) =>
                                onChange({
                                  ...form,
                                  timeOfEvent: e.target.value,
                                })
                              }
                              {...readOnlyFieldProps}
                            />
                          </div>
                        </div>
                        <div
                          className={`mb-3 booking-fields-groups${dragIdx !== null ? " is-field-dragging" : ""}`}
                          onDragOver={
                            viewOnly
                              ? undefined
                              : (e) => {
                                  if (fieldDragIdxRef.current === null) return;
                                  e.preventDefault();
                                }
                          }
                        >
                          <p className="text-muted small mb-2">
                            Fill in line items below. Drag the{" "}
                            <i
                              className="bi bi-grip-vertical"
                              aria-hidden="true"
                            />{" "}
                            handle to reorder fields or move them between{" "}
                            {groupLabel.toLowerCase()}s. Use{" "}
                            <span className="fw-semibold">
                              Customize fields
                            </span>{" "}
                            to change labels, types, or pricing.
                          </p>
                          {!viewOnly && (
                            <div className="booking-fields-groups-toolbar">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={openAddGroupModal}
                              >
                                + Add {groupLabel}
                              </button>
                            </div>
                          )}
                          <ul className="faq-list booking-fields-group-list">
                            {fieldGroups.map((group) => {
                              const isOpen =
                                openGroups[group.groupName] ?? false;
                              const subtotal =
                                groupSubtotals.get(group.groupName) ?? 0;
                              const managing = isManagingGroup(group.groupName);
                              const unsavedCount = countUnsavedInGroup(
                                group.groupName,
                              );
                              const savedItems = group.items.filter(
                                ({ field }) => field.saved,
                              );
                              const isGroupDragTarget =
                                dragIdx !== null &&
                                fieldDragOver?.kind === "group-end" &&
                                fieldDragOver.groupName === group.groupName;
                              return (
                                <li
                                  key={group.groupName}
                                  className={`faq-item${isOpen ? " is-open" : ""}${
                                    managing ? " is-managing-fields" : ""
                                  }${isGroupDragTarget ? " is-field-drop-target" : ""}`}
                                >
                                  <div
                                    className={`booking-fields-group-head${isGroupDragTarget ? " is-drag-over" : ""}`}
                                    onDragOver={
                                      viewOnly
                                        ? undefined
                                        : (e) =>
                                            handleGroupEndDragOver(
                                              e,
                                              group.groupName,
                                            )
                                    }
                                    onDrop={
                                      viewOnly
                                        ? undefined
                                        : (e) =>
                                            handleGroupEndDrop(
                                              e,
                                              group.groupName,
                                            )
                                    }
                                  >
                                    <button
                                      type="button"
                                      className="faq-toggle booking-fields-group-toggle"
                                      aria-expanded={isOpen}
                                      onClick={() =>
                                        toggleFieldGroup(group.groupName)
                                      }
                                    >
                                      <span
                                        className="faq-icon"
                                        aria-hidden="true"
                                      >
                                        <i className="bi bi-collection" />
                                      </span>
                                      <span className="faq-question-row">
                                        <span className="faq-question">
                                          {group.groupName}
                                        </span>
                                        <span className="booking-fields-group-meta">
                                          {savedItems.length > 0 && (
                                            <span className="booking-fields-group-count">
                                              {savedItems.length} field
                                              {savedItems.length !== 1
                                                ? "s"
                                                : ""}
                                            </span>
                                          )}
                                          <span className="booking-fields-group-subtotal">
                                            {formatCurrency(
                                              subtotal,
                                              currencyOptions,
                                            )}
                                          </span>
                                        </span>
                                      </span>
                                      <span
                                        className="faq-chevron"
                                        aria-hidden="true"
                                      >
                                        <i className="bi bi-chevron-down" />
                                      </span>
                                    </button>
                                    {!viewOnly && !managing && (
                                      <button
                                        type="button"
                                        className="booking-fields-group-edit btn btn-link"
                                        aria-label={`Rename ${group.groupName}`}
                                        title={`Rename ${group.groupName}`}
                                        onClick={() =>
                                          openEditGroupModal(group.groupName)
                                        }
                                      >
                                        <i
                                          className="bi bi-pencil-square"
                                          aria-hidden="true"
                                        />
                                      </button>
                                    )}
                                  </div>
                                  {isOpen && (
                                    <div
                                      className="faq-answer faq-answer--form"
                                      onDragOver={
                                        viewOnly
                                          ? undefined
                                          : (e) =>
                                              handleGroupEndDragOver(
                                                e,
                                                group.groupName,
                                              )
                                      }
                                      onDrop={
                                        viewOnly
                                          ? undefined
                                          : (e) => {
                                              if (
                                                (
                                                  e.target as HTMLElement
                                                ).closest(
                                                  ".booking-saved-field-row, .booking-field-builder",
                                                )
                                              ) {
                                                return;
                                              }
                                              handleGroupEndDrop(
                                                e,
                                                group.groupName,
                                              );
                                            }
                                      }
                                    >
                                      {managing ? (
                                        <div className="booking-fields-manage-panel">
                                          <div className="booking-fields-manage-panel__top">
                                            <div className="booking-fields-manage-banner">
                                              <span>
                                                <i
                                                  className="bi bi-sliders me-1"
                                                  aria-hidden="true"
                                                />
                                                Customizing fields in this{" "}
                                                {groupLabel.toLowerCase()}
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-danger booking-fields-manage-panel__delete"
                                              onClick={() =>
                                                void deleteFieldGroup(
                                                  group.groupName,
                                                )
                                              }
                                            >
                                              Delete {groupLabel.toLowerCase()}
                                            </button>
                                          </div>
                                          <div className="booking-fields-manage-panel__fields">
                                            {group.items.map(
                                              ({ field, idx }) =>
                                                field.saved
                                                  ? renderDraggableSavedField(
                                                      field,
                                                      idx,
                                                      true,
                                                      group.groupName,
                                                    )
                                                  : renderUnsavedFieldCard(
                                                      idx,
                                                      group.groupName,
                                                    ),
                                            )}
                                            {renderGroupDropZone(
                                              group.groupName,
                                            )}
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-primary booking-fields-manage-panel__add-field"
                                              onClick={() =>
                                                addCustomFieldToGroup(
                                                  group.groupName,
                                                )
                                              }
                                            >
                                              + Add another field
                                            </button>
                                          </div>
                                          <div className="booking-fields-manage-panel__footer mt-4">
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-secondary"
                                              onClick={cancelManagingGroup}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-primary"
                                              onClick={() =>
                                                finishManagingGroup(
                                                  group.groupName,
                                                )
                                              }
                                            >
                                              Done
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          {unsavedCount > 0 && !viewOnly && (
                                            <div
                                              className="alert alert-warning py-2 small mb-3 d-flex flex-wrap align-items-center gap-2"
                                              role="status"
                                            >
                                              <span>
                                                {unsavedCount} unfinished field
                                                {unsavedCount !== 1
                                                  ? "s"
                                                  : ""}{" "}
                                                need setup.
                                              </span>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-warning"
                                                onClick={() =>
                                                  openManageGroup(
                                                    group.groupName,
                                                  )
                                                }
                                              >
                                                Continue setup
                                              </button>
                                            </div>
                                          )}
                                          {savedItems.map(({ field, idx }) =>
                                            renderDraggableSavedField(
                                              field,
                                              idx,
                                              false,
                                              group.groupName,
                                            ),
                                          )}
                                          {renderGroupDropZone(group.groupName)}
                                          {savedItems.length === 0 && (
                                            <div className="booking-fields-group-empty">
                                              <p className="text-muted small mb-2">
                                                No line items yet. Add fields
                                                from a template or create custom
                                                fields.
                                              </p>
                                              {!viewOnly && (
                                                <div className="booking-fields-group-empty__actions">
                                                  {activeFormTemplates.length >
                                                    0 && (
                                                    <select
                                                      className="form-select form-select-sm"
                                                      defaultValue=""
                                                      aria-label={`Add template fields to ${group.groupName}`}
                                                      onChange={(e) => {
                                                        const id = Number(
                                                          e.target.value,
                                                        );
                                                        if (!id) return;
                                                        applyTemplateToGroup(
                                                          group.groupName,
                                                          id,
                                                        );
                                                        e.target.value = "";
                                                      }}
                                                    >
                                                      <option value="">
                                                        Add from template…
                                                      </option>
                                                      {activeFormTemplates.map(
                                                        (t) => (
                                                          <option
                                                            key={t.id}
                                                            value={t.id}
                                                          >
                                                            {t.name}
                                                            {t.is_default
                                                              ? " (default)"
                                                              : ""}
                                                          </option>
                                                        ),
                                                      )}
                                                    </select>
                                                  )}
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() =>
                                                      addCustomFieldToGroup(
                                                        group.groupName,
                                                      )
                                                    }
                                                  >
                                                    + Custom field
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() =>
                                                      openManageGroup(
                                                        group.groupName,
                                                      )
                                                    }
                                                  >
                                                    Customize fields
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          {!viewOnly &&
                                            savedItems.length > 0 && (
                                              <>
                                                <hr className="booking-fields-group-fill-divider" />
                                                <p className="booking-fields-group-fill-hint small mb-2">
                                                  Need more line items? Add a
                                                  set from a template, or use
                                                  Customize fields to create
                                                  your own.
                                                </p>
                                                <div className="booking-fields-group-actions booking-fields-group-actions--fill">
                                                  {activeFormTemplates.length >
                                                    0 && (
                                                    <select
                                                      className="form-select form-select-sm"
                                                      defaultValue=""
                                                      aria-label={`Add template fields to ${group.groupName}`}
                                                      onChange={(e) => {
                                                        const id = Number(
                                                          e.target.value,
                                                        );
                                                        if (!id) return;
                                                        applyTemplateToGroup(
                                                          group.groupName,
                                                          id,
                                                        );
                                                        e.target.value = "";
                                                      }}
                                                    >
                                                      <option value="">
                                                        Add from template…
                                                      </option>
                                                      {activeFormTemplates.map(
                                                        (t) => (
                                                          <option
                                                            key={t.id}
                                                            value={t.id}
                                                          >
                                                            {t.name}
                                                            {t.is_default
                                                              ? " (default)"
                                                              : ""}
                                                          </option>
                                                        ),
                                                      )}
                                                    </select>
                                                  )}
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() =>
                                                      openManageGroup(
                                                        group.groupName,
                                                      )
                                                    }
                                                  >
                                                    Customize fields
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <div className="mb-0">
                          <label htmlFor="booking-notes" className="form-label">
                            Notes
                          </label>
                          <textarea
                            id="booking-notes"
                            className="form-control"
                            rows={3}
                            value={form.notes}
                            onChange={(e) =>
                              onChange({ ...form, notes: e.target.value })
                            }
                            {...readOnlyFieldProps}
                          />
                        </div>
                      </div>
                      <div className="col-md-3 d-flex flex-column booking-edit-modal-sidebar">
                        <div className="mb-3">
                          <label
                            htmlFor="booking-status"
                            className="form-label"
                          >
                            Status
                          </label>
                          <select
                            id="booking-status"
                            className="form-select"
                            value={form.statusId}
                            onChange={(e) =>
                              onChange({
                                ...form,
                                statusId: Number(e.target.value),
                              })
                            }
                            {...readOnlyFieldProps}
                          >
                            {statuses.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        {(!selectedContact || contactPickerOpen) && (
                          <div className="mb-3">
                            <label
                              htmlFor="booking-contact"
                              className="form-label"
                            >
                              Contact
                            </label>
                            <div className="input-group">
                              <select
                                id="booking-contact"
                                className="form-select"
                                value={
                                  form.contactId != null
                                    ? String(form.contactId)
                                    : ""
                                }
                                disabled={contactsLoading || viewOnly}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  onChange({
                                    ...form,
                                    contactId: raw === "" ? null : Number(raw),
                                  });
                                  if (raw !== "") {
                                    setContactPickerOpen(false);
                                  }
                                }}
                              >
                                <option value="">
                                  {contactsLoading
                                    ? "Loading contacts…"
                                    : "Select a contact"}
                                </option>
                                {contacts.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {contactDisplayName(c)}
                                  </option>
                                ))}
                              </select>
                              {!viewOnly && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary"
                                  title="Add contact"
                                  aria-label="Add contact"
                                  onClick={openAddContact}
                                >
                                  <i className="bi bi-plus-lg" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {selectedContact && (
                          <div className="booking-contact-summary mb-3">
                            <div className="booking-contact-summary__header">
                              <button
                                type="button"
                                className="booking-contact-summary__toggle"
                                aria-expanded={contactDetailsOpen}
                                onClick={() =>
                                  setContactDetailsOpen((open) => !open)
                                }
                              >
                                <span className="fw-semibold">
                                  Contact Details
                                </span>
                                <span className="booking-contact-summary__preview text-muted small">
                                  {contactDisplayName(selectedContact)}
                                  {selectedContact.email?.trim()
                                    ? ` · ${selectedContact.email.trim()}`
                                    : ""}
                                </span>
                                <i
                                  className={`bi bi-chevron-${contactDetailsOpen ? "up" : "down"}`}
                                  aria-hidden="true"
                                />
                              </button>
                              {!viewOnly && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary booking-contact-summary__edit"
                                  title={
                                    contactPickerOpen
                                      ? "Hide contact picker"
                                      : "Change contact"
                                  }
                                  aria-label={
                                    contactPickerOpen
                                      ? "Hide contact picker"
                                      : "Change contact"
                                  }
                                  aria-pressed={contactPickerOpen}
                                  onClick={() =>
                                    setContactPickerOpen((open) => !open)
                                  }
                                >
                                  <i
                                    className={`bi ${contactPickerOpen ? "bi-eye-slash" : "bi-pencil-square"}`}
                                    aria-hidden="true"
                                  />
                                </button>
                              )}
                            </div>
                            {contactDetailsOpen && (
                              <div className="booking-contact-summary__body">
                                <div className="booking-contact-summary__row">
                                  <span className="booking-contact-summary__label">
                                    First name
                                  </span>
                                  <span className="booking-contact-summary__value">
                                    {selectedContact.first_name || "—"}
                                  </span>
                                </div>
                                <div className="booking-contact-summary__row">
                                  <span className="booking-contact-summary__label">
                                    Last name
                                  </span>
                                  <span className="booking-contact-summary__value">
                                    {selectedContact.last_name || "—"}
                                  </span>
                                </div>
                                <div className="booking-contact-summary__row">
                                  <span className="booking-contact-summary__label">
                                    {defaultContactPhone
                                      ? contactPhoneLabel(defaultContactPhone)
                                      : "Phone"}
                                  </span>
                                  <span className="booking-contact-summary__value">
                                    {defaultContactPhone?.number?.trim() || "—"}
                                  </span>
                                </div>
                                <div className="booking-contact-summary__row">
                                  <span className="booking-contact-summary__label">
                                    {defaultContactAddress
                                      ? contactAddressLabel(
                                          defaultContactAddress,
                                        )
                                      : "Address"}
                                  </span>
                                  <span className="booking-contact-summary__value">
                                    {defaultContactAddress
                                      ? formatContactAddress(
                                          defaultContactAddress,
                                        ) || "—"
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="booking-price-summary mt-auto">
                          <h6 className="booking-price-summary__title d-flex justify-content-between">
                            Price summary
                            {!viewOnly && (
                              <button
                                type="button"
                                className="btn btn-link booking-edit-modal-header__pricing-btn"
                                aria-label="Quotation pricing"
                                title="Quotation pricing"
                                onClick={() => setPricingModalOpen(true)}
                              >
                                <i
                                  className="bi bi-cash-coin"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </h6>
                          {priceGroups.length === 0 ? (
                            <p className="booking-price-summary__empty text-muted small mb-0">
                              Selected fields with prices will appear here.
                            </p>
                          ) : (
                            <div className="booking-price-summary__groups">
                              {priceGroups.map((group) => (
                                <div
                                  key={group.groupName}
                                  className="booking-price-summary__group"
                                >
                                  <h6 className="booking-price-summary__group-title">
                                    {group.groupName}
                                  </h6>
                                  <ul className="booking-price-summary__list list-unstyled mb-0">
                                    {group.lines.map((line, i) => (
                                      <li
                                        key={`${group.groupName}-${line.label}-${i}`}
                                        className="booking-price-summary__row"
                                      >
                                        <span className="booking-price-summary__label">
                                          {line.label}
                                        </span>
                                        <span className="booking-price-summary__amount">
                                          {formatCurrency(
                                            line.amount,
                                            currencyOptions,
                                          )}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                  {priceGroups.length > 1 && (
                                    <div className="booking-price-summary__group-total">
                                      <span>Subtotal</span>
                                      <span>
                                        {formatCurrency(
                                          group.subtotal,
                                          currencyOptions,
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {hasPricingAdjustment && (
                            <>
                              <div className="booking-price-summary__row booking-price-summary__adjustment">
                                <span className="text-muted">
                                  Line-item subtotal
                                </span>
                                <span>
                                  {formatCurrency(priceTotal, currencyOptions)}
                                </span>
                              </div>
                              {pricingAdjustment.discountAmount.trim() ? (
                                <div className="booking-price-summary__row booking-price-summary__adjustment">
                                  <span className="text-muted">
                                    Discount
                                    {pricingAdjustment.discountType ===
                                    "percent"
                                      ? ` (${pricingAdjustment.discountAmount}%)`
                                      : ""}
                                  </span>
                                  <span>
                                    −
                                    {formatCurrency(
                                      Math.max(
                                        0,
                                        priceTotal - effectivePriceTotal,
                                      ),
                                      currencyOptions,
                                    )}
                                  </span>
                                </div>
                              ) : null}
                              {pricingAdjustment.overrideTotalAmount.trim() ? (
                                <div className="booking-price-summary__row booking-price-summary__adjustment">
                                  <span className="text-muted">
                                    Manual total override
                                  </span>
                                  <span className="text-muted small">
                                    Applied
                                  </span>
                                </div>
                              ) : null}
                            </>
                          )}
                          <div className="booking-price-summary__total">
                            <span>Total</span>
                            <span>
                              {formatCurrency(
                                effectivePriceTotal,
                                currencyOptions,
                              )}
                            </span>
                          </div>
                          <div className="booking-price-summary__total booking-price-summary__downpayment">
                            <span>Downpayment</span>
                            <span>
                              {formatCurrency(
                                requiredDownpaymentTotal,
                                currencyOptions,
                              )}
                            </span>
                          </div>
                          {showPaymentBalance && (
                            <>
                              <div className="booking-price-summary__total booking-price-summary__paid">
                                <span>Paid toward booking</span>
                                <span>
                                  {formatCurrency(paidTotal, currencyOptions)}
                                </span>
                              </div>
                              {paidChargeTotal > 0 && (
                                <div className="booking-price-summary__detail">
                                  <span>Customer paid (gross)</span>
                                  <span>
                                    {formatCurrency(
                                      paidChargeTotal,
                                      currencyOptions,
                                    )}
                                  </span>
                                </div>
                              )}
                              {paidProcessingTotal > 0 && (
                                <div className="booking-price-summary__detail">
                                  <span>Processing fees</span>
                                  <span>
                                    {formatCurrency(
                                      paidProcessingTotal,
                                      currencyOptions,
                                    )}
                                  </span>
                                </div>
                              )}
                              {paidPlatformTotal > 0 && (
                                <div className="booking-price-summary__detail">
                                  <span>Platform fees</span>
                                  <span>
                                    {formatCurrency(
                                      paidPlatformTotal,
                                      currencyOptions,
                                    )}
                                  </span>
                                </div>
                              )}
                              {refundedTotal > 0 && (
                                <div className="booking-price-summary__total booking-price-summary__refunded">
                                  <span>Refunded</span>
                                  <span>
                                    {formatCurrency(
                                      refundedTotal,
                                      currencyOptions,
                                    )}
                                  </span>
                                </div>
                              )}
                              <div className="booking-price-summary__total booking-price-summary__remaining">
                                <span>Remaining</span>
                                <span>
                                  {formatCurrency(
                                    remainingBalance,
                                    currencyOptions,
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </fieldset>
                )}
              </div>
              <div className="modal-footer booking-edit-modal-footer">
                <div className="booking-edit-modal-footer__end">
                  {modalTab === "history" ||
                  modalTab === "documents" ||
                  modalTab === "email_logs" ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  ) : viewOnly && form.mode === "edit" ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        title="Download Quotation"
                        aria-label="Download Quotation"
                        disabled={pdfDownloading || form.id == null}
                        onClick={() => void handleDownloadBookingPdf()}
                      >
                        {pdfDownloading ? (
                          <span
                            className="spinner-border spinner-border-sm"
                            role="status"
                            aria-hidden="true"
                          />
                        ) : (
                          <>
                            <i
                              className="bi bi-file-earmark-arrow-down me-1"
                              aria-hidden="true"
                            />
                            Download PDF
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="booking-edit-modal-footer__actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={onClose}
                          disabled={saving}
                        >
                          Close
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={saving || loadingDetails}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          data-close-after="true"
                          disabled={saving || loadingDetails}
                        >
                          {saving ? "Saving…" : "Save and Close"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {groupNameModal && (
        <>
          <div
            className="booking-group-modal-backdrop"
            aria-hidden="true"
            onClick={closeGroupNameModal}
          />
          <div
            className="booking-group-modal modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bookingGroupNameModalTitle"
          >
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h2
                    id="bookingGroupNameModalTitle"
                    className="modal-title fs-6"
                  >
                    {groupNameModal.type === "add"
                      ? `Add ${groupLabel}`
                      : `Rename ${groupLabel}`}
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeGroupNameModal}
                  />
                </div>
                <div className="modal-body">
                  <label
                    htmlFor="booking-group-name-input"
                    className="form-label"
                  >
                    {groupLabel} name
                  </label>
                  <input
                    id="booking-group-name-input"
                    type="text"
                    className={`form-control${groupNameError ? " is-invalid" : ""}`}
                    value={groupNameInput}
                    onChange={(e) => {
                      setGroupNameInput(e.target.value);
                      setGroupNameError(null);
                    }}
                    autoFocus
                  />
                  {groupNameError && (
                    <div className="invalid-feedback d-block">
                      {groupNameError}
                    </div>
                  )}
                  {groupNameModal.type === "add" && (
                    <div className="mt-3">
                      <label
                        htmlFor="booking-group-template"
                        className="form-label"
                      >
                        Form Template
                      </label>
                      <select
                        id="booking-group-template"
                        className="form-select"
                        value={addGroupTemplateId ?? ""}
                        onChange={(e) =>
                          setAddGroupTemplateId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">None</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <p className="form-text small mb-0">
                        Optional. Adds template fields to this group.
                      </p>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={closeGroupNameModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleGroupNameSave}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {paymentsModalOpen && form.mode === "edit" && form.id != null && (
        <BookingPaymentsModal
          bookingId={form.id}
          nestedModalOpen={emailModalOpen}
          bookingTotal={effectivePriceTotal}
          requiredDownpayment={
            Number((form.requiredDownpaymentAmount ?? "").trim()) > 0
              ? Number(form.requiredDownpaymentAmount)
              : requiredDownpaymentTotal
          }
          contactEmail={selectedContact?.email?.trim() ?? ""}
          currencyOptions={currencyOptions}
          onClose={() => {
            setPaymentsModalOpen(false);
            if (form.id != null) {
              void fetchBookingPaymentLinks(form.id)
                .then(({ summary }) => {
                  onChange({
                    ...form,
                    paidAmount: summary.paid_amount,
                    paidChargeAmount: summary.paid_charge_amount ?? "0",
                    paidProcessingFees: summary.paid_processing_fees ?? "0",
                    paidPlatformFees: summary.paid_platform_fees ?? "0",
                    refundedAmount: summary.refunded_amount ?? "0",
                  });
                })
                .catch(() => {});
            }
          }}
          onSendToCustomer={openPaymentLinkEmailModal}
        />
      )}

      {emailModalOpen && (
        <EmailSenderModal
          key={`booking-email-${form.id ?? "new"}-${emailPaymentLinkMode ? "payment-link" : "general"}`}
          stacked={emailPaymentLinkMode && paymentsModalOpen}
          error={emailError}
          sending={emailSending}
          composeDefaults={{
            ...(emailPaymentLinkMode
              ? paymentLinkEmailDefaults
              : bookingEmailDefaults),
            ...(emailAiComposeDefaults ?? {}),
          }}
          draftScope={
            emailPaymentLinkMode
              ? `booking-${form.id}-payment-link`
              : `booking-${form.id ?? "new"}`
          }
          initialBookingTemplateName={
            emailPaymentLinkMode ? "payment_link" : undefined
          }
          paymentLinkUrl={paymentLinkUrlForEmail ?? undefined}
          quotationId={form.uniqueId?.trim() || form.id}
          quotationDbId={form.id}
          quotationTitle={form.title}
          amountPaid={form.paidChargeAmount || form.paidAmount || "0"}
          bookingTemplateCompanyId={userCompanyId}
          onSend={handleBookingEmailSend}
          onClose={() => {
            setEmailModalOpen(false);
            setEmailPaymentLinkMode(false);
            setPaymentLinkUrlForEmail(null);
            setEmailAiComposeDefaults(null);
            setEmailError(null);
          }}
        />
      )}

      {aiPanelOpen && hasAiPlusPlan && form.id != null && (
        <QuotationAiPanel
          open={aiPanelOpen}
          quotationId={form.id}
          quotationLabel={
            form.uniqueId?.trim()
              ? `${form.title.trim() || "Quotation"} (${form.uniqueId.trim()})`
              : form.title.trim() || "Quotation"
          }
          onClose={() => setAiPanelOpen(false)}
          onUseEmailDraft={handleUseAiEmailDraft}
        />
      )}

      {pricingModalOpen && (
        <QuotationPricingModal
          open={pricingModalOpen}
          lineSubtotal={priceTotal}
          currencyOptions={currencyOptions}
          value={pricingAdjustment}
          onClose={() => setPricingModalOpen(false)}
          onApply={(next) => {
            const effectiveTotal = computeQuotationEffectiveTotal(
              priceTotal,
              next,
            ).toFixed(2);
            onChange({
              ...form,
              discountAmount: next.discountAmount,
              discountType: next.discountType,
              overrideTotalAmount: next.overrideTotalAmount,
              totalAmount: effectiveTotal,
            });
            if (onPricingApplied) {
              void onPricingApplied(next).catch((err) => {
                showErrorToast(
                  err instanceof Error
                    ? err.message
                    : "Failed to save quotation pricing",
                );
              });
            }
          }}
        />
      )}

      {addContactOpen && (
        <ContactFormModal
          editing={null}
          form={addContactForm}
          setField={setAddContactField}
          error={addContactError}
          saving={addContactSaving}
          onSave={() => void handleAddContactSave()}
          onClose={closeAddContact}
          elevated
        />
      )}
    </>
  );
};

export default BookingEditModal;
