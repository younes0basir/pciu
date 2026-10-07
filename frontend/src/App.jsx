import { Navigate, Route, Routes } from 'react-router-dom'
import BoardPage from '@/pages/BoardPage.jsx'
import LoginPage from '@/pages/LoginPage.jsx'
import RegisterPage from '@/pages/RegisterPage.jsx'
import AdminPage from '@/pages/AdminPage.jsx'
import AccueilDashboardPage from '@/pages/AccueilDashboardPage.jsx'
import ChiefDashboardPage from '@/pages/ChiefDashboardPage.jsx'
import DoctorDashboardPage from '@/pages/DoctorDashboardPage.jsx'
import NurseDashboardPage from '@/pages/NurseDashboardPage.jsx'
import SetupPasswordPage from '@/pages/SetupPasswordPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/board" element={<BoardPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/chief" element={<ChiefDashboardPage />} />
      <Route path="/accueil" element={<AccueilDashboardPage />} />
      <Route path="/doctor" element={<DoctorDashboardPage />} />
      <Route path="/nurse" element={<NurseDashboardPage />} />
      <Route path="/people" element={<Navigate to="/admin" replace />} />
      <Route path="/setup-password" element={<SetupPasswordPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
