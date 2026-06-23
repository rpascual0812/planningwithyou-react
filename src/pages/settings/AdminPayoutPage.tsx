import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchableSelect from "../../components/SearchableSelect";
import {
  fetchCompaniesDirectory,
  type CompanyRecord,
} from "../../services/companies";
import {
  fetchAdminBookingPaymentsPage,
  type AdminBookingPaymentsPage,
  type AdminBookingPaymentRecord,
} from "../../services/adminBookingPayouts";
import { formatAppDateTime } from "../../lib/formatDateTime";

function formatPaymentMethod(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function formatNotes(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PaymentBreakdown({ row }: { row: AdminBookingPaymentRecord }) {
  const lines = [
    { label: "Quotation credit", value: row.base_amount, emphasize: true },
    { label: "Gross", value: row.charge_amount },
    { label: "Proc. fee", value: row.processing_fee },
    { label: "Plat. fee", value: row.platform_fee },
    { label: "Net", value: row.net_amount },
  ];

  return (
    <div className="admin-payout-breakdown small">
      {lines.map(({ label, value, emphasize }) => (
        <div key={label} className="d-flex justify-content-between gap-3">
          <span className={emphasize ? "fw-semibold" : "text-muted"}>
            {label}
          </span>
          <span
            className={`font-monospace text-end${emphasize ? " fw-semibold" : ""}`}
          >
            {formatMoney(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const AdminPayoutPage = () => {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companyFilterId, setCompanyFilterId] = useState<number | null>(null);

  const [rows, setRows] = useState<AdminBookingPaymentRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingMoreRef = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  const companyOptions = useMemo(
    () => [
      { value: "", label: "All companies" },
      ...companies.map((company) => ({
        value: String(company.id),
        label: company.name,
      })),
    ],
    [companies],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setCompaniesLoading(true);
    void fetchCompaniesDirectory()
      .then((companyRows) => {
        if (!cancelled) setCompanies(companyRows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load companies");
        }
      })
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setLoading(true);
        setError(null);
      } else {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        const data: AdminBookingPaymentsPage =
          await fetchAdminBookingPaymentsPage(pageNum, {
            companyId: companyFilterId,
            search: debouncedSearch,
          });
        setRows((prev) =>
          replace ? data.results : [...prev, ...data.results],
        );
        setTotalCount(data.count);
        setPage(pageNum);
        setHasMore(data.next != null);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to load payments received";
        if (replace) {
          setError(message);
          setRows([]);
          setTotalCount(0);
          setPage(0);
          setHasMore(false);
        }
      } finally {
        if (replace) {
          setLoading(false);
        } else {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [companyFilterId, debouncedSearch],
  );

  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  const loadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void loadPage(page + 1, false);
  }, [hasMore, loading, loadingMore, page, loadPage]);

  const maybeLoadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    const root = scrollRootRef.current;
    const containerHasVerticalScroll =
      !!root && root.scrollHeight > root.clientHeight + 1;
    const nearContainerBottom =
      !!root && root.scrollTop + root.clientHeight >= root.scrollHeight - 12;
    const pageRoot = document.documentElement;
    const nearPageBottom =
      window.innerHeight + window.scrollY >= pageRoot.scrollHeight - 12;
    if (
      (containerHasVerticalScroll && nearContainerBottom) ||
      (!containerHasVerticalScroll && nearPageBottom)
    ) {
      loadNextPage();
    }
  }, [hasMore, loading, loadingMore, loadNextPage]);

  const handleRowsScroll = useCallback(() => {
    maybeLoadNextPage();
  }, [maybeLoadNextPage]);

  useEffect(() => {
    window.addEventListener("scroll", maybeLoadNextPage, { passive: true });
    return () => window.removeEventListener("scroll", maybeLoadNextPage);
  }, [maybeLoadNextPage]);

  return (
    <div className="emails-table-card">
      <div className="row g-2 align-items-end mb-3 px-2 pt-2">
        <div className="col-sm-8 col-md-4">
          <SearchableSelect
            label="Company"
            labelClassName="form-label mb-1"
            wrapperClassName=""
            size="sm"
            value={companyFilterId != null ? String(companyFilterId) : ""}
            onChange={(raw) => {
              setCompanyFilterId(raw === "" ? null : Number(raw));
            }}
            options={companyOptions}
            placeholder="All companies"
            searchPlaceholder="Search companies…"
            emptyMessage="No companies match your search"
            disabled={companiesLoading}
            loading={companiesLoading}
          />
        </div>
      </div>

      <div className="emails-table-toolbar">
        <div className="emails-search">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="emails-search-input"
            placeholder="Search company, quotation, transaction…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search payments received"
          />
          {search && (
            <button
              type="button"
              className="emails-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
        <div className="emails-toolbar-right">
          <span className="emails-search-count">
            {totalCount > 0
              ? `${rows.length} of ${totalCount} payments`
              : `${rows.length} payment${rows.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      <div
        ref={scrollRootRef}
        className="emails-table-scroll"
        onScroll={handleRowsScroll}
      >
        {loading && rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty">
              Loading payments received…
            </span>
          </div>
        ) : error && rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty text-danger">{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty">
              No payments received found.
            </span>
          </div>
        ) : (
          <table className="emails-table">
            <thead>
              <tr>
                <th>Company / Quotation</th>
                <th>Payment breakdown</th>
                <th>Payment method</th>
                <th>Transaction</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="fw-semibold">{row.company_name}</div>
                    <div className="small fw-semibold">
                      {row.quotation_unique_id || "—"}
                    </div>
                    <div className="text-muted small">
                      {row.quotation_title}
                    </div>
                  </td>
                  <td className="small">
                    <PaymentBreakdown row={row} />
                  </td>
                  <td className="small text-muted">
                    {formatPaymentMethod(row.payment_method)}
                  </td>
                  <td className="small">
                    <div className="mb-2">
                      <div className="text-muted small mb-1">
                        Transaction ID
                      </div>
                      <div className="text-muted font-monospace">
                        {row.transaction_id || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted small mb-1">Notes</div>
                      <div className="text-muted">{formatNotes(row.notes)}</div>
                    </div>
                  </td>
                  <td className="small text-muted">
                    {formatAppDateTime(row.transaction_date)}
                  </td>
                </tr>
              ))}
              {hasMore && rows.length > 0 && (
                <tr className="emails-list-sentinel">
                  <td colSpan={5} className="text-center text-muted small py-3">
                    {loadingMore ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Loading more...
                      </>
                    ) : (
                      "Scroll for more"
                    )}
                  </td>
                </tr>
              )}
              {!hasMore && rows.length > 0 && !loading && (
                <tr className="emails-list-end">
                  <td colSpan={5} className="emails-table-empty">
                    All {totalCount} payment
                    {totalCount !== 1 ? "s have" : " has"} been loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {error && rows.length > 0 && (
        <p className="text-danger small px-2 pb-2 mb-0">{error}</p>
      )}
    </div>
  );
};

export default AdminPayoutPage;
