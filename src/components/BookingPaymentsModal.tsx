import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  cancelBookingPaymentLink,
  createBookingPaymentLink,
  fetchBookingPaymentLinks,
  type BookingPaymentLinkRecord,
  type BookingPaymentRecord,
  type BookingPaymentSummary,
  type VerifiedPaymentProvider,
} from "../services/bookingPaymentLinks";
import ManualPaymentModal from "./ManualPaymentModal";
import RefundModal from "./RefundModal";
import CompanyKybModal from "../pages/settings/companies/CompanyKybModal";
import { fetchCompanies, type CompanyRecord } from "../services/companies";
import { formatCurrency } from "../utils/currency";
import type { CurrencyFormatOptions } from "../utils/currency";
import PaymentProviderLogo from "./payments/PaymentProviderLogo";
import { showErrorToast, showSuccessToast } from "../utils/toast";

type Props = {
  bookingId: number;
  bookingTotal: number;
  requiredDownpayment: number;
  contactEmail: string;
  currencyOptions: CurrencyFormatOptions;
  onClose: () => void;
  onSendToCustomer: (link: BookingPaymentLinkRecord) => void;
  /** When true, Escape does not close this modal (e.g. email compose is open on top). */
  nestedModalOpen?: boolean;
};

function paymentLinkOpenUrl(link: BookingPaymentLinkRecord): string {
  return (link.public_url || link.checkout_url || "").trim();
}

type PaymentsTab = "links" | "made";

const PAYMENTS_LIST_INITIAL_SIZE = 5;
const PAYMENTS_LIST_SHOW_MORE_SIZE = 5;

function formatPaymentDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTransactionStatus(status: string): string {
  const s = status.trim();
  if (!s) return "—";
  return s.replace(/_/g, " ");
}

function linkStatusClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "paid") {
    return "booking-payments-status booking-payments-status--success";
  }
  if (s === "pending" || s === "active") {
    return "booking-payments-status booking-payments-status--pending";
  }
  if (
    s === "failed" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "expired" ||
    s === "void"
  ) {
    return "booking-payments-status booking-payments-status--failed";
  }
  return "booking-payments-status";
}

function providerBadgeClass(
  provider: "paymongo" | "xendit" | undefined,
): string {
  const base = "booking-payments-provider-badge";
  if (provider === "xendit") return `${base} ${base}--xendit`;
  return `${base} ${base}--paymongo`;
}

function paymentStatusClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "paid" || s === "succeeded" || s === "success") {
    return "booking-payments-status booking-payments-status--success";
  }
  if (s === "refunded") {
    return "booking-payments-status booking-payments-status--refunded";
  }
  if (s === "failed" || s === "cancelled" || s === "canceled" || s === "void") {
    return "booking-payments-status booking-payments-status--failed";
  }
  if (s === "pending" || s === "processing") {
    return "booking-payments-status booking-payments-status--pending";
  }
  return "booking-payments-status";
}

function parseSummaryAmount(value: string | number | undefined): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function defaultChargeInput(
  summary: BookingPaymentSummary | null,
  requiredDownpayment: number,
): string {
  if (!summary) return "";
  const remaining = parseSummaryAmount(summary.remaining_amount);
  if (remaining <= 0) return "0";
  if (summary.has_paid_payment) {
    return remaining.toFixed(2);
  }
  const down = parseSummaryAmount(summary.required_downpayment_amount);
  const use = down > 0 ? down : requiredDownpayment;
  return Math.min(use > 0 ? use : remaining, remaining).toFixed(2);
}

type PaymentProviderOption = {
  provider: "paymongo" | "xendit";
  label: string;
  verified: boolean;
};

const PAYMENT_PROVIDERS: readonly ("paymongo" | "xendit")[] = [
  "paymongo",
  "xendit",
];

const DEFAULT_PAYMENT_PROVIDER_LABELS: Record<"paymongo" | "xendit", string> = {
  paymongo: "PayMongo",
  xendit: "Xendit",
};

function buildPaymentProviderOptions(
  fromApi: VerifiedPaymentProvider[],
  company: CompanyRecord | null | undefined,
): PaymentProviderOption[] {
  const verifications = company?.provider_verifications;
  const apiVerified = new Set(fromApi.map((item) => item.provider));

  return PAYMENT_PROVIDERS.map((provider) => {
    const state = verifications?.[provider];
    const apiItem = fromApi.find((item) => item.provider === provider);
    return {
      provider,
      label:
        state?.provider_label ||
        apiItem?.label ||
        DEFAULT_PAYMENT_PROVIDER_LABELS[provider],
      verified: state?.verified === true || apiVerified.has(provider),
    };
  });
}

