import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../utils/useMediaQuery';
import { ShoppingBag, Users, BarChart3, Settings, LogOut, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

export default function Navbar({ activeTab, onTabChange }) {
  const { user, logout, canOrder, canViewBudget, canManageUsers } = useAuth();
  const isMobile = useIsMobile(768);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Admin':
        return { bg: '#3b1d54', color: '#c084fc', border: '1px solid #9333ea', label: 'Admin', shortLabel: 'Admin' };
      case 'Lead':
      case 'Purchaser':
        return { bg: '#17324d', color: '#60a5fa', border: '1px solid #2563eb', label: "Chef d'équipe", shortLabel: 'Lead' };
      default:
        return { bg: '#1e293b', color: '#94a3b8', border: '1px solid #475569', label: 'Membre', shortLabel: 'Membre' };
    }
  };

  const badge = getRoleBadge(user?.role);

  // Mobile Layout (< 768px): Top Compact Bar (52px) + Fixed Bottom Nav Bar
  if (isMobile) {
    return (
      <>
        {/* Top Bar Compacte (52px) */}
        <header style={{
          height: '52px',
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#111317',
          borderBottom: '1px solid #232730',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          {/* Logo & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              color: '#fff',
              fontSize: '1rem',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)',
              border: '1px solid #10b981'
            }}>
              ⚡
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                FSAE <span style={{ color: '#10b981' }}>UQTR</span>
              </div>
            </div>
          </div>

          {/* User info & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {user?.department && (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                padding: '0.15rem 0.45rem',
                borderRadius: '5px',
                backgroundColor: '#064e3b',
                color: '#a7f3d0',
                border: '1px solid #059669'
              }}>
                {user.department}
              </span>
            )}

            <span style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              backgroundColor: badge.bg,
              color: badge.color,
              border: badge.border
            }}>
              {badge.shortLabel}
            </span>

            <button
              onClick={logout}
              title="Se déconnecter"
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: '6px',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
              }}
            >
              <LogOut style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </header>

        {/* Bottom Navigation Bar */}
        <nav className="mobile-bottom-nav" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 'calc(3.75rem + var(--safe-bottom, 0px))',
          paddingBottom: 'var(--safe-bottom, 0px)',
          backgroundColor: 'rgba(17, 19, 23, 0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid #232730',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 50
        }}>
          {/* Tab 1: Demandes */}
          <button
            onClick={() => onTabChange('funnel')}
            style={{
              flex: 1,
              height: '100%',
              minHeight: '44px',
              background: 'transparent',
              border: 'none',
              color: activeTab === 'funnel' ? '#60a5fa' : '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            {activeTab === 'funnel' && (
              <span style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                right: '25%',
                height: '2px',
                backgroundColor: '#3b82f6',
                borderRadius: '2px'
              }} />
            )}
            <ShoppingBag style={{ width: '20px', height: '20px' }} />
            <span style={{ fontSize: '0.68rem', fontWeight: activeTab === 'funnel' ? '700' : '500' }}>
              Demandes
            </span>
          </button>

          {/* Tab 2: Achats (canOrder) */}
          {canOrder && (
            <button
              onClick={() => onTabChange('purchaser')}
              style={{
                flex: 1,
                height: '100%',
                minHeight: '44px',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'purchaser' ? '#34d399' : '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              {activeTab === 'purchaser' && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: '2px',
                  backgroundColor: '#10b981',
                  borderRadius: '2px'
                }} />
              )}
              <Shield style={{ width: '20px', height: '20px' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: activeTab === 'purchaser' ? '700' : '500' }}>
                Achats
              </span>
            </button>
          )}

          {/* Tab 3: Budget (canViewBudget) */}
          {canViewBudget && (
            <button
              onClick={() => onTabChange('cost-report')}
              style={{
                flex: 1,
                height: '100%',
                minHeight: '44px',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'cost-report' ? '#c084fc' : '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              {activeTab === 'cost-report' && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: '2px',
                  backgroundColor: '#a855f7',
                  borderRadius: '2px'
                }} />
              )}
              <BarChart3 style={{ width: '20px', height: '20px' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: activeTab === 'cost-report' ? '700' : '500' }}>
                Budget
              </span>
            </button>
          )}

          {/* Tab 4: Équipe (canManageUsers) */}
          {canManageUsers && (
            <button
              onClick={() => onTabChange('users')}
              style={{
                flex: 1,
                height: '100%',
                minHeight: '44px',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'users' ? '#facc15' : '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              {activeTab === 'users' && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: '2px',
                  backgroundColor: '#eab308',
                  borderRadius: '2px'
                }} />
              )}
              <Users style={{ width: '20px', height: '20px' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: activeTab === 'users' ? '700' : '500' }}>
                Équipe
              </span>
            </button>
          )}
        </nav>
      </>
    );
  }

  // Desktop Layout (>= 768px): Full Horizontal Bar
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            color: '#fff',
            fontSize: '1.15rem',
            boxShadow: '0 0 14px rgba(16, 185, 129, 0.45)',
            border: '1px solid #10b981'
          }}>
            ⚡
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1.05rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
              FORMULE SAE <span style={{ color: '#10b981' }}>UQTR</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#fb923c', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: '700' }}>
              Monoplace Électrique • Logistique
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

          {canOrder && (
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

          {canViewBudget && (
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
          )}

          {canManageUsers && (
            <button
              onClick={() => onTabChange('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: activeTab === 'users' ? '1px solid #eab308' : '1px solid transparent',
                backgroundColor: activeTab === 'users' ? '#713f1233' : 'transparent',
                color: activeTab === 'users' ? '#facc15' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Users style={{ width: '16px', height: '16px' }} />
              👥 Gestion Équipe & Accès
            </button>
          )}
        </nav>
      </div>

      {/* User Info & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f1f5f9' }}>{user?.name}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{user?.email}</div>
        </div>

        {user?.department && (
          <span
            title={`Pôle : ${user.department}${user.subsystem ? ' • ' + user.subsystem : ''}`}
            style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              backgroundColor: '#064e3b',
              color: '#a7f3d0',
              border: '1px solid #059669',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            ⚡ {user.department}
          </span>
        )}

        <span style={{
          fontSize: '0.72rem',
          fontWeight: '700',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          backgroundColor: badge.bg,
          color: badge.color,
          border: badge.border
        }}>
          {badge.label}
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
