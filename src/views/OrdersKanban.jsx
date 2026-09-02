import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ArrowRight, ArrowLeft, Eye, X, Upload, FileSpreadsheet, User, Info, DollarSign, Calendar, Truck } from 'lucide-react';

function OrdersKanban({ parts, orders, onSaveOrder, onDeleteOrder, onSavePart }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // CSV Import States
  const [csvText, setCsvText] = useState('');
  const [distributor, setDistributor] = useState('DigiKey');
  const [submittedBy, setSubmittedBy] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [importing, setImporting] = useState(false);

  // Helper to parse order CSV
  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setImporting(true);

    try {
      const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        alert("CSV invalide. Il doit y avoir au moins une ligne d'en-tête et une ligne de données.");
        setImporting(false);
        return;
      }

      // Detect separator
      const headerLine = lines[0];
      const sep = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';
      const headers = headerLine.split(sep).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

      const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('quantité'));
      const mpnIdx = headers.findIndex(h => h.includes('mpn') || h.includes('manufacturer part') || h.includes('mfg part'));
      const skuIdx = headers.findIndex(h => h.includes('sku') || (h.includes('part number') && !h.includes('manufacturer')));
      const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('description') || h.includes('comment'));
      const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('prix') || h.includes('unit price'));

      if (mpnIdx === -1 || qtyIdx === -1) {
        alert("Erreur : colonnes obligatoires MANUFACTURER PART NUMBER (MPN) et QUANTITY introuvables. En-têtes détectées : " + headers.join(', '));
        setImporting(false);
        return;
      }

      const items = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Basic quote-aware splitter
        const cols = [];
        let cur = '';
        let insideQuote = false;
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"' || char === "'") {
            insideQuote = !insideQuote;
          } else if (char === sep && !insideQuote) {
            cols.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        cols.push(cur.trim());

        const rawMpn = cols[mpnIdx]?.replace(/^["']|["']$/g, '');
        if (!rawMpn) continue;

        const rawQty = cols[qtyIdx] ? parseInt(cols[qtyIdx].replace(/^["']|["']$/g, ''), 10) : 1;
        const qty = isNaN(rawQty) ? 1 : rawQty;
        
        const sku = skuIdx !== -1 ? cols[skuIdx]?.replace(/^["']|["']$/g, '') : '';
        const desc = descIdx !== -1 ? cols[descIdx]?.replace(/^["']|["']$/g, '') : '';
        
        let price = 0;
        if (priceIdx !== -1 && cols[priceIdx]) {
          const parsedPrice = parseFloat(cols[priceIdx].replace(/^["']|["']$/g, '').replace(/[^0-9.]/g, ''));
          if (!isNaN(parsedPrice)) price = parsedPrice;
        }

        // Check/Find existing part in general catalog
        let part = parts.find(p => p.mpn.toUpperCase() === rawMpn.toUpperCase());
        let partId = part ? part.id : null;
        
        if (!part) {
          // Create the part automatically in catalog
          const saved = await onSavePart({
            mpn: rawMpn,
            sku: sku || '',
            distributor: distributor,
            description: desc || `Importé via commande CSV (${distributor})`,
            package: '',
            stock: 0,
            price: price
          });
          partId = saved.id;
        } else {
          // Enrich existing part if price or SKU was empty
          let updated = false;
          if (!part.sku && sku) {
            part.sku = sku;
            updated = true;
          }
          if ((!part.price || part.price === 0) && price > 0) {
            part.price = price;
            updated = true;
          }
          if (updated) {
            await onSavePart(part);
          }
        }

        items.push({
          partId: partId,
          quantity: qty,
          price: price || (part ? part.price : 0) || 0
        });
      }

      // Create new order as Draft
      await onSaveOrder({
        distributor,
        status: 'Draft',
        trackingNumber: trackingNumber.trim(),
        submittedBy: submittedBy.trim() || 'Acheteur CSV',
        items,
        createdAt: new Date().toISOString()
      });

      // Clear states
      setIsImportModalOpen(false);
      setCsvText('');
      setSubmittedBy('');
      setTrackingNumber('');
    } catch (err) {
      console.error(err);
      alert("Une erreur s'est produite lors de l'importation du fichier CSV.");
    } finally {
      setImporting(false);
    }
  };

  // Move order state (for arrows)
  const handleMoveOrder = (order, targetStatus) => {
    onSaveOrder({
      ...order,
      status: targetStatus
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(price);
  };

  // Group orders by status
  const ordersByStatus = useMemo(() => {
    return {
      Draft: orders.filter(o => o.status === 'Draft'),
      Ordered: orders.filter(o => o.status === 'Ordered'),
      Received: orders.filter(o => o.status === 'Received')
    };
  }, [orders]);

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Tableau Kanban des Commandes</h1>
          <p className="page-subtitle">Importez vos fichiers CSV DigiKey pour générer des commandes et suivez leur statut en temps réel.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsImportModalOpen(true)}>
          <Upload style={{ width: '18px', height: '18px' }} /> Importer Commande (CSV)
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* Column 1: Draft */}
        <div className="kanban-column" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', minHeight: '65vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="dot" style={{ backgroundColor: 'var(--status-draft)' }} />
              Brouillons
            </h2>
            <span className="badge badge-draft">{ordersByStatus.Draft.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ordersByStatus.Draft.map(order => (
              <OrderCard key={order.id} order={order} parts={parts} onMove={handleMoveOrder} onDelete={onDeleteOrder} onView={setSelectedOrder} />
            ))}
          </div>
        </div>

        {/* Column 2: Ordered */}
        <div className="kanban-column" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', minHeight: '65vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="dot" style={{ backgroundColor: 'var(--status-ordered)' }} />
              Commandés
            </h2>
            <span className="badge badge-ordered">{ordersByStatus.Ordered.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ordersByStatus.Ordered.map(order => (
              <OrderCard key={order.id} order={order} parts={parts} onMove={handleMoveOrder} onDelete={onDeleteOrder} onView={setSelectedOrder} />
            ))}
          </div>
        </div>

        {/* Column 3: Received */}
        <div className="kanban-column" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', minHeight: '65vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="dot" style={{ backgroundColor: 'var(--status-received)' }} />
              Reçus
            </h2>
            <span className="badge badge-received">{ordersByStatus.Received.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ordersByStatus.Received.map(order => (
              <OrderCard key={order.id} order={order} parts={parts} onMove={handleMoveOrder} onDelete={onDeleteOrder} onView={setSelectedOrder} />
            ))}
          </div>
        </div>

      </div>

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet style={{ color: 'var(--status-ordered)' }} />
                Importer une Commande via CSV
              </h2>
              <button className="close-btn" onClick={() => setIsImportModalOpen(false)}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleCsvImport}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Distributeur</label>
                  <select className="input select" value={distributor} onChange={(e) => setDistributor(e.target.value)}>
                    <option value="DigiKey">DigiKey</option>
                    <option value="Mouser">Mouser</option>
                    <option value="LCSC">LCSC</option>
                    <option value="Arrow">Arrow</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Acheteur / Demandé par *</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Entrez votre nom" 
                    value={submittedBy}
                    onChange={(e) => setSubmittedBy(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Numéro de Suivi (Optionnel)</label>
                <input 
                  type="text" 
                  className="input mono" 
                  placeholder="Ex: 1Z999AA10123456784" 
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Coller le contenu du CSV DigiKey *
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Format standard avec colonnes QUANTITY, MPN et prix</span>
                </label>
                <textarea
                  className="input mono"
                  rows="6"
                  placeholder='"QUANTITY","MANUFACTURER PART NUMBER","PART NUMBER","UNIT PRICE","DESCRIPTION"&#10;"20","RC2512JK-0791KL","13-RC2512JK-0791KLCT-ND","0.20300","RES 91K OHM 5%"'
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  {importing ? 'Importation...' : 'Créer la commande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Drawer/Modal */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '750px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Détails de la Commande ({selectedOrder.distributor})</h2>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acheteur</span>
                  <strong style={{ fontSize: '0.9rem' }}>{selectedOrder.submittedBy}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date de Création</span>
                  <strong style={{ fontSize: '0.9rem' }}>{new Date(selectedOrder.createdAt).toLocaleDateString('fr-CA')}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tracking / Suivi</span>
                  <strong style={{ fontSize: '0.9rem' }} className="mono">{selectedOrder.trackingNumber || 'Aucun'}</strong>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Pièces dans cette commande</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>MPN (Référence)</th>
                    <th>SKU (Distributeur)</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'center' }}>Quantité</th>
                    <th style={{ textAlign: 'right' }}>Prix Unitaire</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, idx) => {
                    const part = parts.find(p => p.id === item.partId);
                    return (
                      <tr key={idx}>
                        <td className="mono" style={{ fontWeight: '600' }}>{part?.mpn || 'Inconnu'}</td>
                        <td className="mono" style={{ fontSize: '0.85rem' }}>{part?.sku || 'N/A'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{part?.description || 'N/A'}</td>
                        <td style={{ textAlign: 'center' }} className="mono">{item.quantity}</td>
                        <td style={{ textAlign: 'right' }} className="mono">{formatPrice(item.price)}</td>
                        <td style={{ textAlign: 'right' }} className="mono" style={{ fontWeight: '600' }}>{formatPrice(item.price * item.quantity)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
              <div style={{ fontSize: '1rem' }}>
                Total de la Commande : <strong className="mono" style={{ fontSize: '1.25rem', color: 'var(--accent-red)' }}>
                  {formatPrice(selectedOrder.items.reduce((s, i) => s + (i.price * i.quantity), 0))}
                </strong>
              </div>
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent OrderCard
function OrderCard({ order, parts, onMove, onDelete, onView }) {
  const totalPrice = order.items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(price);
  };

  return (
    <div className="card" style={{ padding: '1rem', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
        <h3 className="mono" style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          {order.distributor}
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {new Date(order.createdAt).toLocaleDateString('fr-CA')}
        </span>
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        Demandé par : <strong style={{ color: 'var(--text-primary)' }}>{order.submittedBy}</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {order.items.length} lignes ({totalQty} pièces)
        </span>
        <strong className="mono" style={{ fontSize: '0.9rem', color: 'var(--status-ordered)' }}>
          {formatPrice(totalPrice)}
        </strong>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {order.status !== 'Draft' && (
            <button className="btn btn-secondary" style={{ padding: '0.3rem', borderRadius: '4px' }} onClick={() => onMove(order, order.status === 'Received' ? 'Ordered' : 'Draft')} title="Reculer d'un état">
              <ArrowLeft style={{ width: '14px', height: '14px' }} />
            </button>
          )}
          {order.status !== 'Received' && (
            <button className="btn btn-secondary" style={{ padding: '0.3rem', borderRadius: '4px' }} onClick={() => onMove(order, order.status === 'Draft' ? 'Ordered' : 'Received')} title="Avancer d'un état">
              <ArrowRight style={{ width: '14px', height: '14px' }} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.3rem', borderRadius: '4px' }} onClick={() => onView(order)} title="Voir Détails">
            <Eye style={{ width: '14px', height: '14px' }} />
          </button>
          <button className="btn btn-outline-red" style={{ padding: '0.3rem', borderRadius: '4px' }} onClick={() => { if (confirm("Supprimer cette commande et réajuster les stocks ?")) onDelete(order.id); }} title="Supprimer la Commande">
            <Trash2 style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrdersKanban;
