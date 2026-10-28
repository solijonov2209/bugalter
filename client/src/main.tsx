import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Adjustments from './pages/Adjustments';
import CashPayouts from './pages/CashPayouts';
import Payroll from './pages/Payroll';
import Groups from './pages/Groups';
import Students from './pages/Students';
import Settings from './pages/Settings';
import MySalary from './pages/MySalary';

function AppRoutes() {
  const { me, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-500">Yuklanmoqda…</div>;
  if (!me)
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );

  if (me.user.role === 'employee')
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MySalary />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );

  const center = me.org.type === 'center';
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/adjustments" element={<Adjustments />} />
        <Route path="/cash-payouts" element={<CashPayouts />} />
        <Route path="/payroll" element={<Payroll />} />
        {center && <Route path="/groups" element={<Groups />} />}
        {center && <Route path="/students" element={<Students />} />}
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
