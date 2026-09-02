import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import UrgencyBadge from '../components/UrgencyBadge';
import InvoiceUploadModal from '../components/InvoiceUploadModal';
import CsvExportModal from '../components/CsvExportModal';
import { ShoppingCart, PackagePlus, FileText, CheckCircle2, Clock, CheckCheck, Download, AlertTriangle, ExternalLink, FileSpreadsheet, Ban } from 'lucide-react';

export default function PurchaserDashboard() {
  const { user } = useAuth();
  const [unassignedRequests, setUnassignedRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedRequestIds, setSelectedRequestIds] = useState(new Set());
  const [creatingPo, setCreatingPo] = useState(false);
  const [activePoForInvoice, setActivePoForInvoice] = useState(null);
  const [activePoForCsv, setActivePoForCsv] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allReqs, allPos] = await Promise.all([
        apiClient.getPartRequests({ status: 'SUBMITTED' }),
        apiClient.getPurchaseOrders()
      ]);
      setUnassignedRequests(allReqs.filter(r => !r.po_id));
      setPurchaseOrders(allPos);
    } catch (err) {
      console.error('Failed to load purchaser data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group unassigned requests by supplier
  const supplierGroups = unassignedRequests.reduce((acc, req) => {
    const s = req.supplier || 'Autre';
    if (!acc[s]) acc[s] = [];
    acc[s].push(req);
    return acc;
  }, {});

  const suppliersList = Object.keys(supplierGroups);

  const handleSelectAllForSupplier = (supplier) => {
    const ids = supplierGroups[supplier]?.map(r => r.id) || [];
    setSelectedSupplier(supplier);
    setSelectedRequestIds(new Set(ids));
  };

  const handleToggleRequest = (id, reqSupplier) => {
    if (selectedSupplier && selectedSupplier !== reqSupplier) {
      if (!window.confirm(`Vous aviez sélectionné ${selectedSupplier}. Réinitialiser pour ${reqSupplier} ?`)) {
        return;
      }
      setSelectedSupplier(reqSupplier);
      setSelectedRequestIds(new Set([id]));
      return;
    }

    setSelectedSupplier(reqSupplier);
    setSelectedRequestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setSelectedSupplier('');
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreatePo = async () => {
    if (selectedRequestIds.size === 0 || !selectedSupplier) {
      alert('Veuillez sélectionner au moins une pièce à regrouper.');
      return;
    }

    setCreatingPo(true);
    try {
      const created = await apiClient.createPurchaseOrder({
        supplier: selectedSupplier,
        request_ids: Array.from(selectedRequestIds)
      });
      alert(`Commande globale créée avec succès : ${created.po_number} (Total: $${Number(created.total_cost).toFixed(2)}) ! Notification Discord envoyée.`);
      setSelectedRequestIds(new Set());
      setSelectedSupplier('');
      await loadData();
    } catch (err) {
      alert(err.message || 'Erreur lors de la création du PO');
    } finally {
      setCreatingPo(false);
    }
  };

  const handleStatusTransition = async (poId, newStatus) => {
    try {
      await apiClient.updatePurchaseOrderStatus(poId, newStatus);
      await loadData();
    } catch (err) {
      alert(err.message || 'Erreur lors du changement de statut');
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    try {
      const blob = await apiClient.downloadInvoiceBlob(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoice.file_name || `Invoice_${invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Erreur lors du téléchargement de la facture');
    }
  };

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f8fafc', margin: '0 0 0.25rem' }}>
          Tableau de Bord Acheteur (Purchaser Hub)
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
          Regroupez en 1 clic les demandes individuelles par fournisseur, générez les Purchase Orders (PO) et attachez les factures PDF.
        </p>
      </div>

      {/* 1-Click PO Aggregation Area */}
      <div style={{
        backgroundColor: '#161920',
        border: '1px solid #232733',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShoppingCart style={{ width: '22px', height: '22px', color: '#10b981' }} />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                Entonnoir d'Achat : Demandes en Attente de Commande ({unassignedRequests.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Sélectionnez les pièces d'un même fournisseur pour générer le bon de commande.
              </span>
            </div>
          </div>

          {selectedRequestIds.size > 0 && (
            <button
              onClick={handleCreatePo}
              disabled={creatingPo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.35rem',
                backgroundColor: '#10b981',
                color: '#064e3b',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '0.88rem',
                cursor: creatingPo ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <PackagePlus style={{ width: '18px', height: '18px' }} />
              <span>
                {creatingPo ? 'Création PO...' : `Générer Bon de Commande ${selectedSupplier} (${selectedRequestIds.size} pièces)`}
              </span>
            </button>
          )}
        </div>

        {suppliersList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>
            🎉 Aucune pièce en attente ! Toutes les demandes ont été groupées en bon de commande.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {suppliersList.map(supp => {
              const items = supplierGroups[supp];
              const totalEst = items.reduce((sum, i) => sum + (Number(i.unit_price_est || 0) * i.quantity), 0);
              const isCurrentSupplier = selectedSupplier === supp;

              return (
                <div key={supp} style={{
                  backgroundColor: '#0f1115',
                  border: isCurrentSupplier ? '1px solid #10b981' : '1px solid #232733',
                  borderRadius: '10px',
                  padding: '1rem',
                  overflow: 'hidden'
                }}>
                  {/* Supplier Group Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #1e2430'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{supp}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({items.length} articles)</span>
                      <span style={{ fontSize: '0.82rem', color: '#4ade80', fontWeight: '700' }}>
                        Total Est : ${totalEst.toFixed(2)} CAD
                      </span>
                    </div>

                    <button
                      onClick={() => handleSelectAllForSupplier(supp)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#cbd5e1',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Tout sélectionner chez {supp}
                    </button>
                  </div>

                  {/* Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {items.map(item => {
                      const isSelected = selectedRequestIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleRequest(item.id, supp)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.85rem',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#064e3b33' : '#14171e',
                            border: isSelected ? '1px solid #10b981' : '1px solid #1f242e',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: 'pointer' }}
                            />
                            <UrgencyBadge level={item.urgency_level} />
                            <div>
                              <span style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '0.85rem' }}>
                                {item.description}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                [{item.subsystem_code || 'GEN'}] SKU: {item.sku || 'N/A'} • Par {item.requester_name}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem' }}>
                            <span style={{ color: '#94a3b8' }}>x{item.quantity}</span>
                            <span style={{ fontWeight: '700', color: '#4ade80' }}>
                              ${(Number(item.unit_price_est || 0) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generated Purchase Orders Management */}
      <div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc', marginBottom: '1rem' }}>
          📦 Bons de Commande Générés (Purchase Orders)
        </h3>

        {purchaseOrders.length === 0 ? (
          <div style={{
            backgroundColor: '#161920',
            border: '1px dashed #334155',
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            color: '#94a3b8'
          }}>
            Aucun bon de commande créé pour le moment.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
            {purchaseOrders.map(po => {
              return (
                <div key={po.id} style={{
                  backgroundColor: '#161920',
                  border: '1px solid #232733',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* PO Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#60a5fa' }}>
                        {po.po_number}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        Fournisseur : <strong style={{ color: '#f8fafc' }}>{po.supplier}</strong> • Par {po.purchaser_name}
                      </div>
                    </div>

                    <span style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      backgroundColor: po.status === 'COMPLETED' ? '#064e3b' : po.status === 'ORDERED' ? '#0c4a6e' : '#451a03',
                      color: po.status === 'COMPLETED' ? '#34d399' : po.status === 'ORDERED' ? '#38bdf8' : '#fbbf24',
                      border: `1px solid ${po.status === 'COMPLETED' ? '#059669' : po.status === 'ORDERED' ? '#0284c7' : '#d97706'}`
                    }}>
                      {po.status === 'COMPLETED' ? '✅ Reçu Complet' : po.status === 'ORDERED' ? '🚚 Commandé' : '🕒 En Attente'}
                    </span>
                  </div>

                  {/* Items preview */}
                  <div style={{
                    backgroundColor: '#0f1115',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    border: '1px solid #1f242e',
                    maxHeight: '140px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Articles ({po.items?.length || 0}) — Total: ${Number(po.total_cost || 0).toFixed(2)} CAD
                    </div>
                    {po.items?.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.2rem 0', color: '#cbd5e1' }}>
                        <span>• [{item.subsystem_code || 'GEN'}] {item.description} (x{item.quantity})</span>
                        <span style={{ color: '#4ade80' }}>${(Number(item.unit_price_est || 0) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Invoices List */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8' }}>
                        Factures Attachées ({po.invoices?.length || 0})
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => setActivePoForCsv(po)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#064e3b',
                            border: '1px solid #059669',
                            borderRadius: '4px',
                            color: '#6ee7b7',
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          <FileSpreadsheet style={{ width: '12px', height: '12px' }} />
                          Exporter CSV
                        </button>
                        <button
                          onClick={() => setActivePoForInvoice(po)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#1e3a8a',
                            border: '1px solid #2563eb',
                            borderRadius: '4px',
                            color: '#93c5fd',
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          <FileText style={{ width: '12px', height: '12px' }} />
                          + Attacher PDF
                        </button>
                      </div>
                    </div>

                    {po.invoices?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {po.invoices.map(inv => (
                          <div key={inv.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#0f1115',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '5px',
                            border: '1px solid #1e2430',
                            fontSize: '0.75rem'
                          }}>
                            <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                              📄 {inv.file_name} (${Number(inv.amount).toFixed(2)})
                            </span>
                            <button
                              onClick={() => handleDownloadInvoice(inv)}
                              title="Télécharger la facture PDF"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <Download style={{ width: '13px', height: '13px' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                        Aucune facture PDF attachée pour le Cost Report.
                      </div>
                    )}
                  </div>

                  {/* Status Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #1f242e' }}>
                    {po.status === 'PENDING' && (
                      <button
                        onClick={() => handleStatusTransition(po.id, 'ORDERED')}
                        style={{
                          flex: 1,
                          padding: '0.45rem',
                          backgroundColor: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        🚚 Marquer Commande Passée
                      </button>
                    )}

                    {po.status === 'ORDERED' && (
                      <button
                        onClick={() => handleStatusTransition(po.id, 'COMPLETED')}
                        style={{
                          flex: 1,
                          padding: '0.45rem',
                          backgroundColor: '#059669',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        🏁 Marquer Pièces Reçues à l'Atelier
                      </button>
                    )}

                    {['PENDING', 'ORDERED'].includes(po.status) && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Voulez-vous vraiment annuler le bon de commande ${po.po_number} ?`)) {
                            handleStatusTransition(po.id, 'CANCELLED');
                          }
                        }}
                        title="Annuler le PO"
                        style={{
                          padding: '0.45rem 0.6rem',
                          backgroundColor: '#27171a',
                          color: '#f87171',
                          border: '1px solid #7f1d1d',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <Ban style={{ width: '13px', height: '13px' }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice Upload Modal */}
      {activePoForInvoice && (
        <InvoiceUploadModal
          isOpen={!!activePoForInvoice}
          onClose={() => setActivePoForInvoice(null)}
          purchaseOrder={activePoForInvoice}
          onUploaded={() => {
            loadData();
            setActivePoForInvoice(null);
          }}
        />
      )}

      {/* CSV Export Modal */}
      {activePoForCsv && (
        <CsvExportModal
          isOpen={!!activePoForCsv}
          onClose={() => setActivePoForCsv(null)}
          title={`Exporter ${activePoForCsv.po_number} (${activePoForCsv.supplier})`}
          defaultProvider={activePoForCsv.supplier === 'DigiKey' ? 'DigiKey' : activePoForCsv.supplier === 'Mouser' ? 'Mouser' : activePoForCsv.supplier === 'LCSC' ? 'LCSC' : 'Générique'}
          defaultCustomerRef={activePoForCsv.po_number}
          items={(activePoForCsv.items || []).map(i => ({
            id: i.id,
            mpn: i.sku || i.description,
            sku: i.sku,
            distributor: activePoForCsv.supplier,
            quantity: i.quantity,
            price: i.unit_price_est,
            description: i.description
          }))}
        />
      )}
    </div>
  );
}
