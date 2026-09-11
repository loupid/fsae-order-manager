import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BarChart3, DollarSign, PieChart, ShieldCheck, AlertTriangle, Plus, Check } from 'lucide-react';

export default function CostReportView() {
  const { isAdmin } = useAuth();
  const [subsystems, setSubsystems] = useState([]);
  const [loading, setLoading] = useState(true);

  // New subsystem modal / form state
  const [showAddSubsystem, setShowAddSubsystem] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [creating, setCreating] = useState(false);

  const loadSubsystems = async () => {
    setLoading(true);
    try {
      const list = await apiClient.getSubsystems();
      setSubsystems(list);
    } catch (err) {
      console.error('Failed to load subsystems:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubsystems();
  }, []);

  const handleAddSubsystem = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    setCreating(true);
    try {
      await apiClient.createSubsystem({
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        budget_allocated: parseFloat(newBudget) || 0.0
      });
      setNewName('');
      setNewCode('');
      setNewBudget('');
      setShowAddSubsystem(false);
      await loadSubsystems();
    } catch (err) {
      alert(err.message || 'Erreur lors de la création du sous-système');
    } finally {
      setCreating(false);
    }
  };

  // Aggregates
  const totalBudgetAllocated = subsystems.reduce((sum, s) => sum + (s.budget_allocated || 0), 0);
  const totalCommittedCost = subsystems.reduce((sum, s) => sum + (s.committed_cost || 0), 0);
  const totalActualCost = subsystems.reduce((sum, s) => sum + (s.actual_cost || 0), 0);
  const totalSpend = totalCommittedCost + totalActualCost;
  const overallRemaining = totalBudgetAllocated - totalSpend;
  const overallPctUsed = totalBudgetAllocated > 0 ? ((totalSpend / totalBudgetAllocated) * 100) : 0;
  const overBudgetSubsystems = subsystems.filter(s => s.remaining_budget < 0 || s.pct_used > 100);

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f8fafc', margin: '0 0 0.25rem' }}>
            Formule SAE <span style={{ color: '#10b981' }}>UQTR</span> — Rapport de Coûts & Budgets
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
            Suivi financier en direct des dépenses engagées et réelles des 5 Teams de la monoplace électrique.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddSubsystem(true)}
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
              cursor: 'pointer'
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            + Ajouter Département
          </button>
        )}
      </div>

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

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {/* Card 1: Budget Total */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Budget Global Alloué
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#f8fafc' }}>
            ${totalBudgetAllocated.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
        </div>

        {/* Card 2: Engagé / Commandé */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Coûts Engagés (En attente/Transit)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#38bdf8' }}>
            ${totalCommittedCost.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
        </div>

        {/* Card 3: Réalisé / Reçu */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Dépenses Réalisées (Reçu)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#a855f7' }}>
            ${totalActualCost.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
        </div>

        {/* Card 4: Budget Restant */}
        <div style={{ backgroundColor: '#161920', border: '1px solid #232733', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Budget Restant Disponible
          </div>
          <div style={{
            fontSize: '1.6rem',
            fontWeight: '900',
            color: overallRemaining >= 0 ? '#4ade80' : '#f87171'
          }}>
            ${overallRemaining.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>CAD</span>
          </div>
        </div>
      </div>

      {/* Subsystem Budget Breakdown Table */}
      <div style={{
        backgroundColor: '#161920',
        border: '1px solid #232733',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #232733', fontWeight: '700', color: '#f8fafc', fontSize: '0.95rem' }}>
          Ventilation par Sous-Système
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
              </tr>
            </thead>
            <tbody>
              {subsystems.map(s => {
                const isOverBudget = s.remaining_budget < 0;
                const barColor = isOverBudget ? '#ef4444' : s.pct_used > 80 ? '#f59e0b' : '#10b981';

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #1c202a' }}>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#1e293b', color: '#cbd5e1', fontWeight: '700', fontSize: '0.75rem' }}>
                        {s.code}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: '700', color: '#f8fafc' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#f1f5f9', fontWeight: '600' }}>
                      ${Number(s.budget_allocated).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#38bdf8' }}>
                      ${Number(s.committed_cost).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#a855f7' }}>
                      ${Number(s.actual_cost).toFixed(2)}
                    </td>
                    <td style={{
                      padding: '0.85rem 1.25rem',
                      textAlign: 'right',
                      fontWeight: '800',
                      color: isOverBudget ? '#f87171' : '#4ade80'
                    }}>
                      ${Number(s.remaining_budget).toFixed(2)}
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
                            width: `${Math.min(s.pct_used || 0, 100)}%`,
                            backgroundColor: barColor,
                            borderRadius: '9999px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: barColor, minWidth: '40px', textAlign: 'right' }}>
                          {s.pct_used ? `${s.pct_used}%` : '0%'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Subsystem Modal */}
      {showAddSubsystem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#161920',
            border: '1px solid #2d3342',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '450px',
            padding: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 1rem' }}>
              Ajouter un Sous-Système FSAE
            </h3>

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
                  Code Tri-lettres *
                </label>
                <input
                  type="text"
                  required
                  maxLength="5"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="ex: AER"
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0f1115', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
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
    </div>
  );
}
