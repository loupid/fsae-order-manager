import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../utils/useMediaQuery';
import UrgencyBadge from '../components/UrgencyBadge';
import PartRequestModal from '../components/PartRequestModal';
import { Plus, Search, Filter, ExternalLink, Trash2, Clock, CheckCircle2, PackageCheck, XCircle, X } from 'lucide-react';

export default function MemberFunnelView() {
  const { user, isAdmin } = useAuth();
  const isMobile = useIsMobile(768);
  const [requests, setRequests] = useState([]);
  const [subsystems, setSubsystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSubsystem, setSelectedSubsystem] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqList, subList] = await Promise.all([
        apiClient.getPartRequests(),
        apiClient.getSubsystems()
      ]);
      setRequests(reqList);
      setSubsystems(subList);
    } catch (err) {
      console.error('Failed to load part requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreated = (newReq) => {
    setRequests(prev => [newReq, ...prev]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette demande ?')) return;
    try {
      await apiClient.deletePartRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchSearch = !search || 
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.sku?.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier?.toLowerCase().includes(search.toLowerCase()) ||
      r.requester_name?.toLowerCase().includes(search.toLowerCase());

    const matchSubsystem = !selectedSubsystem || String(r.subsystem_id) === String(selectedSubsystem);
    const matchUrgency = !selectedUrgency || r.urgency_level === selectedUrgency;
    const matchStatus = !selectedStatus || r.status === selectedStatus;

    return matchSearch && matchSubsystem && matchUrgency && matchStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RECEIVED':
        return { label: 'Reçue à l\'Atelier', color: '#a855f7', bg: '#3b1d54', icon: PackageCheck };
      case 'ORDERED':
        return { label: 'Commandée', color: '#38bdf8', bg: '#0c4a6e', icon: Clock };
      case 'APPROVED':
        return { label: 'Approuvée (En attente PO)', color: '#34d399', bg: '#064e3b', icon: CheckCircle2 };
      case 'REJECTED':
        return { label: 'Refusée', color: '#f87171', bg: '#451a1a', icon: XCircle };
      default:
        return { label: 'Soumise', color: '#fbbf24', bg: '#451a03', icon: Clock };
    }
  };

  return (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.4rem', fontWeight: '800', color: '#f8fafc', margin: '0 0 0.25rem' }}>
            File des Demandes de Pièces (Funnel)
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
            Soumettez vos besoins de pièces pour votre sous-système et suivez l'état en direct.
          </p>
        </div>

        {/* Desktop Header Action Button */}
        {!isMobile && (
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            <span>Nouvelle Demande</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div style={{
        backgroundColor: '#161920',
        border: '1px solid #232733',
        borderRadius: '10px',
        padding: '0.85rem',
        marginBottom: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Rechercher description, SKU, membre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: search ? '0.55rem 2.2rem 0.55rem 2.2rem' : '0.55rem 0.75rem 0.55rem 2.2rem',
              backgroundColor: '#0f1115',
              border: '1px solid #2d3342',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              boxSizing: 'border-box'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '28px',
                minHeight: '28px'
              }}
              title="Effacer la recherche"
            >
              <X style={{ width: '14px', height: '14px' }} />
            </button>
          )}
        </div>

        {/* Filters: Mobile Horizontal Scroll-Snap Chips vs Desktop Grid */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Subsystem Dropdown */}
            <select
              value={selectedSubsystem}
              onChange={(e) => setSelectedSubsystem(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                backgroundColor: '#0f1115',
                border: '1px solid #2d3342',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                minHeight: '44px'
              }}
            >
              <option value="">Tous les sous-systèmes ({subsystems.length})</option>
              {subsystems.map(s => (
                <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
              ))}
            </select>

            {/* Status Filter Chips (Horizontal scroll-snap) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              padding: '0.15rem 0'
            }}>
              {[
                { val: '', label: 'Tous statuts' },
                { val: 'SUBMITTED', label: '🕒 Soumise' },
                { val: 'APPROVED', label: '✅ Approuvée' },
                { val: 'ORDERED', label: '🚚 Commandée' },
                { val: 'RECEIVED', label: '🏁 Reçue' },
                { val: 'REJECTED', label: '🚫 Refusée' }
              ].map(chip => {
                const active = selectedStatus === chip.val;
                return (
                  <button
                    key={chip.val}
                    type="button"
                    onClick={() => setSelectedStatus(chip.val)}
                    style={{
                      scrollSnapAlign: 'start',
                      whiteSpace: 'nowrap',
                      padding: '0.45rem 0.85rem',
                      minHeight: '40px',
                      borderRadius: '9999px',
                      border: active ? '1px solid #3b82f6' : '1px solid #2d3342',
                      backgroundColor: active ? '#1e3a8a55' : '#0f1115',
                      color: active ? '#60a5fa' : '#94a3b8',
                      fontSize: '0.78rem',
                      fontWeight: active ? '700' : '500',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Urgency Filter Chips (Horizontal scroll-snap) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              padding: '0.15rem 0'
            }}>
              {[
                { val: '', label: 'Toutes urgences' },
                { val: 'CRITICAL', label: '🚨 Critique', color: '#f87171', border: '#dc2626', bg: '#451a1a' },
                { val: 'URGENT', label: '⚡ Urgent', color: '#fb923c', border: '#ea580c', bg: '#431407' },
                { val: 'NORMAL', label: '🟢 Normal', color: '#4ade80', border: '#16a34a', bg: '#052e16' }
              ].map(chip => {
                const active = selectedUrgency === chip.val;
                return (
                  <button
                    key={chip.val}
                    type="button"
                    onClick={() => setSelectedUrgency(chip.val)}
                    style={{
                      scrollSnapAlign: 'start',
                      whiteSpace: 'nowrap',
                      padding: '0.45rem 0.85rem',
                      minHeight: '40px',
                      borderRadius: '9999px',
                      border: active ? (chip.border ? `1px solid ${chip.border}` : '1px solid #3b82f6') : '1px solid #2d3342',
                      backgroundColor: active ? (chip.bg || '#1e3a8a55') : '#0f1115',
                      color: active ? (chip.color || '#60a5fa') : '#94a3b8',
                      fontSize: '0.78rem',
                      fontWeight: active ? '700' : '500',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.5rem'
          }}>
            {/* Subsystem Filter */}
            <select
              value={selectedSubsystem}
              onChange={(e) => setSelectedSubsystem(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                backgroundColor: '#0f1115',
                border: '1px solid #2d3342',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem'
              }}
            >
              <option value="">Tous les sous-systèmes</option>
              {subsystems.map(s => (
                <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
              ))}
            </select>

            {/* Urgency Filter */}
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                backgroundColor: '#0f1115',
                border: '1px solid #2d3342',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem'
              }}
            >
              <option value="">Toutes les urgences</option>
              <option value="CRITICAL">🚨 Critique</option>
              <option value="URGENT">⚡ Urgent</option>
              <option value="NORMAL">🟢 Normal</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                backgroundColor: '#0f1115',
                border: '1px solid #2d3342',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem'
              }}
            >
              <option value="">Tous les statuts</option>
              <option value="SUBMITTED">Soumise</option>
              <option value="APPROVED">Approuvée</option>
              <option value="ORDERED">Commandée</option>
              <option value="RECEIVED">Reçue à l'atelier</option>
              <option value="REJECTED">Refusée</option>
            </select>
          </div>
        )}

        {/* Results counter & quick reset */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: '#64748b',
          padding: '0.2rem 0.25rem 0',
          borderTop: '1px solid #1f242e'
        }}>
          <span>
            {filteredRequests.length} demande{filteredRequests.length > 1 ? 's' : ''} {requests.length > 0 && requests.length !== filteredRequests.length ? `sur ${requests.length}` : ''}
          </span>
          {(search || selectedSubsystem || selectedUrgency || selectedStatus) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedSubsystem('');
                setSelectedUrgency('');
                setSelectedStatus('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                textDecoration: 'underline'
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Requests Content: Loading / Empty / Data */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Chargement des demandes...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div style={{
          backgroundColor: '#161920',
          border: '1px dashed #334155',
          borderRadius: '12px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '1rem', marginBottom: '0.25rem' }}>
            Aucune demande trouvée
          </div>
          <div style={{ fontSize: '0.82rem' }}>
            Cliquez sur "Nouvelle Demande" pour soumettre un composant DigiKey, Mouser, McMaster ou LCSC.
          </div>
        </div>
      ) : isMobile ? (
        /* ================= MOBILE CARDS VIEW ================= */
        <div className="mobile-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredRequests.map(r => {
            const badge = getStatusBadge(r.status);
            const StatusIcon = badge.icon;
            const canDelete = r.requester_id === user?.id || isAdmin;

            return (
              <div
                key={r.id}
                className="part-request-card"
                style={{
                  backgroundColor: '#161920',
                  border: r.urgency_level === 'CRITICAL' ? '1px solid #dc2626' : '1px solid #232733',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                {/* Card Top: Badges & Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <UrgencyBadge level={r.urgency_level} />
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: '#1e293b',
                      color: '#94a3b8',
                      fontSize: '0.72rem',
                      fontWeight: '700'
                    }}>
                      {r.subsystem_code || 'GEN'}
                    </span>
                  </div>

                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    backgroundColor: badge.bg,
                    color: badge.color,
                    fontSize: '0.72rem',
                    fontWeight: '600'
                  }}>
                    <StatusIcon style={{ width: '12px', height: '12px' }} />
                    {badge.label}
                  </span>
                </div>

                {/* Card Title & Description */}
                <div>
                  <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                    {r.description}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>Fournisseur: <strong style={{ color: '#cbd5e1' }}>{r.supplier}</strong></span>
                    {r.sku && <span>SKU: <code style={{ color: '#94a3b8' }}>{r.sku}</code></span>}
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.2rem', textDecoration: 'none' }}
                      >
                        <ExternalLink style={{ width: '11px', height: '11px' }} /> Fiche
                      </a>
                    )}
                  </div>
                </div>

                {/* Card Footer: Financials, Requester, Delete */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #1c202a',
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <span style={{ color: '#cbd5e1', fontWeight: '700' }}>x{r.quantity}</span>
                    <span style={{ margin: '0 0.4rem', color: '#475569' }}>•</span>
                    <span style={{ fontWeight: '800', color: '#4ade80' }}>
                      ${(Number(r.unit_price_est || 0) * r.quantity).toFixed(2)} CAD
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{r.requester_name}</span>
                    {canDelete && ['SUBMITTED', 'DRAFT', 'REJECTED'].includes(r.status) && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        title="Supprimer la demande"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          minWidth: '44px',
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px'
                        }}
                      >
                        <Trash2 style={{ width: '18px', height: '18px' }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= DESKTOP TABLE VIEW ================= */
        <div style={{
          backgroundColor: '#161920',
          border: '1px solid #232733',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#111317', borderBottom: '1px solid #232733', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Urgence</th>
                <th style={{ padding: '0.85rem 1rem' }}>Description & SKU</th>
                <th style={{ padding: '0.85rem 1rem' }}>Sous-système</th>
                <th style={{ padding: '0.85rem 1rem' }}>Fournisseur</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Qté</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Prix Est.</th>
                <th style={{ padding: '0.85rem 1rem' }}>Demandeur</th>
                <th style={{ padding: '0.85rem 1rem' }}>Statut</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(r => {
                const badge = getStatusBadge(r.status);
                const StatusIcon = badge.icon;
                const canDelete = r.requester_id === user?.id || isAdmin;

                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #1c202a',
                      backgroundColor: r.urgency_level === 'CRITICAL' ? '#2a121522' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <UrgencyBadge level={r.urgency_level} />
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: '700', color: '#f8fafc', marginBottom: '0.15rem' }}>
                        {r.description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {r.sku && <span>SKU: <code style={{ color: '#94a3b8' }}>{r.sku}</code></span>}
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.2rem', textDecoration: 'none' }}
                          >
                            <ExternalLink style={{ width: '11px', height: '11px' }} /> Voir fiche
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: '#1e293b',
                        color: '#94a3b8',
                        fontSize: '0.72rem',
                        fontWeight: '700'
                      }}>
                        {r.subsystem_code || 'GEN'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1', fontWeight: '600' }}>
                      {r.supplier}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '700', color: '#f8fafc' }}>
                      x{r.quantity}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700', color: '#4ade80' }}>
                      ${(Number(r.unit_price_est || 0) * r.quantity).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#f1f5f9' }}>{r.requester_name}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        fontSize: '0.72rem',
                        fontWeight: '600'
                      }}>
                        <StatusIcon style={{ width: '12px', height: '12px' }} />
                        {badge.label}
                      </span>
                      {r.po_number && (
                        <div style={{ fontSize: '0.7rem', color: '#60a5fa', marginTop: '0.2rem', fontWeight: '600' }}>
                          {r.po_number}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {canDelete && ['SUBMITTED', 'DRAFT', 'REJECTED'].includes(r.status) && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          title="Supprimer la demande"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '0.3rem',
                            borderRadius: '4px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
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
      )}

      {/* Mobile Floating Action Button (FAB) */}
      {isMobile && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="mobile-fab"
          style={{
            position: 'fixed',
            bottom: 'calc(4.75rem + var(--safe-bottom, 0px))',
            right: '1.25rem',
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.75rem 1.25rem',
            backgroundColor: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: '9999px',
            fontWeight: '800',
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(239, 68, 68, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4)'
          }}
        >
          <Plus style={{ width: '20px', height: '20px' }} />
          <span>Demande</span>
        </button>
      )}

      {/* New Part Request Modal */}
      <PartRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
        subsystems={subsystems}
        currentUser={user}
      />
    </div>
  );
}
