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
import AutoRolePage from './pages/AutoRolePage';
import NotificationsPage from './pages/NotificationsPage';
import StrikePage from './pages/StrikePage';

function App() {
  return (
    <ThemeProvider>
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
