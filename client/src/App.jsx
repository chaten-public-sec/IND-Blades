import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './components/ThemeProvider';
import DashboardLayout from './components/DashboardLayout';
import HomePage from './pages/HomePage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import OverviewPage from './pages/OverviewPage';
import NotificationsPage from './pages/NotificationsPage';
import ActivityPage from './pages/ActivityPage';
import EventsPage from './pages/EventsPage';
import StrikePage from './pages/StrikePage';
import WelcomePage from './pages/WelcomePage';
import LogsPage from './pages/LogsPage';
import DiscordLogsPage from './pages/DiscordLogsPage';
import AutoRolePage from './pages/AutoRolePage';
import UsersPage from './pages/UsersPage';
import BotChatPage from './pages/BotChatPage';

function App() {
  return (
    <ThemeProvider>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'rgba(var(--bg-card-rgb), 0.88)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '18px',
            color: 'var(--text-main)',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 24px 50px -18px rgba(2,6,23,0.46)',
          },
        }}
      />
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="strikes" element={<StrikePage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="discord-logs" element={<DiscordLogsPage />} />
            <Route path="autorole" element={<AutoRolePage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="bot-chat" element={<BotChatPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
