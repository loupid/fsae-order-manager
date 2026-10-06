import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../utils/useMediaQuery';
import { apiClient } from '../api/client';
import { AlertTriangle, Plus, Pencil, X, Trash2, Edit2, Lock, RefreshCw } from 'lucide-react';

export default function CostReportView() {
  const { isAdmin, canEditBudget, canViewBudget } = useAuth();
  const isMobile = useIsMobile(768);
  const [subsystems, setSubsystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // New subsystem modal / form state
  const [showAddSubsystem, setShowAddSubsystem] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [creating, setCreating] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit subsystem modal / form state
  const [editingSubsystem, setEditingSubsystem] = useState(null);
  const [editBudget, setEditBudget] = useState('');
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSubsystem, setDeletingSubsystem] = useState(false);
  const [editError, setEditError] = useState('');

  const loadSubsystems = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const list = await apiClient.getSubsystems();
      setSubsystems(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load subsystems:', err);
      setLoadError(err.message || 'Impossible de charger les données financières');
      setSubsystems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubsystems();
  }, [loadSubsystems]);

  const handleAddSubsystem = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    const budgetVal = newBudget ? parseFloat(newBudget) : 0.0;
    if (isNaN(budgetVal) || budgetVal < 0) {
      setAddError('Le montant du budget alloué doit être un nombre positif ou nul.');
      return;
    }

    setCreating(true);
    setAddError('');
    try {
      await apiClient.createSubsystem({
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        budget_allocated: budgetVal
      });
      setNewName('');
      setNewCode('');
      setNewBudget('');
      setShowAddSubsystem(false);
      await loadSubsystems();
    } catch (err) {
      setAddError(err.message || 'Erreur lors de la création du sous-système');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (sub) => {
    setEditingSubsystem(sub);
    setEditBudget(String(sub.budget_allocated ?? 0));
    setEditName(sub.name || '');
    setEditCode(sub.code || '');
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingSubsystem) return;

    const parsed = parseFloat(editBudget);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setEditError('Le budget alloué doit être un nombre positif ou nul.');
      return;
    }

    if (!editCode.trim()) {
      setEditError('Le code du sous-système ne peut pas être vide.');
      return;
    }

    if (!editName.trim()) {
      setEditError('Le nom du sous-système ne peut pas être vide.');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      if (isAdmin) {
        await apiClient.updateSubsystem(editingSubsystem.id, {
          budget_allocated: parsed,
          name: editName.trim(),
          code: editCode.trim().toUpperCase()
        });
      } else {
        await apiClient.updateSubsystemBudget(editingSubsystem.id, parsed);
      }
      setEditingSubsystem(null);
      await loadSubsystems();
    } catch (err) {
      setEditError(err.message || 'Erreur lors de la mise à jour du sous-système');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSubsystem = async () => {
    if (!editingSubsystem) return;
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le sous-système [${editingSubsystem.code}] ${editingSubsystem.name} ?`)) {
      return;
    }

    setDeletingSubsystem(true);
    setEditError('');
    try {
      await apiClient.deleteSubsystem(editingSubsystem.id);
      setEditingSubsystem(null);
      await loadSubsystems();
    } catch (err) {
      setEditError(err.message || 'Erreur lors de la suppression du sous-système');
    } finally {
      setDeletingSubsystem(false);
    }
  };

  if (!canViewBudget) {
    return (
      <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
        <Lock style={{ width: '32px', height: '32px', margin: '0 auto 1rem', color: '#ef4444' }} />
        <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Accès Restreint</h3>
        <p>Vous n'avez pas l'autorisation d'accéder au rapport de coûts FSAE.</p>
      </div>
    );
  }

  // Aggregates
  const totalBudgetAllocated = subsystems.reduce((sum, s) => sum + (Number(s.budget_allocated) || 0), 0);
  const totalCommittedCost = subsystems.reduce((sum, s) => sum + (Number(s.committed_cost) || 0), 0);
  const totalActualCost = subsystems.reduce((sum, s) => sum + (Number(s.actual_cost) || 0), 0);
  const totalSpend = totalCommittedCost + totalActualCost;
  const overallRemaining = totalBudgetAllocated - totalSpend;
  const overallPctUsed = totalBudgetAllocated > 0 ? ((totalSpend / totalBudgetAllocated) * 100) : 0;
  const overBudgetSubsystems = subsystems.filter(s => (Number(s.remaining_budget) || 0) < 0 || (Number(s.pct_used) || 0) > 100);

  return (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.4rem', fontWeight: '800', color: '#f8fafc', margin: '0 0 0.25rem' }}>
            Formule SAE <span style={{ color: '#10b981' }}>UQTR</span> — Rapport de Coûts & Budgets
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
            Suivi financier en direct des dépenses engagées et réelles des {subsystems.length} Teams de la monoplace électrique.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!canEditBudget && canViewBudget && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155'
            }}>
              <Lock style={{ width: '13px', height: '13px' }} />
              Lecture seule (Édition : Team Admin & Admins)
            </span>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                setAddError('');
                setShowAddSubsystem(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1rem',
                backgroundColor: '#064e3b',
                color: '#6ee7b7',
                border: '1px solid #059669',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                minHeight: '38px'
              }}
            >
              <Plus style={{ width: '16px', height: '16px' }} />
              + Ajouter Département
            </button>
          )}
        </div>
      </div>

      {/* Network / Load Error Banner */}
      {loadError && (
        <div style={{
          backgroundColor: '#451a1a',
          border: '1px solid #dc2626',
          borderRadius: '10px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          color: '#f87171'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', flexShrink: 0, color: '#ef4444' }} />
            <span style={{ fontSize: '0.88rem' }}>{loadError}</span>
          </div>
          <button
            onClick={loadSubsystems}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px' }} />
            Réessayer
          </button>
        </div>
      )}

      {/* Over-Budget Alert Banner */}
      {overBudgetSubsystems.length > 0 && (
        <div style={{
          backgroundColor: '#381418',
          border: '1px solid #ef4444',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#f87171'
        }}>
          <AlertTriangle style={{ width: '24px', height: '24px', flexShrink: 0, color: '#ef4444' }} />
          <div>
            <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#fca5a5' }}>
              ⚠️ Alerte Dépassement Budgétaire ({overBudgetSubsystems.length} sous-système{overBudgetSubsystems.length > 1 ? 's' : ''})
            </div>
            <div style={{ fontSize: '0.82rem', color: '#fecaca', marginTop: '0.2rem' }}>
              {overBudgetSubsystems.map(s => `[${s.code}] ${s.name} : Dépassement de $${Math.abs(s.remaining_budget).toFixed(2)} CAD (${s.pct_used}% consommé)`).join(' • ')}
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards (Compact 2x2 grid on mobile) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: isMobile ? '0.75rem' : '1rem',
        marginBottom: '2rem'
      }}>
        {/* Card 1: Budget Total */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Budget Global
          </div>
          <div style={{ fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: '900', color: '#f8fafc' }}>
            ${totalBudgetAllocated.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
        </div>

        {/* Card 2: Engagé / Commandé */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Coûts Engagés
          </div>
          <div style={{ fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: '900', color: '#38bdf8' }}>
            ${totalCommittedCost.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
        </div>

        {/* Card 3: Réalisé / Reçu */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Dépenses Réalisées
          </div>
          <div style={{ fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: '900', color: '#a855f7' }}>
            ${totalActualCost.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
        </div>

        {/* Card 4: Budget Restant */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Budget Restant
          </div>
          <div style={{
            fontSize: isMobile ? '1.25rem' : '1.6rem',
            fontWeight: '900',
            color: overallRemaining >= 0 ? '#4ade80' : '#f87171'
          }}>
            ${overallRemaining.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
            {overallPctUsed.toFixed(1)}% consommé
          </div>
        </div>
      </div>

      {/* Subsystem Budget Breakdown: Mobile Cards or Desktop Table */}
      {isMobile ? (
        /* Mobile Subsystems Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '1rem', marginBottom: '0.25rem' }}>
            Ventilation par Sous-Système
          </div>
          {subsystems.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#161920', borderRadius: '10px' }}>
              {loadError ? 'Impossible d’afficher les sous-systèmes suite à une erreur.' : 'Aucun sous-système configuré pour le moment.'}
            </div>
          ) : (
            subsystems.map(s => {
              const budgetAllocated = Number(s.budget_allocated) || 0;
              const committedCost = Number(s.committed_cost) || 0;
              const actualCost = Number(s.actual_cost) || 0;
              const remainingBudget = Number(s.remaining_budget) || 0;
              const pctUsed = Number(s.pct_used) || 0;
              const isOverBudget = remainingBudget < 0;
              const barColor = isOverBudget ? '#ef4444' : pctUsed > 80 ? '#f59e0b' : '#10b981';

              return (
                <div key={s.id || s.code} style={{
                  backgroundColor: '#161920',
                  border: '1px solid #232733',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  {/* Card Header: Code, Name, Edit Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#1e293b', color: '#cbd5e1', fontWeight: '700', fontSize: '0.75rem' }}>
                        {s.code}
                      </span>
                      <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{s.name}</strong>
                    </div>

                    {canEditBudget && (
                      <button
                        onClick={() => handleOpenEdit(s)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.65rem',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#38bdf8',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          minHeight: '36px'
                        }}
                      >
                        <Pencil style={{ width: '13px', height: '13px' }} />
                        <span>Modifier</span>
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#94a3b8' }}>Consommation</span>
                      <span style={{ fontWeight: '700', color: barColor }}>{pctUsed ? `${pctUsed}%` : '0%'}</span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: '#0f1115',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                      border: '1px solid #262d3d'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(pctUsed, 100)}%`,
                        backgroundColor: barColor,
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* 2x2 Financial Metrics */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #1c202a',
                    fontSize: '0.78rem'
                  }}>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Alloué</span>
                      <strong style={{ color: '#f1f5f9' }}>${budgetAllocated.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Engagé</span>
                      <strong style={{ color: '#38bdf8' }}>${committedCost.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Réalisé</span>
                      <strong style={{ color: '#a855f7' }}>${actualCost.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Restant</span>
                      <strong style={{ color: isOverBudget ? '#f87171' : '#4ade80' }}>${remainingBudget.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Desktop Subsystems Table */
        <div style={{
          backgroundColor: '#161920',
          border: '1px solid #232733',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #232733', fontWeight: '700', color: '#f8fafc', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ventilation par Sous-Système</span>
            {canEditBudget && (
              <span style={{ fontSize: '0.75rem', color: '#a7f3d0', fontWeight: '600' }}>
                ✓ Droits d'édition budgétaire actifs
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Chargement des données financières...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#111317', borderBottom: '1px solid #232733', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Code</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Sous-système</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Budget Alloué</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Engagé</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Réalisé</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Restant</th>
                  <th style={{ padding: '0.85rem 1.25rem', minWidth: '180px' }}>Consommation</th>
                  {canEditBudget && <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', width: '100px' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {subsystems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canEditBudget ? 8 : 7}
                      style={{
                        padding: '2.5rem',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '0.9rem'
                      }}
                    >
                      {loadError ? 'Impossible d’afficher les sous-systèmes suite à une erreur.' : 'Aucun sous-système configuré pour le moment.'}
                    </td>
                  </tr>
                ) : (
                  subsystems.map(s => {
                    const budgetAllocated = Number(s.budget_allocated) || 0;
                    const committedCost = Number(s.committed_cost) || 0;
                    const actualCost = Number(s.actual_cost) || 0;
                    const remainingBudget = Number(s.remaining_budget) || 0;
                    const pctUsed = Number(s.pct_used) || 0;
                    const isOverBudget = remainingBudget < 0;
                    const barColor = isOverBudget ? '#ef4444' : pctUsed > 80 ? '#f59e0b' : '#10b981';

                    return (
                      <tr key={s.id || s.code} style={{ borderBottom: '1px solid #1c202a' }}>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#1e293b', color: '#cbd5e1', fontWeight: '700', fontSize: '0.75rem' }}>
                            {s.code}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: '700', color: '#f8fafc' }}>
                          {s.name}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#f1f5f9', fontWeight: '600' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <span>${budgetAllocated.toFixed(2)}</span>
                            {canEditBudget && (
                              <button
                                onClick={() => handleOpenEdit(s)}
                                title="Modifier le budget alloué"
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #334155',
                                  color: '#94a3b8',
                                  borderRadius: '4px',
                                  padding: '0.2rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.borderColor = '#38bdf8'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
                              >
                                <Edit2 style={{ width: '13px', height: '13px' }} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#38bdf8' }}>
                          ${committedCost.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#a855f7' }}>
                          ${actualCost.toFixed(2)}
                        </td>
                        <td style={{
                          padding: '0.85rem 1.25rem',
                          textAlign: 'right',
                          fontWeight: '800',
                          color: isOverBudget ? '#f87171' : '#4ade80'
                        }}>
                          ${remainingBudget.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              flex: 1,
                              height: '8px',
                              backgroundColor: '#0f1115',
                              borderRadius: '9999px',
                              overflow: 'hidden',
                              border: '1px solid #262d3d'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(pctUsed, 100)}%`,
                                backgroundColor: barColor,
                                borderRadius: '9999px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: barColor, minWidth: '40px', textAlign: 'right' }}>
                              {pctUsed ? `${pctUsed}%` : '0%'}
                            </span>
                          </div>
                        </td>
                        {canEditBudget && (
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleOpenEdit(s)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.65rem',
                                backgroundColor: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                color: '#38bdf8',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                              title={isAdmin ? `Modifier [${s.code}] ${s.name}` : `Modifier le budget de [${s.code}]`}
                            >
                              <Pencil style={{ width: '13px', height: '13px' }} />
                              <span>Modifier</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Subsystem Modal */}
      {showAddSubsystem && (
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
            border: '1px solid #2d3342',
            borderRadius: isMobile ? '16px 16px 0 0' : '12px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '450px',
            maxHeight: '90dvh',
            overflowY: 'auto',
            padding: isMobile ? '1.25rem 1.25rem calc(1.25rem + var(--safe-bottom, 0px))' : '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                Ajouter un Sous-Système FSAE
              </h3>
              <button
                onClick={() => setShowAddSubsystem(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {addError && (
              <div style={{
                backgroundColor: '#451a1a',
                border: '1px solid #dc2626',
                color: '#f87171',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                marginBottom: '1rem'
              }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubsystem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Nom du Sous-système *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ex: Aérodynamique & DRS"
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0f1115', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Code (Trigramme) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="ex: AER"
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0f1115', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', fontWeight: '700', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Budget Alloué ($ CAD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="2500.00"
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0f1115', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSubsystem(false)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: 'transparent', color: '#cbd5e1', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', border: 'none', backgroundColor: '#9333ea', color: '#fff', fontWeight: '700', fontSize: '0.85rem', cursor: creating ? 'not-allowed' : 'pointer' }}
                >
                  {creating ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subsystem Modal */}
      {editingSubsystem && (
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
            border: '1px solid #2d3342',
            borderRadius: isMobile ? '16px 16px 0 0' : '12px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '450px',
            maxHeight: '90dvh',
            overflowY: 'auto',
            padding: isMobile ? '1.25rem 1.25rem calc(1.25rem + var(--safe-bottom, 0px))' : '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                {isAdmin ? `Modifier Sous-Système : [${editingSubsystem.code}]` : `Modifier Budget : [${editingSubsystem.code}]`}
              </h3>
              <button
                onClick={() => setEditingSubsystem(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {editError && (
              <div style={{
                backgroundColor: '#451a1a',
                border: '1px solid #dc2626',
                color: '#f87171',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                marginBottom: '1rem'
              }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Code (Trigramme) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    disabled={!isAdmin}
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0f1115', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', fontWeight: '700', boxSizing: 'border-box', opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Nom du Sous-système *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0f1115', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box', opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Budget Alloué ($ CAD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  required
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0f1115', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={handleDeleteSubsystem}
                    disabled={deletingSubsystem || savingEdit}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #7f1d1d',
                      backgroundColor: '#451a1a',
                      color: '#f87171',
                      fontWeight: '600',
                      fontSize: '0.82rem',
                      cursor: (deletingSubsystem || savingEdit) ? 'not-allowed' : 'pointer'
                    }}
                    title="Supprimer ce sous-système (si aucune pièce n'est associée)"
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                    <span>{deletingSubsystem ? 'Suppression...' : 'Supprimer'}</span>
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setEditingSubsystem(null)}
                    style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: 'transparent', color: '#cbd5e1', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || deletingSubsystem}
                    style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: '700', fontSize: '0.85rem', cursor: (savingEdit || deletingSubsystem) ? 'not-allowed' : 'pointer' }}
                  >
                    {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
