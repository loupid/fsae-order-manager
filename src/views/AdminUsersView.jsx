import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../utils/useMediaQuery';
import {
  Users,
  Shield,
  Zap,
  User,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Info,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const DEPARTMENTS = [
  { code: 'ELE', name: 'Team Électrique' },
  { code: 'STR', name: 'Team Structure' },
  { code: 'DRI', name: 'Team Drivetrain' },
  { code: 'ERG', name: 'Team Ergonomie' },
  { code: 'ADM', name: 'Team Administration' }
];

export default function AdminUsersView() {
  const { user: currentUser, refreshUser } = useAuth();
  const isMobile = useIsMobile(768);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Security rules banner collapse state
  const [showMobileRules, setShowMobileRules] = useState(false);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors du chargement des utilisateurs' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.discord_handle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.subsystem?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'Lead' && (u.role === 'Lead' || u.role === 'Purchaser')) ||
        u.role === roleFilter;

      const matchesDept =
        deptFilter === 'ALL' ||
        u.department === deptFilter;

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [users, searchTerm, roleFilter, deptFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'Admin').length;
    const leads = users.filter(u => u.role === 'Lead' || u.role === 'Purchaser').length;
    const members = users.filter(u => u.role === 'Member').length;
    return { total, admins, leads, members };
  }, [users]);

  // Handle instant role change
  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;
    setUpdatingId(targetUser.id);
    setFeedback(null);

    try {
      const updated = await apiClient.updateUser(targetUser.id, { role: newRole });
      setUsers(prev => prev.map(u => (u.id === targetUser.id ? { ...u, ...updated } : u)));
      if (targetUser.id === currentUser?.id && typeof refreshUser === 'function') {
        refreshUser();
      }
      setFeedback({
        type: 'success',
        message: `Rôle de ${targetUser.name} mis à jour : ${newRole === 'Lead' ? "Chef d'équipe" : newRole}`
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle instant department change
  const handleDepartmentChange = async (targetUser, newDept) => {
    if (targetUser.department === newDept) return;
    setUpdatingId(targetUser.id);
    setFeedback(null);

    try {
      const updated = await apiClient.updateUser(targetUser.id, { department: newDept });
      setUsers(prev => prev.map(u => (u.id === targetUser.id ? { ...u, ...updated } : u)));
      if (targetUser.id === currentUser?.id && typeof refreshUser === 'function') {
        refreshUser();
      }
      setFeedback({
        type: 'success',
        message: `Pôle de ${targetUser.name} mis à jour : ${newDept || 'Non assigné'}`
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle user deletion
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    setFeedback(null);

    try {
      await apiClient.deleteUser(userToDelete.id);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setFeedback({
        type: 'success',
        message: `L'utilisateur ${userToDelete.name} a été supprimé avec succès.`
      });
      setUserToDelete(null);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  // Department color helper
  const getDeptColor = (code) => {
    switch (code) {
      case 'ELE': return '#10b981';
      case 'STR': return '#38bdf8';
      case 'DRI': return '#f97316';
      case 'ERG': return '#ec4899';
      case 'ADM': return '#a855f7';
      default: return '#94a3b8';
    }
  };

  return (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem 2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.4rem', fontWeight: '800', color: '#f8fafc', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👥 Gestion Équipe & Accès <span style={{ color: '#10b981', fontSize: '1rem', fontWeight: '700' }}>• FSAE UQTR</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
            Panneau Administrateur : attribution des rôles, gestion des pôles et droits budgétaires des membres.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.9rem',
            backgroundColor: '#1e293b',
            color: '#cbd5e1',
            border: '1px solid #334155',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '38px'
          }}
        >
          <RefreshCw style={{ width: '15px', height: '15px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div style={{
          backgroundColor: feedback.type === 'error' ? '#451a1a' : '#064e3b33',
          border: `1px solid ${feedback.type === 'error' ? '#dc2626' : '#059669'}`,
          color: feedback.type === 'error' ? '#f87171' : '#a7f3d0',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {feedback.type === 'error' ? (
              <ShieldAlert style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            ) : (
              <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Cards (2x2 grid on mobile) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: isMobile ? '0.75rem' : '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '0.85rem' : '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Membres
            </span>
            <Users style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
          </div>
          <div style={{ fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: '900', color: '#f8fafc' }}>
            {stats.total}
          </div>
        </div>

        {/* Admins */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '0.85rem' : '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#c084fc', textTransform: 'uppercase' }}>
              Admins
            </span>
            <Shield style={{ width: '16px', height: '16px', color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: '900', color: '#c084fc' }}>
            {stats.admins}
          </div>
        </div>

        {/* Leads */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '0.85rem' : '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#60a5fa', textTransform: 'uppercase' }}>
              Chefs Pôle
            </span>
            <Zap style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: '900', color: '#60a5fa' }}>
            {stats.leads}
          </div>
        </div>

        {/* Regular Members */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '0.85rem' : '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Réguliers
            </span>
            <User style={{ width: '16px', height: '16px', color: '#64748b' }} />
          </div>
          <div style={{ fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: '900', color: '#cbd5e1' }}>
            {stats.members}
          </div>
        </div>
      </div>

      {/* Rules & Safeguards Info Banner (collapsible on mobile) */}
      <div style={{
        backgroundColor: '#172033',
        border: '1px solid #1e3a8a',
        borderRadius: '10px',
        padding: isMobile ? '0.65rem 0.85rem' : '0.85rem 1.15rem',
        marginBottom: '1.25rem',
        fontSize: '0.8rem',
        color: '#93c5fd'
      }}>
        {isMobile ? (
          <div>
            <div
              onClick={() => setShowMobileRules(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontWeight: '700',
                userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info style={{ width: '16px', height: '16px', color: '#60a5fa', flexShrink: 0 }} />
                <span>Règles d'accès et sécurité</span>
              </div>
              {showMobileRules ? (
                <ChevronUp style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#60a5fa' }}>
                  <span>Afficher</span>
                  <ChevronDown style={{ width: '14px', height: '14px' }} />
                </div>
              )}
            </div>
            {showMobileRules && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #1e3a8a55', lineHeight: '1.45', fontSize: '0.78rem' }}>
                Un Administrateur ne peut ni se rétrograder lui-même ni supprimer son propre compte, et le dernier administrateur est protégé. Seuls les <strong>Chefs du pôle Administration (ADM)</strong> et les <strong>Administrateurs</strong> peuvent éditer les budgets du Cost Report.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Info style={{ width: '20px', height: '20px', flexShrink: 0, color: '#60a5fa' }} />
            <div>
              <strong>Règles d'accès et sécurité :</strong> Un Administrateur ne peut ni se rétrograder lui-même ni supprimer son propre compte, et le dernier administrateur est protégé contre toute rétrogradation. Seuls les <strong>Chefs d'équipe du pôle Team Administration (ADM)</strong> et les <strong>Administrateurs</strong> peuvent éditer les budgets du Cost Report.
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        marginBottom: '1rem',
        backgroundColor: '#161920',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        border: '1px solid #232733'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: isMobile ? '100%' : '220px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, courriel, discord..."
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
              backgroundColor: '#0f1115',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Filter Dropdowns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'auto auto',
          gap: '0.65rem',
          width: isMobile ? '100%' : 'auto'
        }}>
          {/* Role Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '600' }}>Rôle :</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.65rem',
                backgroundColor: '#0f1115',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem',
                minHeight: '42px'
              }}
            >
              <option value="ALL">Tous les rôles</option>
              <option value="Admin">Admin</option>
              <option value="Lead">Chef d'équipe</option>
              <option value="Member">Membre</option>
            </select>
          </div>

          {/* Department Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '600' }}>Pôle :</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.65rem',
                backgroundColor: '#0f1115',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem',
                minHeight: '42px'
              }}
            >
              <option value="ALL">Tous les pôles</option>
              {DEPARTMENTS.map(d => (
                <option key={d.code} value={d.code}>[{d.code}] {d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users List: Mobile Cards or Desktop Table */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#161920', borderRadius: '12px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid #334155', borderTopColor: '#10b981', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          Chargement des utilisateurs...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', backgroundColor: '#161920', borderRadius: '12px' }}>
          Aucun utilisateur ne correspond aux critères de recherche.
        </div>
      ) : isMobile ? (
        /* Mobile Member Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredUsers.map(u => {
            const isCurrent = currentUser?.id === u.id;
            const isBusy = updatingId === u.id;
            const canEditBudgets = u.role === 'Admin' || ((u.role === 'Lead' || u.role === 'Purchaser') && (u.department === 'ADM' || u.department === 'Team Administration'));

            return (
              <div key={u.id} style={{
                backgroundColor: '#161920',
                border: isCurrent ? '1px solid #1e3a8a' : '1px solid #232733',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {/* Header: User avatar, name, email, delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      color: '#94a3b8',
                      fontSize: '0.9rem'
                    }}>
                      {u.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.92rem' }}>
                        {u.name}
                        {isCurrent && (
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: '#064e3b', color: '#6ee7b7' }}>
                            Vous
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {u.email}
                      </div>
                    </div>
                  </div>

                  {!isCurrent ? (
                    <button
                      onClick={() => setUserToDelete(u)}
                      disabled={isBusy}
                      title={`Supprimer ${u.name}`}
                      style={{
                        background: 'transparent',
                        border: '1px solid #7f1d1d',
                        color: '#f87171',
                        borderRadius: '6px',
                        minWidth: '44px',
                        minHeight: '44px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                    </button>
                  ) : (
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#14171f',
                      borderRadius: '5px',
                      border: '1px solid #1e2430'
                    }}>
                      <Lock style={{ width: '11px', height: '11px', color: '#64748b' }} />
                      <span>Protégé</span>
                    </span>
                  )}
                </div>

                {/* Meta details: Discord & Subsystem */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <span style={{ color: '#94a3b8' }}>
                    Sous-système : <strong style={{ color: '#cbd5e1' }}>{u.subsystem || 'Général'}</strong>
                  </span>
                  {u.discord_handle && (
                    <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: '#1e1b4b', color: '#818cf8', border: '1px solid #4338ca' }}>
                      @{u.discord_handle.replace(/^@/, '')}
                    </span>
                  )}
                  {canEditBudgets && (
                    <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: '#064e3b', color: '#a7f3d0', border: '1px solid #059669' }}>
                      💰 Budget Éditeur
                    </span>
                  )}
                </div>

                {/* Form controls: Department & Role (Stacked on mobile to prevent truncation) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: isMobile ? '0.65rem' : '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #1c202a'
                }}>
                  {/* Department Select */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem', fontWeight: '600' }}>
                      Pôle FSAE
                    </label>
                    <select
                      disabled={isBusy}
                      value={u.department || ''}
                      onChange={(e) => handleDepartmentChange(u, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.5rem',
                        backgroundColor: '#0f1115',
                        border: `1px solid ${u.department ? getDeptColor(u.department) + '55' : '#334155'}`,
                        borderRadius: '6px',
                        color: u.department ? getDeptColor(u.department) : '#94a3b8',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        minHeight: '44px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Non assigné</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role Select */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem', fontWeight: '600' }}>
                      Rôle & Accès
                    </label>
                    <select
                      disabled={isBusy || (isCurrent && u.role === 'Admin')}
                      value={u.role === 'Purchaser' ? 'Lead' : u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      title={isCurrent && u.role === 'Admin' ? 'Anti-verrouillage : vous ne pouvez pas vous rétrograder vous-même' : 'Modifier le rôle'}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.5rem',
                        borderRadius: '6px',
                        border:
                          u.role === 'Admin'
                            ? '1px solid #9333ea'
                            : (u.role === 'Lead' || u.role === 'Purchaser')
                              ? '1px solid #2563eb'
                              : '1px solid #475569',
                        backgroundColor:
                          u.role === 'Admin'
                            ? '#3b1d54'
                            : (u.role === 'Lead' || u.role === 'Purchaser')
                              ? '#17324d'
                              : '#1e293b',
                        color:
                          u.role === 'Admin'
                            ? '#c084fc'
                            : (u.role === 'Lead' || u.role === 'Purchaser')
                              ? '#60a5fa'
                              : '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        minHeight: '44px',
                        cursor: (isCurrent && u.role === 'Admin') ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <option value="Member">Membre</option>
                      <option value="Lead">Chef d'équipe</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Table */
        <div style={{
          backgroundColor: '#161920',
          border: '1px solid #232733',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #232733', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', color: '#f8fafc', fontSize: '0.92rem' }}>
              Membres de l'équipe ({filteredUsers.length} affiché{filteredUsers.length > 1 ? 's' : ''})
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#111317', borderBottom: '1px solid #232733', color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Utilisateur</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Pôle FSAE</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Spécialité / Sous-système</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Discord</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Rôle & Privilèges</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const isCurrent = currentUser?.id === u.id;
                  const isBusy = updatingId === u.id;

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1c202a', backgroundColor: isCurrent ? '#1e293b22' : 'transparent' }}>
                      {/* Name & Email */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            color: '#94a3b8',
                            fontSize: '0.85rem'
                          }}>
                            {u.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {u.name}
                              {isCurrent && (
                                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: '#064e3b', color: '#6ee7b7' }}>
                                  Vous
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department Selector */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <select
                          disabled={isBusy}
                          value={u.department || ''}
                          onChange={(e) => handleDepartmentChange(u, e.target.value)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            backgroundColor: '#0f1115',
                            border: `1px solid ${u.department ? getDeptColor(u.department) + '55' : '#334155'}`,
                            borderRadius: '6px',
                            color: u.department ? getDeptColor(u.department) : '#94a3b8',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">Non assigné</option>
                          {DEPARTMENTS.map(d => (
                            <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Subsystem / Speciality */}
                      <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1', fontSize: '0.8rem' }}>
                        {u.subsystem || <span style={{ color: '#475569', fontStyle: 'italic' }}>Général</span>}
                      </td>

                      {/* Discord */}
                      <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                        {u.discord_handle ? (
                          <span style={{ padding: '0.2rem 0.45rem', borderRadius: '4px', backgroundColor: '#1e1b4b', color: '#818cf8', border: '1px solid #4338ca' }}>
                            @{u.discord_handle.replace(/^@/, '')}
                          </span>
                        ) : (
                          <span style={{ color: '#475569' }}>—</span>
                        )}
                      </td>

                      {/* Role Selector */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select
                            disabled={isBusy || (isCurrent && u.role === 'Admin')}
                            value={u.role === 'Purchaser' ? 'Lead' : u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value)}
                            title={isCurrent && u.role === 'Admin' ? 'Anti-verrouillage : vous ne pouvez pas vous rétrograder vous-même' : 'Modifier le rôle'}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              border:
                                u.role === 'Admin'
                                   ? '1px solid #9333ea'
                                  : (u.role === 'Lead' || u.role === 'Purchaser')
                                    ? '1px solid #2563eb'
                                    : '1px solid #475569',
                              backgroundColor:
                                u.role === 'Admin'
                                  ? '#3b1d54'
                                  : (u.role === 'Lead' || u.role === 'Purchaser')
                                    ? '#17324d'
                                    : '#1e293b',
                              color:
                                u.role === 'Admin'
                                  ? '#c084fc'
                                  : (u.role === 'Lead' || u.role === 'Purchaser')
                                    ? '#60a5fa'
                                    : '#cbd5e1',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              cursor: (isCurrent && u.role === 'Admin') ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="Member">Membre</option>
                            <option value="Lead">Chef d'équipe</option>
                            <option value="Admin">Admin</option>
                          </select>

                          {/* Budget editing privilege indicator */}
                          {(u.role === 'Admin' || ((u.role === 'Lead' || u.role === 'Purchaser') && (u.department === 'ADM' || u.department === 'Team Administration'))) && (
                            <span
                              title="Accès autorisé à l'édition des budgets du Cost Report"
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#064e3b',
                                color: '#a7f3d0',
                                border: '1px solid #059669',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              💰 Budget Éditeur
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        {isCurrent ? (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>—</span>
                        ) : (
                          <button
                            onClick={() => setUserToDelete(u)}
                            disabled={isBusy}
                            title={`Supprimer ${u.name}`}
                            style={{
                              background: 'transparent',
                              border: '1px solid #334155',
                              color: '#94a3b8',
                              borderRadius: '6px',
                              padding: '0.35rem 0.5rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
                          >
                            <Trash2 style={{ width: '15px', height: '15px' }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: isMobile ? 0 : '1rem'
        }}>
          <div style={{
            backgroundColor: '#161920',
            border: '1px solid #dc2626',
            borderRadius: isMobile ? '16px 16px 0 0' : '12px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '440px',
            maxHeight: '90dvh',
            overflowY: 'auto',
            padding: isMobile ? '1.25rem 1.25rem calc(1.25rem + var(--safe-bottom, 0px))' : '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#451a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                <AlertTriangle style={{ width: '22px', height: '22px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#f8fafc', margin: 0 }}>
                  Confirmer la suppression
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Action irréversible
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 1.25rem' }}>
              Êtes-vous certain de vouloir supprimer le compte de <strong>{userToDelete.name}</strong> ({userToDelete.email}) ?
              Cette action supprimera son accès à la plateforme.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setUserToDelete(null)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: 'transparent',
                  color: '#cbd5e1',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteUser}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  minHeight: '44px'
                }}
              >
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
