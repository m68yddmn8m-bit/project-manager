import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as api from "../api";
import type { Notification } from "../types";
import { timeAgo } from "../utils/format";
import clsx from "clsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    api.listNotifications().then(setNotifications).catch(() => {});
    const interval = setInterval(() => {
      api.listNotifications().then(setNotifications).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-blue-600 tracking-tight">
            ProjectHub
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100")
              }
            >
              Projects
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs((v) => !v)}
                className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V5a1 1 0 10-2 0v.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 card shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unread > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 && (
                      <li className="px-4 py-6 text-center text-sm text-gray-500">No notifications</li>
                    )}
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        className={clsx("px-4 py-3 hover:bg-gray-50 cursor-pointer", !n.is_read && "bg-blue-50")}
                        onClick={() => {
                          api.markNotificationRead(n.id);
                          setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
                          if (n.link) navigate(n.link);
                          setShowNotifs(false);
                        }}
                      >
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
              <button onClick={handleLogout} className="btn-secondary text-xs py-1.5">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
