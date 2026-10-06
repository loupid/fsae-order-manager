import React, { useState, useMemo, useEffect } from 'react';
import { useIsMobile } from '../utils/useMediaQuery';
import { X, Download, Copy, Check, FileSpreadsheet, CheckSquare, Square } from 'lucide-react';

function CsvExportModal({ isOpen, onClose, title = "Exporter la liste", items = [], defaultProvider = "DigiKey", defaultCustomerRef = "" }) {
  const isMobile = useIsMobile(768);
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

    const escapeCsvField = (val) => String(val ?? '').replace(/"/g, '""');

    let headers = '';
    let rows = [];

    if (provider === 'DigiKey') {
      headers = 'Part Number,Quantity,Customer Reference';
      rows = activeItems.map(item => {
        const itemDist = String(item.distributor || item.supplier || '').toLowerCase();
        const skuVal = (useSku && item.sku && itemDist === 'digikey') ? item.sku : (item.mpn || item.sku || '');
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : (item.quantity || 1)) : (item.quantity || 1);
        return `"${escapeCsvField(skuVal)}",${qtyVal},"${escapeCsvField(customerRef)}"`;
      });
    } else if (provider === 'Mouser') {
      headers = 'Mouser Part Number,Quantity,Customer Reference';
      rows = activeItems.map(item => {
        const itemDist = String(item.distributor || item.supplier || '').toLowerCase();
        const skuVal = (useSku && item.sku && itemDist === 'mouser') ? item.sku : (item.mpn || item.sku || '');
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : (item.quantity || 1)) : (item.quantity || 1);
        return `"${escapeCsvField(skuVal)}",${qtyVal},"${escapeCsvField(customerRef)}"`;
      });
    } else if (provider === 'LCSC') {
      headers = 'LCSC Part Number,Quantity,Customer Reference';
      rows = activeItems.map(item => {
        const itemDist = String(item.distributor || item.supplier || '').toLowerCase();
        const skuVal = (useSku && item.sku && itemDist === 'lcsc') ? item.sku : (item.mpn || item.sku || '');
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : (item.quantity || 1)) : (item.quantity || 1);
        return `"${escapeCsvField(skuVal)}",${qtyVal},"${escapeCsvField(customerRef)}"`;
      });
    } else { // Generic / CSV complet
      headers = 'Manufacturer Part Number (MPN),Distributor Part Number (SKU),Distributor,Quantity,Price CAD,Description,Customer Reference';
      rows = activeItems.map(item => {
        const qtyVal = exportMode === 'missing' ? (item.quantityMissing !== undefined ? item.quantityMissing : (item.quantity || 1)) : (item.quantity || 1);
        const mpnVal = item.mpn || item.sku || '';
        const skuVal = item.sku || '';
        const distVal = item.distributor || item.supplier || '';
        const descVal = item.description || '';
        return `"${escapeCsvField(mpnVal)}","${escapeCsvField(skuVal)}","${escapeCsvField(distVal)}",${qtyVal},${Number(item.price) || 0},"${escapeCsvField(descVal)}","${escapeCsvField(customerRef)}"`;
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
    const safeRef = String(customerRef || 'Export').replace(/"/g, '').replace(/\s+/g, '_');
    const fileName = `${provider}_BOM_${safeRef}.csv`;
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
    <div className="modal-overlay" style={{ display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : '1rem' }}>
      <div className="card modal-content" style={{ maxWidth: isMobile ? '100%' : '900px', width: isMobile ? '100%' : '95%', maxHeight: isMobile ? '92dvh' : '92vh', borderRadius: isMobile ? '16px 16px 0 0' : 'var(--radius-lg)', display: 'flex', flexDirection: 'column', padding: isMobile ? '1.25rem 1.25rem calc(1.25rem + var(--safe-bottom, 0px))' : '1.75rem' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '1rem', marginBottom: '1.25rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileSpreadsheet style={{ width: '24px', height: '24px', color: 'var(--accent-red)' }} />
            <h2 className="modal-title" style={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }}>{title}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Two pane body */}
        <div className="grid-2" style={{ flex: 1, overflow: 'hidden', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: isMobile ? '1rem' : '1.5rem', minHeight: isMobile ? 'auto' : '380px' }}>
          
          {/* Left panel: configurations */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            borderRight: isMobile ? 'none' : '1px solid var(--glass-border)',
            borderBottom: isMobile ? '1px solid var(--glass-border)' : 'none',
            paddingRight: isMobile ? 0 : '1.5rem',
            paddingBottom: isMobile ? '1rem' : 0,
            maxHeight: isMobile ? '200px' : 'none',
            overflowY: 'auto'
          }}>
            
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
                                {useSku && isChosenProviderSku ? item.sku : (item.mpn || item.sku || '')}
                              </strong>
                              {useSku && isChosenProviderSku && (item.mpn || item.sku) && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  MPN: {item.mpn || item.sku} ({provider})
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
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '0.75rem' : '1rem',
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '1.25rem',
          marginTop: '1.25rem',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {provider === 'Générique' 
              ? "Format universel complet avec MPN, SKU, Prix, Description."
              : `Optimisé pour l'outil de commande rapide (Quick Order) de ${provider}.`
            }
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', width: isMobile ? '100%' : 'auto' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleCopy}
              disabled={activeItems.length === 0}
              style={{
                flex: isMobile ? 1 : 'initial',
                justifyContent: 'center',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {copied ? (
                <>
                  <Check style={{ width: '16px', height: '16px', color: 'var(--status-received)' }} />
                  Copié !
                </>
              ) : (
                <>
                  <Copy style={{ width: '16px', height: '16px' }} />
                  Copier
                </>
              )}
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleDownload}
              disabled={activeItems.length === 0}
              style={{
                flex: isMobile ? 1 : 'initial',
                justifyContent: 'center',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
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
