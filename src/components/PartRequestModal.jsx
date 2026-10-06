import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../utils/useMediaQuery';
import { resolveDefaultSubsystemId } from '../utils/subsystemHelper';
import { X, Sparkles, AlertCircle } from 'lucide-react';

export default function PartRequestModal({ isOpen, onClose, onCreated, subsystems = [], currentUser }) {
  const isMobile = useIsMobile(768);
  let authContext = null;
  try {
    authContext = useAuth();
  } catch (e) {
    // Fallback if rendered outside AuthProvider
  }
  const user = currentUser || authContext?.user;

  const [internalSubsystems, setInternalSubsystems] = useState([]);
  const activeSubsystems = (subsystems && subsystems.length > 0) ? subsystems : internalSubsystems;

  useEffect(() => {
    if (isOpen && (!subsystems || subsystems.length === 0)) {
      apiClient.getPublicSubsystems()
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setInternalSubsystems(data);
          }
        })
        .catch(err => {
          console.warn('PartRequestModal could not fetch public subsystems fallback:', err.message);
        });
    }
  }, [isOpen, subsystems]);

  const [url, setUrl] = useState('');
  const [supplier, setSupplier] = useState('');
  const [sku, setSku] = useState('');
  const [mpn, setMpn] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPriceEst, setUnitPriceEst] = useState('');
  const [subsystemId, setSubsystemId] = useState(() => resolveDefaultSubsystemId(activeSubsystems, user));
  const [urgencyLevel, setUrgencyLevel] = useState('NORMAL');
  
  const [parsing, setParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setUrl('');
    setSupplier('');
    setSku('');
    setMpn('');
    setDescription('');
    setQuantity(1);
    setUnitPriceEst('');
    setSubsystemId(resolveDefaultSubsystemId(activeSubsystems, user));
    setUrgencyLevel('NORMAL');
    setParsing(false);
    setParseSuccess(false);
    setSubmitting(false);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const isValid = Boolean(subsystemId) && activeSubsystems.some(s => Number(s.id) === Number(subsystemId));
      if (!isValid) {
        const defaultId = resolveDefaultSubsystemId(activeSubsystems, user);
        if (defaultId !== '' && defaultId !== null && defaultId !== undefined) {
          setSubsystemId(defaultId);
        }
      }
    } else {
      resetForm();
    }
  }, [isOpen, activeSubsystems, user]);

  // Fast client-side regex extractor for immediate response on paste/type
  const extractFromUrlClient = (rawUrl) => {
    if (!rawUrl) return;
    try {
      const u = rawUrl.trim();
      if (/digikey\./i.test(u)) {
        setSupplier('DigiKey');
        const dk3Match = u.match(/(?:products\/detail|product-detail)\/(?:[a-z]{2}\/)?[^\/]+\/([^\/\?#]+)\/([^\/\?#]+)/i);
        const dk2Match = u.match(/(?:products\/detail|product-detail)\/(?:[a-z]{2}\/)?[^\/]+\/([^\/\?#]+)/i);
        if (dk3Match) {
          const extractedMpn = decodeURIComponent(dk3Match[1]).trim();
          const extractedSku = decodeURIComponent(dk3Match[2]).trim();
          setMpn(extractedMpn);
          setSku(extractedSku);
          setParseSuccess(true);
        } else if (dk2Match && dk2Match[1]) {
          const extractedMpn = decodeURIComponent(dk2Match[1]).trim();
          setMpn(extractedMpn);
          setParseSuccess(true);
        }
      } else if (/mouser\./i.test(u)) {
        setSupplier('Mouser');
        const mouserMatch = u.match(/ProductDetail\/[^\/]+\/([^\/\?#]+)/i);
        if (mouserMatch && mouserMatch[1]) {
          const extractedSku = decodeURIComponent(mouserMatch[1]);
          setSku(extractedSku);
          setParseSuccess(true);
        }
      } else if (/mcmaster\.com/i.test(u)) {
        setSupplier('McMaster-Carr');
        const mcmMatch = u.match(/mcmaster\.com\/([0-9]{4,6}[A-Z0-9]{2,6})/i);
        if (mcmMatch && mcmMatch[1]) {
          setSku(mcmMatch[1]);
          setParseSuccess(true);
        }
      } else if (/lcsc\.com/i.test(u)) {
        setSupplier('LCSC');
        const lcscMatch = u.match(/(?:product-detail\/.*_)?(C[0-9]+)/i) || u.match(/(C[0-9]+)/i);
        if (lcscMatch && lcscMatch[1]) {
          setSku(lcscMatch[1].toUpperCase());
          setParseSuccess(true);
        }
      } else if (/jlcpcb\.com/i.test(u)) {
        setSupplier('JLCPCB');
        const jlcMatch = u.match(/searchTxt=(C[0-9]+)/i) || u.match(/(C[0-9]+)/i);
        if (jlcMatch && jlcMatch[1]) {
          setSku(jlcMatch[1].toUpperCase());
          setParseSuccess(true);
        }
      }
    } catch (e) {
      // client extraction silent catch
    }
  };

  const handleUrlChange = (val) => {
    setUrl(val);
    setParseSuccess(false);
    extractFromUrlClient(val);
  };

  const handleUrlBlur = async () => {
    if (!url.trim()) return;
    setParsing(true);
    setError('');
    try {
      const res = await apiClient.parseUrl(url.trim());
      if (res.supplier && res.supplier !== 'Other') setSupplier(res.supplier);
      if (res.sku) setSku(res.sku);
      if (res.mpn) setMpn(res.mpn);
      if (res.recognized) {
        setParseSuccess(true);
      }
    } catch (e) {
      console.warn('URL auto-parse notice:', e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Veuillez renseigner une description pour la pièce.');
      return;
    }

    let targetSubsystemId = subsystemId;
    if (!targetSubsystemId && activeSubsystems.length > 0) {
      targetSubsystemId = resolveDefaultSubsystemId(activeSubsystems, user) || activeSubsystems[0]?.id;
      if (targetSubsystemId !== '' && targetSubsystemId !== null && targetSubsystemId !== undefined) {
        setSubsystemId(targetSubsystemId);
      }
    }

    if (!targetSubsystemId) {
      setError('Veuillez sélectionner un sous-système.');
      return;
    }

    setSubmitting(true);
    try {
      const newReq = await apiClient.createPartRequest({
        subsystem_id: Number(targetSubsystemId),
        supplier: supplier.trim() || 'Fournisseur inconnu',
        sku: sku.trim() || mpn.trim(),
        url: url.trim(),
        description: description.trim(),
        quantity: parseInt(quantity, 10) || 1,
        unit_price_est: parseFloat(unitPriceEst) || 0.0,
        urgency_level: urgencyLevel,
        status: 'SUBMITTED'
      });

      onCreated(newReq);
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la soumission de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
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
        maxWidth: isMobile ? '100%' : '560px',
        maxHeight: '92dvh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #232733',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📦</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
              Nouvelle Demande de Pièce
            </h3>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.4rem',
              minWidth: '36px',
              minHeight: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Form Body - Scrollable content with fixed footer */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          <div style={{
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flex: 1
          }}>
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#451a1a',
                border: '1px solid #dc2626',
                color: '#f87171',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Supplier URL with Live Auto-Extract */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1' }}>
                  Lien de la pièce (DigiKey, Mouser, McMaster...)
                </label>
                {parsing && (
                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Sparkles style={{ width: '12px', height: '12px' }} /> Détection auto...
                  </span>
                )}
                {parseSuccess && !parsing && (
                  <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>
                    ✨ Métadonnées extraites !
                  </span>
                )}
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://www.digikey.ca/en/products/detail/..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#0f1115',
                  border: parseSuccess ? '1px solid #16a34a' : '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Live Subtotal Estimation Badge */}
            {(parseFloat(unitPriceEst) > 0 || parseInt(quantity, 10) > 1) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.85rem',
                backgroundColor: '#0c2e1f',
                border: '1px solid #16a34a',
                borderRadius: '6px',
                fontSize: '0.82rem'
              }}>
                <span style={{ color: '#86efac', fontWeight: '600' }}>
                  Estimation Sous-Total ({parseInt(quantity, 10) || 1} unité{(parseInt(quantity, 10) || 1) > 1 ? 's' : ''}) :
                </span>
                <strong style={{ color: '#4ade80', fontSize: '0.92rem' }}>
                  ${((parseInt(quantity, 10) || 1) * (parseFloat(unitPriceEst) || 0)).toFixed(2)} CAD
                </strong>
              </div>
            )}

            {/* Supplier & SKU / MPN Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Fournisseur
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="ex: DigiKey, McMaster"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0f1115',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  SKU / Référence Pièce
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="ex: 296-1234-1-ND"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0f1115',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
                {mpn && (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    MPN détecté : <strong style={{ color: '#38bdf8' }}>{mpn}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Description de la pièce *
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Régulateur Buck 5V 2A SOIC-8 pour télémétrie"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#0f1115',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Subsystem & Urgency Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Sous-système FSAE *
                </label>
                <select
                  value={subsystemId ? String(subsystemId) : (activeSubsystems[0] ? String(activeSubsystems[0].id) : '')}
                  onChange={(e) => setSubsystemId(e.target.value ? Number(e.target.value) : '')}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0f1115',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                >
                  {activeSubsystems.length === 0 ? (
                    <option value="">Chargement des sous-systèmes...</option>
                  ) : (
                    <>
                      {!subsystemId && (
                        <option value="" disabled>-- Sélectionner un sous-système --</option>
                      )}
                      {activeSubsystems.map(s => (
                        <option key={s.id} value={s.id}>
                          [{s.code}] {s.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Niveau d'Urgence *
                </label>
                <select
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: urgencyLevel === 'CRITICAL' ? '#451a1a' : urgencyLevel === 'URGENT' ? '#3b2512' : '#0f1115',
                    border: urgencyLevel === 'CRITICAL' ? '1px solid #dc2626' : urgencyLevel === 'URGENT' ? '1px solid #d97706' : '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="NORMAL">🟢 Normal (Planning standard)</option>
                  <option value="URGENT">⚡ Urgent (Prochain roulage)</option>
                  <option value="CRITICAL">🚨 CRITIQUE (Véhicule bloqué)</option>
                </select>
              </div>
            </div>

            {/* Quantity & Unit Price */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Quantité
                </label>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0f1115',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Prix Unitaire Estimé ($ CAD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={unitPriceEst}
                  onChange={(e) => setUnitPriceEst(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0f1115',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer for Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: isMobile ? '0.85rem 1.25rem calc(0.85rem + var(--safe-bottom, 0px))' : '1rem 1.25rem',
            borderTop: '1px solid #232733',
            backgroundColor: '#161920',
            flexShrink: 0
          }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '0.6rem 1.1rem',
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
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.4)',
                minHeight: '44px'
              }}
            >
              {submitting ? 'Envoi...' : 'Soumettre la Demande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
