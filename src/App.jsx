import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginView from './views/LoginView';
import MemberFunnelView from './views/MemberFunnelView';
import PurchaserDashboard from './views/PurchaserDashboard';
import CostReportView from './views/CostReportView';
import AdminUsersView from './views/AdminUsersView';

function AppContent() {
  const { user, loading, canOrder, canViewBudget, canManageUsers } = useAuth();
  const [activeTab, setActiveTab] = useState('funnel');

  // Fallback to 'funnel' tab if user loses permission for active tab
  React.useEffect(() => {
    if (activeTab === 'purchaser' && !canOrder) {
      setActiveTab('funnel');
    }
    if (activeTab === 'cost-report' && !canViewBudget) {
      setActiveTab('funnel');
    }
    if (activeTab === 'users' && !canManageUsers) {
      setActiveTab('funnel');
    }
  }, [activeTab, canOrder, canViewBudget, canManageUsers]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0c0d10',
        color: '#94a3b8',
        gap: '1rem'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '3px solid #334155',
          borderTopColor: '#ef4444',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontSize: '0.9rem' }}>Initialisation de la session FSAE...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0c0d10', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main style={{ flex: 1 }}>
        {activeTab === 'funnel' && <MemberFunnelView />}
        {activeTab === 'purchaser' && (canOrder ? <PurchaserDashboard /> : <MemberFunnelView />)}
        {activeTab === 'cost-report' && (canViewBudget ? <CostReportView /> : <MemberFunnelView />)}
        {activeTab === 'users' && (canManageUsers ? <AdminUsersView /> : <MemberFunnelView />)}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        borderTop: '1px solid #1e2430',
        color: '#64748b',
        fontSize: '0.75rem',
        backgroundColor: '#0c0d10'
      }}>
        🏎️ <strong>FSAE Order Manager</strong> • Ingénierie Logistique & Approvisionnement Véhicule Électrique • Raspberry Pi ARM Deployment
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
