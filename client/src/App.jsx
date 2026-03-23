import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import Login from './components/Login';
import DashboardLayout from './components/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import EventsPage from './pages/EventsPage';
import WelcomePage from './pages/WelcomePage';
import UsersPage from './pages/UsersPage';
import ActivityPage from './pages/ActivityPage';
import LogsPage from './pages/LogsPage';
import DiscordLogsPage from './pages/DiscordLogsPage';
import AutoRolePage from './pages/AutoRolePage';
import NotificationsPage from './pages/NotificationsPage';
import StrikePage from './pages/StrikePage';
import { Toaster } from 'sonner';

function App() {
  return (
    <ThemeProvider>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton 
        toastOptions={{
          style: {
            background: 'rgba(var(--bg-card-rgb), 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            color: 'var(--text-main)',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
            letterSpacing: '-0.01em'
          },
          className: 'glass-toast border-white/10'
        }}
      />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="discord-logs" element={<DiscordLogsPage />} />
            <Route path="strikes" element={<StrikePage />} />
            <Route path="autorole" element={<AutoRolePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
