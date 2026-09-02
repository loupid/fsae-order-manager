import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { X, UploadCloud, AlertCircle, CheckCircle2, FileText } from 'lucide-react';

export default function InvoiceUploadModal({ isOpen, onClose, purchaseOrder, onUploaded }) {
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState(purchaseOrder?.total_cost || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !purchaseOrder) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
        setError('Seuls les fichiers PDF sont acceptés pour la comptabilité FSAE.');
        setFile(null);
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError('Le fichier dépasse la limite maximale de 10 Mo.');
        setFile(null);
        return;
      }
      setError('');
      setFile(selected);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Veuillez sélectionner un fichier PDF.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const parsedAmount = amount !== '' ? parseFloat(amount) : purchaseOrder.total_cost;
      const res = await apiClient.uploadInvoice(purchaseOrder.id, file, parsedAmount);
      onUploaded(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'upload de la facture.');
    } finally {
      setUploading(false);
    }
  };

  return (
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
        maxWidth: '480px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.1rem 1.5rem',
          borderBottom: '1px solid #232733'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText style={{ width: '20px', height: '20px', color: '#60a5fa' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
              Attacher Facture : {purchaseOrder.po_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleUpload} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
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

          {/* PO Summary Details */}
          <div style={{
            backgroundColor: '#0f1115',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid #232733',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ color: '#94a3b8' }}>Fournisseur :</span>{' '}
              <strong style={{ color: '#f8fafc' }}>{purchaseOrder.supplier}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Coût Estimé :</span>{' '}
              <strong style={{ color: '#4ade80' }}>${Number(purchaseOrder.total_cost || 0).toFixed(2)} CAD</strong>
            </div>
          </div>

          {/* Amount Override */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Montant Facturé Réel ($ CAD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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

          {/* File Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Fichier PDF de la Facture *
            </label>
            <div style={{
              border: '2px dashed #334155',
              borderRadius: '8px',
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: file ? '#0f172a' : '#0f1115',
              cursor: 'pointer',
              position: 'relative'
            }}>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%'
                }}
              />
              <UploadCloud style={{ width: '32px', height: '32px', color: '#60a5fa', margin: '0 auto 0.5rem' }} />
              {file ? (
                <div>
                  <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '0.88rem' }}>{file.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{(file.size / 1024).toFixed(1)} Ko</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: '600', color: '#cbd5e1', fontSize: '0.85rem' }}>Cliquez pour choisir un PDF</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Format .pdf uniquement (max 10 Mo)</div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '6px',
                border: '1px solid #334155',
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: uploading || !file ? 'not-allowed' : 'pointer'
              }}
            >
              {uploading ? 'Upload en cours...' : 'Enregistrer la Facture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
