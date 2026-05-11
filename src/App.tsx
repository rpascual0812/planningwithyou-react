import './App.css'
import { Suspense, lazy, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

const CalendarPage = lazy(() => import('./pages/CalendarPage'))

function App() {
  const location = useLocation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const pageTitleByPath: Record<string, string> = {
    '/': 'Dashboard',
    '/calendar': 'Calendar',
    '/reports': 'Reports',
    '/settings': 'Settings',
  }

  const pageTitle = pageTitleByPath[location.pathname] ?? 'Dashboard'

  return (
    <div
      className={`app-wrapper layout-fixed sidebar-expand-lg bg-body-tertiary${
        isSidebarCollapsed ? ' sidebar-collapse' : ''
      }`}
    >
      <Navbar onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)} />
      <Sidebar />

      <main className="app-main">
        <div className="app-content-header">
          <div className="container-fluid">
            <div className="row">
              <div className="col-sm-6">
                <h3 className="mb-0">{pageTitle}</h3>
              </div>
            </div>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="app-content">
              <div className="container-fluid py-3">Loading calendar...</div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/calendar"
              element={<CalendarPage isSidebarCollapsed={isSidebarCollapsed} />}
            />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