function hasVerifiedPaymentProvider(
  options: PaymentProviderOption[],
): boolean {
  return options.some((item) => item.verified);
}

export default function BookingPaymentsModal({
  bookingId,
  nestedModalOpen = false,
  bookingTotal,
  requiredDownpayment,
  contactEmail,
  currencyOptions,
  onClose,
  onSendToCustomer,
}: Props) {
  const [links, setLinks] = useState<BookingPaymentLinkRecord[]>([]);
  const [payments, setPayments] = useState<BookingPaymentRecord[]>([]);
  const [summary, setSummary] = useState<BookingPaymentSummary | null>(null);
  const [activeTab, setActiveTab] = useState<PaymentsTab>("links");
  const [loading, setLoading] = useState(true);
  const [creatingProvider, setCreatingProvider] = useState<
    "paymongo" | "xendit" | null
  >(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [chargeInput, setChargeInput] = useState("");
  const [paymentProviders, setPaymentProviders] = useState<
    PaymentProviderOption[]
  >([]);
  const [mainCompany, setMainCompany] = useState<CompanyRecord | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [kybModalOpen, setKybModalOpen] = useState(false);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [visibleLinksCount, setVisibleLinksCount] = useState(
    PAYMENTS_LIST_INITIAL_SIZE,
  );
  const [visiblePaymentsCount, setVisiblePaymentsCount] = useState(
    PAYMENTS_LIST_INITIAL_SIZE,
  );

  const resetListVisibility = useCallback(() => {
    setVisibleLinksCount(PAYMENTS_LIST_INITIAL_SIZE);
    setVisiblePaymentsCount(PAYMENTS_LIST_INITIAL_SIZE);
  }, []);

  const canGenerateLinks = hasVerifiedPaymentProvider(paymentProviders);

  const syncPaymentProviders = useCallback(
    (
      fromApi: VerifiedPaymentProvider[],
      company: CompanyRecord | null | undefined,
    ) => {
      setPaymentProviders(buildPaymentProviderOptions(fromApi, company));
    },
    [],
  );

  const loadPayments = useCallback(
    async (company: CompanyRecord | null | undefined) => {
      setLoading(true);
      try {
        const data = await fetchBookingPaymentLinks(bookingId);
        setLinks(data.links);
        setPayments(data.payments ?? []);
        setSummary(data.summary);
        resetListVisibility();
        syncPaymentProviders(data.verified_payment_providers ?? [], company);
        setChargeInput(defaultChargeInput(data.summary, requiredDownpayment));
      } catch (e) {
        showErrorToast(
          e instanceof Error ? e.message : "Failed to load payment links",
        );
      } finally {
        setLoading(false);
      }
    },
    [bookingId, requiredDownpayment, resetListVisibility, syncPaymentProviders],
  );

  const refreshCompany = useCallback(async () => {
    setCompanyLoading(true);
    try {
      const list = await fetchCompanies();
      const main = list.find((c) => c.is_main) ?? null;
      setMainCompany(main);
      return main;
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Failed to load company");
      setMainCompany(null);
      return null;
    } finally {
      setCompanyLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setCompanyLoading(true);
      setLoading(true);
      try {
        const list = await fetchCompanies();
        if (cancelled) return;
        const main = list.find((c) => c.is_main) ?? null;
        setMainCompany(main);
        await loadPayments(main);
      } catch (e) {
        if (!cancelled) {
          showErrorToast(
            e instanceof Error ? e.message : "Failed to load company",
          );
          setMainCompany(null);
          setLoading(false);
        }
      } finally {
        if (!cancelled) setCompanyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPayments]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !nestedModalOpen &&
        !manualPaymentOpen &&
        !kybModalOpen
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, nestedModalOpen, manualPaymentOpen, kybModalOpen]);

  const summaryDisplay = useMemo(() => {
    const total = summary
      ? parseSummaryAmount(summary.total_amount)
      : bookingTotal;
    const down = summary
      ? parseSummaryAmount(summary.required_downpayment_amount)
      : requiredDownpayment;
    const paid = summary ? parseSummaryAmount(summary.paid_amount) : 0;
    const paidCharge = summary
      ? parseSummaryAmount(summary.paid_charge_amount)
      : 0;
    const paidProcessing = summary
      ? parseSummaryAmount(summary.paid_processing_fees)
      : 0;
    const paidPlatform = summary
      ? parseSummaryAmount(summary.paid_platform_fees)
      : 0;
    const refunded = summary ? parseSummaryAmount(summary.refunded_amount) : 0;
    const remaining = summary
      ? parseSummaryAmount(summary.remaining_amount)
      : Math.max(0, total - paid);
    return {
      total,
      down,
      paid,
      paidCharge,
      paidProcessing,
      paidPlatform,
      refunded,
      remaining,
    };
  }, [summary, bookingTotal, requiredDownpayment]);

  const handleCreate = async (provider: "paymongo" | "xendit") => {
    const providerOption = paymentProviders.find(
      (item) => item.provider === provider,
    );
    if (!providerOption?.verified) {
      showErrorToast(
        `Complete ${providerOption?.label ?? "payment provider"} verification before generating links.`,
      );
      return;
    }
    const remaining = summaryDisplay.remaining;
    if (remaining <= 0) {
      showErrorToast("This booking is already fully paid.");
      return;
    }
    const amount = Number.parseFloat(chargeInput.trim());
    if (Number.isNaN(amount) || amount <= 0) {
      showErrorToast("Enter a valid payment amount greater than zero.");
      return;
    }
    if (amount > remaining + 0.0001) {
      showErrorToast(
        `Amount cannot exceed the remaining balance (${formatCurrency(remaining, currencyOptions)}).`,
      );
      return;
    }
    setCreatingProvider(provider);
    try {
      const link = await createBookingPaymentLink(bookingId, amount, provider);
      const refreshed = await fetchBookingPaymentLinks(bookingId);
      setLinks(refreshed.links);
      setPayments(refreshed.payments ?? []);
      setSummary(refreshed.summary);
      setChargeInput(
        defaultChargeInput(refreshed.summary, requiredDownpayment),
      );
      showSuccessToast("Payment link created.");
      onSendToCustomer(link);
    } catch (e) {
      showErrorToast(
        e instanceof Error ? e.message : "Failed to create payment link",
      );
    } finally {
      setCreatingProvider(null);
    }
  };

  const handleCancel = async (link: BookingPaymentLinkRecord) => {
    if (link.status === "paid") return;
    setCancellingId(link.id);
    try {
      await cancelBookingPaymentLink(bookingId, link.id);
      const refreshed = await fetchBookingPaymentLinks(bookingId);
      setLinks(refreshed.links);
      setPayments(refreshed.payments ?? []);
      setSummary(refreshed.summary);
      setChargeInput(
        defaultChargeInput(refreshed.summary, requiredDownpayment),
      );
      showSuccessToast("Payment link cancelled.");
    } catch (e) {
      showErrorToast(
        e instanceof Error ? e.message : "Failed to cancel payment link",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const formatLinkAmount = (link: BookingPaymentLinkRecord) =>
    formatCurrency(Number(link.charge_amount), {
      ...currencyOptions,
      currencyCode: link.currency || currencyOptions.currencyCode,
    });

  const formatPaymentField = (raw: string | undefined) =>
    formatCurrency(Number(raw ?? 0), currencyOptions);

  const paymentCreditAmount = (payment: BookingPaymentRecord): number => {
    const base = Number(payment.base_amount);
    if (!Number.isNaN(base) && base > 0) return base;
    return Number(payment.amount) || 0;
  };

  const paidBalance = parseSummaryAmount(summary?.paid_amount);

  const chargeLabel = summary?.has_paid_payment
    ? "Amount to collect (remaining balance)"
    : "Amount to collect (downpayment)";

  const currencySymbol =
    (currencyOptions.currencySymbol ?? "").trim() || "₱";

  const headerSubtitle =
    summaryDisplay.remaining <= 0
      ? "This booking is fully paid"
      : `${formatCurrency(summaryDisplay.remaining, currencyOptions)} remaining of ${formatCurrency(summaryDisplay.total, currencyOptions)}`;

  const visibleLinks = useMemo(
    () => links.slice(0, visibleLinksCount),
    [links, visibleLinksCount],
  );
  const visiblePayments = useMemo(
    () => payments.slice(0, visiblePaymentsCount),
    [payments, visiblePaymentsCount],
  );
  const hiddenLinksCount = Math.max(0, links.length - visibleLinksCount);
  const hiddenPaymentsCount = Math.max(0, payments.length - visiblePaymentsCount);

  const handleShowMoreLinks = () => {
    setVisibleLinksCount((current) =>
      Math.min(current + PAYMENTS_LIST_SHOW_MORE_SIZE, links.length),
    );
  };

  const handleShowMorePayments = () => {
    setVisiblePaymentsCount((current) =>
      Math.min(current + PAYMENTS_LIST_SHOW_MORE_SIZE, payments.length),
    );
  };

  return createPortal(
    <>
      <div
        className="booking-payments-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="booking-payments-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookingPaymentsTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content booking-payments-modal__content">
            <div className="modal-header booking-payments-modal__header">
              <div className="booking-payments-modal-title-wrap">
                <span className="booking-payments-modal-icon" aria-hidden="true">
                  <i className="bi bi-wallet2" />
                </span>
                <div className="booking-payments-modal-title-text">
                  <h1 id="bookingPaymentsTitle" className="modal-title mb-0">
                    Payments
                  </h1>
                  {!companyLoading && !loading && canGenerateLinks ? (
                    <p className="booking-payments-modal-subtitle mb-0">
                      {headerSubtitle}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body booking-payments-modal__body">
              {companyLoading || loading ? (
                <div
                  className="booking-payments-loading"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="spinner-border text-primary booking-payments-loading__spinner"
                    aria-hidden
                  />
                  <span className="booking-payments-loading__text">
                    Loading payment details…
                  </span>
                </div>
              ) : !canGenerateLinks ? (
                <div className="booking-payments-kyb-gate">
                  <div
                    className="booking-payments-kyb-gate__icon"
                    aria-hidden="true"
                  >
                    <i className="bi bi-shield-exclamation" />
                  </div>
                  <h2 className="booking-payments-kyb-gate__title">
                    Verify your company first
                  </h2>
                  <p className="booking-payments-kyb-gate__text">
                    Payment links are available after your company completes
                    business verification with PayMongo and/or Xendit, and the
                    provider is ready to accept payments.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!mainCompany}
                    onClick={() => setKybModalOpen(true)}
                  >
                    Start verification
                  </button>
                </div>
              ) : (
                <>
                  <div className="booking-payments-charge-panel">
                    <div className="booking-payments-charge-panel__columns">
                      <div className="booking-payments-charge-panel__col booking-payments-charge-panel__col--summary">
                        <div className="booking-payments-panel-head">
                          <i className="bi bi-receipt" aria-hidden="true" />
                          <h2 className="booking-payments-charge-panel__title">
                            Payment summary
                          </h2>
                        </div>
                        <dl className="booking-payments-summary-dl mb-0">
                          <div className="booking-payments-summary-dl__row">
                            <dt>Total amount</dt>
                            <dd>
                              {formatCurrency(
                                summaryDisplay.total,
                                currencyOptions,
                              )}
                            </dd>
                          </div>
                          <div className="booking-payments-summary-dl__row">
                            <dt>Downpayment</dt>
                            <dd>
                              {formatCurrency(summaryDisplay.down, currencyOptions)}
                            </dd>
                          </div>
                          {summaryDisplay.paid > 0 && (
                            <>
                              <div className="booking-payments-summary-dl__row">
                                <dt>Paid toward booking</dt>
                                <dd>
                                  {formatCurrency(
                                    summaryDisplay.paid,
                                    currencyOptions,
                                  )}
                                </dd>
                              </div>
                              {summaryDisplay.paidCharge > 0 && (
                                <div className="booking-payments-summary-dl__row">
                                  <dt>Customer paid (gross)</dt>
                                  <dd>
                                    {formatCurrency(
                                      summaryDisplay.paidCharge,
                                      currencyOptions,
                                    )}
                                  </dd>
                                </div>
                              )}
                              {summaryDisplay.paidProcessing > 0 && (
                                <div className="booking-payments-summary-dl__row">
                                  <dt>Processing fees</dt>
                                  <dd>
                                    {formatCurrency(
                                      summaryDisplay.paidProcessing,
                                      currencyOptions,
                                    )}
                                  </dd>
                                </div>
                              )}
                              {summaryDisplay.paidPlatform > 0 && (
                                <div className="booking-payments-summary-dl__row">
                                  <dt>Platform fees</dt>
                                  <dd>
                                    {formatCurrency(
                                      summaryDisplay.paidPlatform,
                                      currencyOptions,
                                    )}
                                  </dd>
                                </div>
                              )}
                            </>
                          )}
                          {summaryDisplay.refunded > 0 && (
                            <div className="booking-payments-summary-dl__row">
                              <dt>Refunded</dt>
                              <dd>
                                {formatCurrency(
                                  summaryDisplay.refunded,
                                  currencyOptions,
                                )}
                              </dd>
                            </div>
                          )}
                          <div className="booking-payments-summary-dl__row booking-payments-summary-dl__row--emphasis">
                            <dt>Remaining balance</dt>
                            <dd>
                              {formatCurrency(
                                summaryDisplay.remaining,
                                currencyOptions,
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="booking-payments-charge-panel__col booking-payments-charge-panel__col--collect">
                        <div className="booking-payments-panel-head">
                          <i className="bi bi-link-45deg" aria-hidden="true" />
                          <h2 className="booking-payments-charge-panel__title">
                            {chargeLabel}
                          </h2>
                        </div>
                        <div className="booking-payments-collect">
                          <label
                            htmlFor="booking-payment-charge-amount"
                            className="booking-payments-collect__label"
                          >
                            Charge amount
                          </label>
                          <div className="booking-payments-amount-field">
                            <span
                              className="booking-payments-amount-field__symbol"
                              aria-hidden="true"
                            >
                              {currencySymbol}
                            </span>
                            <input
                              id="booking-payment-charge-amount"
                              type="number"
                              className="form-control booking-payments-charge-input"
                              min={0}
                              step="0.01"
                              max={summaryDisplay.remaining}
                              value={chargeInput}
                              disabled={
                                summaryDisplay.remaining <= 0 || loading
                              }
                              onChange={(e) => setChargeInput(e.target.value)}
                              aria-label={chargeLabel}
                            />
                          </div>
                          <div className="booking-payments-provider-actions">
                            {paymentProviders.map((provider) => {
                              const busy =
                                creatingProvider === provider.provider;
                              const disabled =
                                !provider.verified ||
                                creatingProvider !== null ||
                                loading ||
                                summaryDisplay.remaining <= 0;
                              return (
                                <button
                                  key={provider.provider}
                                  type="button"
                                  className={`booking-payments-provider-btn${
                                    !provider.verified
                                      ? " booking-payments-provider-btn--unverified"
                                      : ""
                                  }`}
                                  disabled={disabled}
                                  title={
                                    provider.verified
                                      ? undefined
                                      : `Complete ${provider.label} verification to generate payment links`
                                  }
                                  onClick={() =>
                                    void handleCreate(provider.provider)
                                  }
                                >
                                  <PaymentProviderLogo
                                    provider={provider.provider}
                                  />
                                  <span className="booking-payments-provider-btn__text">
                                    <span className="booking-payments-provider-btn__label">
                                      Generate payment link
                                    </span>
                                    <span className="booking-payments-provider-btn__via">
                                      through {provider.label}
                                    </span>
                                  </span>
                                  {busy ? (
                                    <span
                                      className="spinner-border spinner-border-sm booking-payments-provider-btn__spinner"
                                      role="status"
                                      aria-hidden
                                    />
                                  ) : !provider.verified ? (
                                    <i
                                      className="bi bi-shield-lock booking-payments-provider-btn__chevron"
                                      aria-hidden
                                    />
                                  ) : (
                                    <i
                                      className="bi bi-chevron-right booking-payments-provider-btn__chevron"
                                      aria-hidden
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <p className="booking-payments-collect__help mb-0">
                            <i className="bi bi-info-circle" aria-hidden="true" />
                            Amount is grossed up for processing and a 1%
                            platform fee.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="booking-payments-section-head">
                    <h2 className="booking-payments-section-title">
                      Transaction history
                    </h2>
                    <ul
                      className="nav nav-tabs booking-payments-tabs"
                      role="tablist"
                    >
                      <li className="nav-item" role="presentation">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === "links"}
                          className={`nav-link${activeTab === "links" ? " active" : ""}`}
                          onClick={() => setActiveTab("links")}
                        >
                          Payment links
                          <span className="booking-payments-tab-count">
                            {links.length}
                          </span>
                        </button>
                      </li>
                      <li className="nav-item" role="presentation">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === "made"}
                          className={`nav-link${activeTab === "made" ? " active" : ""}`}
                          onClick={() => setActiveTab("made")}
                        >
                          Payments made
                          <span className="booking-payments-tab-count">
                            {payments.length}
                          </span>
                        </button>
                      </li>
                    </ul>
                  </div>

                  <div className="booking-payments-table-card">
                    <div className="booking-payments-table-scroll">
                      {loading &&
                      (activeTab === "links"
                        ? links.length === 0
                        : payments.length === 0) ? (
                        <div className="booking-payments-table-empty-wrap">
                          <span className="booking-payments-table-empty">
                            Loading…
                          </span>
                        </div>
                      ) : activeTab === "links" ? (
                        <table className="booking-payments-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Provider</th>
                              <th>Status</th>
                              <th>Customer</th>
                              <th>Link</th>
                              <th className="booking-payments-th-actions">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleLinks.map((link) => {
                              const canAct = link.status === "pending";
                              const openUrl = paymentLinkOpenUrl(link);
                              const email = contactEmail.trim() || "—";
                              const providerLabel =
                                link.payment_provider_label ||
                                (link.payment_provider === "xendit"
                                  ? "Xendit"
                                  : "PayMongo");
                              return (
                                <tr
                                  key={link.id}
                                  className="booking-payments-table-row"
                                >
                                  <td className="booking-payments-table-date">
                                    {formatPaymentDate(link.created_at)}
                                  </td>
                                  <td className="booking-payments-table-amount">
                                    {formatLinkAmount(link)}
                                  </td>
                                  <td>
                                    <span
                                      className={providerBadgeClass(
                                        link.payment_provider,
                                      )}
                                    >
                                      {providerLabel}
                                    </span>
                                  </td>
                                  <td>
                                    <span
                                      className={linkStatusClass(link.status)}
                                    >
                                      {formatTransactionStatus(link.status)}
                                    </span>
                                  </td>
                                  <td
                                    className="booking-payments-table-email"
                                    title={email}
                                  >
                                    {email}
                                  </td>
                                  <td className="booking-payments-table-id">
                                    {canAct ? (
                                      <a
                                        href={link.public_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="booking-payments-table-id-link"
                                      >
                                        #{link.id}
                                      </a>
                                    ) : (
                                      `#${link.id}`
                                    )}
                                  </td>
                                  <td>
                                    <div className="booking-payments-actions">
                                      <button
                                        type="button"
                                        className="booking-payments-action-btn booking-payments-action-btn--open"
                                        title="Open payment link"
                                        disabled={!openUrl}
                                        onClick={() =>
                                          window.open(
                                            openUrl,
                                            "_blank",
                                            "noopener,noreferrer",
                                          )
                                        }
                                      >
                                        <i
                                          className="bi bi-box-arrow-up-right"
                                          aria-hidden
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="booking-payments-action-btn booking-payments-action-btn--delete"
                                        title="Cancel link"
                                        disabled={
                                          !canAct || cancellingId === link.id
                                        }
                                        onClick={() => void handleCancel(link)}
                                      >
                                        {cancellingId === link.id ? (
                                          <span
                                            className="spinner-border spinner-border-sm"
                                            role="status"
                                            aria-hidden
                                          />
                                        ) : (
                                          <i
                                            className="bi bi-trash3"
                                            aria-hidden
                                          />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        className="booking-payments-action-btn booking-payments-action-btn--edit"
                                        title="Resend link to customer"
                                        disabled={!canAct}
                                        onClick={() => onSendToCustomer(link)}
                                      >
                                        <i
                                          className="bi bi-envelope"
                                          aria-hidden
                                        />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {links.length === 0 && !loading && (
                              <tr>
                                <td colSpan={7}>
                                  <div className="booking-payments-table-empty">
                                    <i
                                      className="bi bi-link-45deg booking-payments-table-empty__icon"
                                      aria-hidden
                                    />
                                    <p className="booking-payments-table-empty__title">
                                      No payment links yet
                                    </p>
                                    <p className="booking-payments-table-empty__text">
                                      Generate a link above to send a secure
                                      checkout page to your customer.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <table className="booking-payments-table booking-payments-table--made">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Quotation credit</th>
                              <th>Gross</th>
                              <th>Proc. fee</th>
                              <th>Plat. fee</th>
                              <th>Method</th>
                              <th>Status</th>
                              <th>Transaction</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visiblePayments.map((payment) => (
                              <tr
                                key={payment.id}
                                className="booking-payments-table-row"
                              >
                                <td className="booking-payments-table-date">
                                  {formatPaymentDate(
                                    payment.transaction_date ||
                                      payment.created_at,
                                  )}
                                </td>
                                <td className="booking-payments-table-amount">
                                  {formatCurrency(
                                    paymentCreditAmount(payment),
                                    currencyOptions,
                                  )}
                                </td>
                                <td>
                                  {formatPaymentField(payment.charge_amount)}
                                </td>
                                <td>
                                  {formatPaymentField(payment.processing_fee)}
                                </td>
                                <td>
                                  {formatPaymentField(payment.platform_fee)}
                                </td>
                                <td>{payment.payment_method.trim() || "—"}</td>
                                <td>
                                  <span
                                    className={paymentStatusClass(
                                      payment.transaction_status,
                                    )}
                                  >
                                    {formatTransactionStatus(
                                      payment.transaction_status,
                                    )}
                                  </span>
                                </td>
                                <td className="booking-payments-table-txn">
                                  {payment.transaction_id.trim() || "—"}
                                </td>
                              </tr>
                            ))}
                            {payments.length === 0 && !loading && (
                              <tr>
                                <td colSpan={8}>
                                  <div className="booking-payments-table-empty">
                                    <i
                                      className="bi bi-cash-stack booking-payments-table-empty__icon"
                                      aria-hidden
                                    />
                                    <p className="booking-payments-table-empty__title">
                                      No payments recorded yet
                                    </p>
                                    <p className="booking-payments-table-empty__text">
                                      Completed checkouts and manual payments
                                      will appear here.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {!loading &&
                    activeTab === "links" &&
                    hiddenLinksCount > 0 ? (
                      <div className="booking-payments-table-footer">
                        <button
                          type="button"
                          className="btn btn-link booking-payments-show-more"
                          onClick={handleShowMoreLinks}
                        >
                          Show more
                          <span className="booking-payments-show-more__count">
                            ({hiddenLinksCount} more)
                          </span>
                        </button>
                      </div>
                    ) : null}
                    {!loading &&
                    activeTab === "made" &&
                    hiddenPaymentsCount > 0 ? (
                      <div className="booking-payments-table-footer">
                        <button
                          type="button"
                          className="btn btn-link booking-payments-show-more"
                          onClick={handleShowMorePayments}
                        >
                          Show more
                          <span className="booking-payments-show-more__count">
                            ({hiddenPaymentsCount} more)
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer booking-payments-modal__footer">
              <div className="booking-payments-footer-actions">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setManualPaymentOpen(true)}
                >
                  <i className="bi bi-plus-circle me-1" aria-hidden />
                  Add manual payment
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={paidBalance <= 0}
                  onClick={() => setRefundOpen(true)}
                >
                  <i className="bi bi-arrow-counterclockwise me-1" aria-hidden />
                  Record refund
                </button>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {manualPaymentOpen && (
        <ManualPaymentModal
          bookingId={bookingId}
          contactEmail={contactEmail}
          defaultAmount={chargeInput}
          onClose={() => setManualPaymentOpen(false)}
          onSaved={() => {
            void loadPayments(mainCompany);
            setActiveTab("made");
          }}
        />
      )}

      {refundOpen && (
        <RefundModal
          bookingId={bookingId}
          maxRefundAmount={paidBalance}
          defaultAmount={paidBalance > 0 ? paidBalance.toFixed(2) : ""}
          onClose={() => setRefundOpen(false)}
          onSaved={() => {
            void loadPayments(mainCompany);
            setActiveTab("made");
          }}
        />
      )}

      {kybModalOpen && mainCompany && (
        <CompanyKybModal
          companyId={mainCompany.id}
          companyName={mainCompany.name}
          companyBusinessLegalName={mainCompany.business_legal_name}
          stacked
          onClose={() => setKybModalOpen(false)}
          onSaved={async () => {
            await refreshCompany();
            await loadPayments(mainCompany);
          }}
        />
      )}
    </>,
    document.body,
  );
}
