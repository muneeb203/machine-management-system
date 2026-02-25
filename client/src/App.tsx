import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Import all module pages
import Contracts from './pages/Contracts';
import DailyProduction from './pages/Production';
import Billing from './pages/Billing';
import OptimizedBilling from './pages/OptimizedBilling';
import GatePasses from './pages/GatePasses';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import Machines from './pages/Machines';
import RateManagement from './pages/RateManagement';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import ContractProgress from './pages/ContractProgress';
import Clipping from './pages/Clipping';
import Masters from './pages/Masters'; // Added Import

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRoles?: string[] }> = ({
  children,
  requiredRoles = []
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Global Settings */}
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />

        {/* Contract Management - Admin can create/edit, Operator view-only */}
        <Route path="/contracts" element={
          <ProtectedRoute>
            <Contracts />
          </ProtectedRoute>
        } />

        <Route path="/contract-progress" element={
          <ProtectedRoute>
            <ContractProgress />
          </ProtectedRoute>
        } />

        {/* Machine Management - Admin full access, Operator view-only */}
        <Route path="/machines" element={
          <ProtectedRoute>
            <Machines />
          </ProtectedRoute>
        } />

        {/* Master Management */}
        <Route path="/masters" element={
          <ProtectedRoute>
            <Masters />
          </ProtectedRoute>
        } />

        {/* Daily Production - Admin can edit all, Operator same-day only */}
        <Route path="/production" element={
          <ProtectedRoute requiredRoles={['admin', 'operator']}>
            <DailyProduction />
          </ProtectedRoute>
        } />

        {/* Billing - Admin full access, Operator view summaries */}
        <Route path="/billing" element={
          <ProtectedRoute>
            <Billing />
          </ProtectedRoute>
        } />

        {/* Optimized Billing - Matrix style billing */}
        <Route path="/optimized-billing" element={
          <ProtectedRoute>
            <OptimizedBilling />
          </ProtectedRoute>
        } />

        {/* Gate Pass & Inventory - Admin full access, Operator view-only */}
        <Route path="/gate-passes" element={
          <ProtectedRoute>
            <GatePasses />
          </ProtectedRoute>
        } />

        {/* Reports - Admin full reports, Operator limited dashboards */}
        <Route path="/reports" element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        } />

        {/* Analytics - Old Reports Page renamed */}
        <Route path="/analytics" element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        } />

        {/* Clipping - Admin/Operator */}
        <Route path="/clipping" element={
          <ProtectedRoute>
            <Clipping />
          </ProtectedRoute>
        } />

        {/* Admin-only routes */}
        <Route path="/admin" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Admin />
          </ProtectedRoute>
        } />

        <Route path="/admin/rates" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <RateManagement />
          </ProtectedRoute>
        } />

        <Route path="/admin/users" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;