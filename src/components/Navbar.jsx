import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, Users, BarChart3, Settings, LogOut, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

export default function Navbar({ activeTab, onTabChange }) {
  const { user, logout, isPurchaserOrAdmin } = useAuth();

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'Admin':
        return { bg: '#3b1d54', color: '#c084fc', border: '1px solid #9333ea' };
      case 'Purchaser':
        return { bg: '#17324d', color: '#60a5fa', border: '1px solid #2563eb' };
      default:
        return { bg: '#1e293b', color: '#94a3b8', border: '1px solid #475569' };
    }
  };

  const badgeStyle = getRoleBadgeStyle(user?.role);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.85rem 1.75rem',
      backgroundColor: '#111317',
      borderBottom: '1px solid #232730',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            color: '#fff',
            fontSize: '1.1rem',
            boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)'
          }}>
            ⚡
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1.05rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
              FSAE <span style={{ color: '#ef4444' }}>LOGISTICS</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Order & Supply Manager
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '1.5rem' }}>
          <button
            onClick={() => onTabChange('funnel')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: activeTab === 'funnel' ? '1px solid #3b82f6' : '1px solid transparent',
              backgroundColor: activeTab === 'funnel' ? '#1e3a8a33' : 'transparent',
              color: activeTab === 'funnel' ? '#60a5fa' : '#94a3b8',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <ShoppingBag style={{ width: '16px', height: '16px' }} />
            Demandes de Pièces
          </button>

          {isPurchaserOrAdmin && (
            <button
              onClick={() => onTabChange('purchaser')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: activeTab === 'purchaser' ? '1px solid #10b981' : '1px solid transparent',
                backgroundColor: activeTab === 'purchaser' ? '#065f4633' : 'transparent',
                color: activeTab === 'purchaser' ? '#34d399' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Shield style={{ width: '16px', height: '16px' }} />
              Commandes Groupées (PO)
            </button>
          )}

          <button
            onClick={() => onTabChange('cost-report')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: activeTab === 'cost-report' ? '1px solid #a855f7' : '1px solid transparent',
              backgroundColor: activeTab === 'cost-report' ? '#581c8733' : 'transparent',
              color: activeTab === 'cost-report' ? '#c084fc' : '#94a3b8',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <BarChart3 style={{ width: '16px', height: '16px' }} />
            Cost Report FSAE
          </button>
        </nav>
      </div>

      {/* User Info & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f1f5f9' }}>{user?.name}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{user?.email}</div>
        </div>

        <span style={{
          fontSize: '0.72rem',
          fontWeight: '700',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          backgroundColor: badgeStyle.bg,
          color: badgeStyle.color,
          border: badgeStyle.border
        }}>
          {user?.role}
        </span>

        <button
          onClick={logout}
          title="Se déconnecter"
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: '#94a3b8',
            borderRadius: '6px',
            padding: '0.45rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
        >
          <LogOut style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </header>
  );
}
