import { useCallback, useEffect, useRef, useState } from "react";
import UserNotificationModal from "./UserNotificationModal";
import {
  deleteUserNotification,
  fetchUnreadNotificationCount,
  fetchUserNotifications,
  openUserNotification,
  type UserNotificationRecord,
} from "../services/userNotifications";

const POLL_MS = 30_000;

const UserNotificationsDropdown = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<UserNotificationRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<UserNotificationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLLIElement>(null);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await fetchUserNotifications();
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
    const interval = window.setInterval(() => {
      void refreshUnreadCount();
    }, POLL_MS);
    const onFocus = () => {
      void refreshUnreadCount();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!menuOpen) return;
    void loadList();
  }, [menuOpen, loadList]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("click", onDocClick);
    }
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  const handleOpenNotification = async (row: UserNotificationRecord) => {
    setMenuOpen(false);
    try {
      const full = await openUserNotification(row.id);
      setSelected(full);
      setItems((prev) =>
        prev.map((item) =>
          item.id === full.id
            ? { ...item, is_read: true, read_at: full.read_at }
            : item,
        ),
      );
      void refreshUnreadCount();
    } catch {
      setSelected(row);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteUserNotification(selected.id);
      setItems((prev) => prev.filter((item) => item.id !== selected.id));
      setSelected(null);
      void refreshUnreadCount();
    } finally {
      setDeleting(false);
    }
  };

  const badgeLabel =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : "";

  return (
    <>
      <li
        className="nav-item dropdown nav-notifications-dropdown"
        ref={menuRef}
      >
        <button
          type="button"
          className="nav-link nav-notifications-toggle"
          aria-label="Notifications"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <i className="bi bi-bell" aria-hidden="true" />
          {badgeLabel && (
            <span className="nav-notifications-badge" aria-hidden="true">
              {badgeLabel}
            </span>
          )}
        </button>
        <div
          className={`dropdown-menu dropdown-menu-end nav-notifications-menu${
            menuOpen ? " show" : ""
          }`}
        >
          <div className="dropdown-header nav-notifications-header d-flex align-items-center justify-content-between">
            Notifications
            {unreadCount > 0 && (
              <span className="badge text-bg-primary ms-2">
                {unreadCount} new
              </span>
            )}
          </div>
          {loadingList ? (
            <div className="dropdown-item-text text-muted small py-3">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="dropdown-item-text text-muted small py-3">
              No notifications yet.
            </div>
          ) : (
            items.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`dropdown-item nav-notifications-item-row${
                  row.is_read ? "" : " nav-notifications-item-row--unread"
                }`}
                onClick={() => void handleOpenNotification(row)}
              >
                <span className="nav-notifications-item-title">
                  {row.title}
                </span>
                <span className="nav-notifications-item-preview">
                  {row.message}
                </span>
              </button>
            ))
          )}
        </div>
      </li>

      <UserNotificationModal
        notification={selected}
        deleting={deleting}
        onDelete={() => void handleDelete()}
        onClose={() => setSelected(null)}
      />
    </>
  );
};

export default UserNotificationsDropdown;
