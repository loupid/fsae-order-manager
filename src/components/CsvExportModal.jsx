import React, { useState, useMemo, useEffect } from 'react';
import { X, Download, Copy, Check, FileSpreadsheet, CheckSquare, Square } from 'lucide-react';

function CsvExportModal({ isOpen, onClose, title = "Exporter la liste", items = [], defaultProvider = "DigiKey", defaultCustomerRef = "" }) {
  const [provider, setProvider] = useState(defaultProvider);
  const [exportMode, setExportMode] = useState('all'); // 'all' | 'missing' | 'selected'
  const [customerRef, setCustomerRef] = useState(defaultCustomerRef);
  const [useSku, setUseSku] = useState(true);
  const [activeTab, setActiveTab] = useState('previewTable'); // 'previewTable' | 'rawCsv'
  
  // Interactive selection set of indexes
  const [selectedIndexes, setSelectedIndexes] = useState(new Set());
  const [copied, setCopied] = useState(false);

  // Initialize selected indexes to all items on load/change
  useEffect(() => {
    setSelectedIndexes(new Set(items.map((_, idx) => idx)));
  }, [items]);

  // Handle supplier change: if we switch, we might want to default useSku to true
  useEffect(() => {
    setProvider(defaultProvider);
  }, [defaultProvider]);

  // Adjust prefilled customer reference if it changes
  useEffect(() => {
    setCustomerRef(defaultCustomerRef);
  }, [defaultCustomerRef]);

  // Filter items based on the exportMode
  const processedItems = useMemo(() => {
    return items.map((item, idx) => {
      let active = true;
      if (exportMode === 'missing') {
        active = !!item.isMissing;
      } else if (exportMode === 'selected') {
        active = selectedIndexes.has(idx);
      }
      return { ...item, originalIndex: idx, active };
    });
  }, [items, exportMode, selectedIndexes]);

  const activeItems = useMemo(() => {
    return processedItems.filter(item => item.active);
  }, [processedItems]);

  // Generate CSV string
  const csvContent = useMemo(() => {
    if (activeItems.length === 0) return '';

    let headers = '';
    let rows = [];

    if (provider === 'DigiKey') {
      headers = 'Part Number,Quantity,Customer Reference';
      rows = activeItems.map(item => {
        const skuVal = (useSku && item.sku && item.distributor === 'DigiKey') ? item.sku : item.mpn;
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : item.quantity) : item.quantity;
        return `"${skuVal.replace(/"/g, '""')}",${qtyVal},"${customerRef.replace(/"/g, '""')}"`;
      });
    } else if (provider === 'Mouser') {
      headers = 'Mouser Part Number,Quantity,Customer Reference';
      rows = activeItems.map(item => {
        const skuVal = (useSku && item.sku && item.distributor === 'Mouser') ? item.sku : item.mpn;
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : item.quantity) : item.quantity;
        return `"${skuVal.replace(/"/g, '""')}",${qtyVal},"${customerRef.replace(/"/g, '""')}"`;
      });
    } else if (provider === 'LCSC') {
      headers = 'LCSC Part Number,Quantity,Customer Reference';
      rows = activeItems.map(item => {
        const skuVal = (useSku && item.sku && item.distributor === 'LCSC') ? item.sku : item.mpn;
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : item.quantity) : item.quantity;
        return `"${skuVal.replace(/"/g, '""')}",${qtyVal},"${customerRef.replace(/"/g, '""')}"`;
      });
    } else { // Generic / CSV complet
      headers = 'Manufacturer Part Number (MPN),Distributor Part Number (SKU),Distributor,Quantity,Price CAD,Description,Customer Reference';
      rows = activeItems.map(item => {
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : item.quantity) : item.quantity;
        return `"${item.mpn.replace(/"/g, '""')}","${(item.sku || '').replace(/"/g, '""')}","${(item.distributor || '').replace(/"/g, '""')}",${qtyVal},${item.price || 0},"${(item.description || '').replace(/"/g, '""')}","${customerRef.replace(/"/g, '""')}"`;
      });
    }

    return [headers, ...rows].join('\r\n');
  }, [activeItems, provider, exportMode, customerRef, useSku]);

  // Copy to clipboard action
  const handleCopy = () => {
    if (!csvContent) return;
    navigator.clipboard.writeText(csvContent)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error("Impossible de copier : ", err);
      });
  };

  // Download file action
  const handleDownload = () => {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = `${provider}_BOM_${customerRef.replace(/\s+/g, '_') || 'Export'}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle item selection
  const toggleIndex = (idx) => {
    const next = new Set(selectedIndexes);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedIndexes(next);
    if (exportMode !== 'selected') {
      setExportMode('selected');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIndexes.size === items.length) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(items.map((_, idx) => idx)));
    }
    if (exportMode !== 'selected') {
      setExportMode('selected');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '1.75rem' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '1rem', marginBottom: '1.25rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileSpreadsheet style={{ width: '24px', height: '24px', color: 'var(--accent-red)' }} />
            <h2 className="modal-title" style={{ fontSize: '1.25rem' }}>{title}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Two pane body */}
        <div className="grid-2" style={{ flex: 1, overflow: 'hidden', gridTemplateColumns: '320px 1fr', gap: '1.5rem', minHeight: '380px' }}>
          
          {/* Left panel: configurations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRight: '1px solid var(--glass-border)', paddingRight: '1.5rem', overflowY: 'auto' }}>
            
            <div className="form-group">
              <label className="form-label">Format de Distributeur</label>
              <select 
                className="input select"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="DigiKey">DigiKey Quick Order</option>
                <option value="Mouser">Mouser BOM Tool</option>
                <option value="LCSC">LCSC Easy Buy</option>
                <option value="Générique">Générique (CSV complet)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Filtrer les pièces</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="radio" 
                    name="exportMode" 
                    checked={exportMode === 'all'} 
                    onChange={() => setExportMode('all')}
                  />
                  Toutes les pièces ({items.length})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="radio" 
                    name="exportMode" 
                    checked={exportMode === 'missing'} 
                    onChange={() => setExportMode('missing')}
                  />
                  Pièces manquantes uniquement ({items.filter(item => item.isMissing).length})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="radio" 
                    name="exportMode" 
                    checked={exportMode === 'selected'} 
                    onChange={() => setExportMode('selected')}
                  />
                  Sélection personnalisée ({selectedIndexes.size})
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Référence Client / Projet</label>
              <input 
                type="text" 
                className="input" 
                placeholder="ex: Dashboard_BOM" 
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Sera inséré dans la colonne "Customer Reference" de chaque ligne.
              </span>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={useSku} 
                  onChange={(e) => setUseSku(e.target.checked)}
                />
                Utiliser le SKU si dispo (sinon MPN)
              </label>
            </div>

            {/* Micro Info Summary */}
            <div style={{ marginTop: 'auto', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Résumé :</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <span>Pièces à exporter :</span>
                <strong className="mono">{activeItems.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <span>Quantité totale :</span>
                <strong className="mono">
                  {activeItems.reduce((acc, i) => acc + (exportMode === 'missing' ? (i.quantityMissing !== undefined ? i.quantityMissing : i.quantity) : i.quantity), 0)} u
                </strong>
              </div>
              {activeItems.some(i => i.price) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span>Total estimé :</span>
                  <strong className="mono" style={{ color: 'var(--accent-red)' }}>
                    {activeItems.reduce((acc, i) => acc + ((i.price || 0) * (exportMode === 'missing' ? (i.quantityMissing !== undefined ? i.quantityMissing : i.quantity) : i.quantity)), 0).toFixed(2)} $
                  </strong>
                </div>
              )}
            </div>

          </div>

          {/* Right panel: preview and data */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            
            {/* View switcher Tabs */}
            <div className="tabs-container" style={{ marginBottom: '1rem', flexShrink: 0 }}>
              <button 
                className={`tab-btn ${activeTab === 'previewTable' ? 'active' : ''}`}
                onClick={() => setActiveTab('previewTable')}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              >
                Aperçu Tableau ({activeItems.length})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'rawCsv' ? 'active' : ''}`}
                onClick={() => setActiveTab('rawCsv')}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              >
                Fichier CSV Brut
              </button>
            </div>

            {/* Pane Contents */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'previewTable' ? (
                <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', padding: '0.5rem 0.75rem' }}>
                          <button 
                            type="button" 
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                            onClick={toggleSelectAll}
                            title="Tout cocher / décocher"
                          >
                            <CheckSquare style={{ width: '16px', height: '16px' }} />
                          </button>
                        </th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Référence (MPN / SKU)</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '80px' }}>Qté</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Réf Client</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedItems.map((item) => {
                        const isChecked = selectedIndexes.has(item.originalIndex);
                        const isChosenProviderSku = item.sku && item.distributor === provider;
                        return (
                          <tr 
                            key={item.originalIndex} 
                            style={{ 
                              opacity: item.active ? 1 : 0.4,
                              background: !item.active ? 'rgba(0,0,0,0.1)' : 'inherit'
                            }}
                          >
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => toggleIndex(item.originalIndex)}
                                style={{ background: 'none', border: 'none', color: isChecked ? 'var(--status-received)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              >
                                {isChecked ? (
                                  <CheckSquare style={{ width: '18px', height: '18px' }} />
                                ) : (
                                  <Square style={{ width: '18px', height: '18px' }} />
                                )}
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <strong className="mono" style={{ display: 'block', fontSize: '0.8rem' }}>
                                {useSku && isChosenProviderSku ? item.sku : item.mpn}
                              </strong>
                              {useSku && isChosenProviderSku && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  MPN: {item.mpn} ({provider})
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} className="mono">
                              {item.quantity}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                              {customerRef || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', overflow: 'hidden' }}>
                  <textarea 
                    className="input mono" 
                    readOnly 
                    value={csvContent} 
                    style={{ 
                      flex: 1, 
                      resize: 'none', 
                      background: 'transparent', 
                      border: 'none', 
                      fontSize: '0.8rem',
                      lineHeight: '1.4',
                      padding: 0,
                      outline: 'none',
                      color: 'var(--text-secondary)'
                    }} 
                    placeholder="Aucune pièce sélectionnée pour l'exportation."
                  />
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', marginTop: '1.5rem', flexShrink: 0 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {provider === 'Générique' 
              ? "Format universel complet avec MPN, SKU, Prix, Description."
              : `Optimisé pour l'outil de commande rapide (Quick Order) de ${provider}.`
            }
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleCopy}
              disabled={activeItems.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {copied ? (
                <>
                  <Check style={{ width: '16px', height: '16px', color: 'var(--status-received)' }} />
                  Copié !
                </>
              ) : (
                <>
                  <Copy style={{ width: '16px', height: '16px' }} />
                  Copier dans le presse-papier
                </>
              )}
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleDownload}
              disabled={activeItems.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download style={{ width: '16px', height: '16px' }} />
              Télécharger .CSV
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CsvExportModal;
