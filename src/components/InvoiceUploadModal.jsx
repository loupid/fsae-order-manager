import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { useIsMobile } from '../utils/useMediaQuery';
import { X, UploadCloud, AlertCircle, CheckCircle2, FileText, Camera, Sparkles } from 'lucide-react';

/**
 * Client-side lightweight image to PDF vector container converter.
 * Converts camera photos / JPEG / PNG into valid PDF-1.4 binary matching %PDF magic bytes.
 */
async function convertImageToPdf(imageFile) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        try {
          const maxDim = 2000;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const base64Data = dataUrl.split(',')[1];
          const binaryStr = atob(base64Data);
          const jpegBytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            jpegBytes[i] = binaryStr.charCodeAt(i);
          }

          const ptWidth = 595.28;
          const ptHeight = Math.round((595.28 * height) / width);

          const enc = new TextEncoder();
          const header = `%PDF-1.4\n`;
          const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
          const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
          const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
          const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
          const obj4Footer = `\nendstream\nendobj\n`;
          const contentStream = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im1 Do\nQ\n`;
          const obj5 = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

          const hBytes = enc.encode(header);
          const o1Bytes = enc.encode(obj1);
          const o2Bytes = enc.encode(obj2);
          const o3Bytes = enc.encode(obj3);
          const o4HBytes = enc.encode(obj4Header);
          const o4FBytes = enc.encode(obj4Footer);
          const o5Bytes = enc.encode(obj5);

          const offset1 = hBytes.length;
          const offset2 = offset1 + o1Bytes.length;
          const offset3 = offset2 + o2Bytes.length;
          const offset4 = offset3 + o3Bytes.length;
          const offset5 = offset4 + o4HBytes.length + jpegBytes.length + o4FBytes.length;

          const pad10 = (n) => String(n).padStart(10, '0');
          const xref = `xref\n0 6\n0000000000 65535 f \n${pad10(offset1)} 00000 n \n${pad10(offset2)} 00000 n \n${pad10(offset3)} 00000 n \n${pad10(offset4)} 00000 n \n${pad10(offset5)} 00000 n \n`;
          const startxrefOffset = offset5 + o5Bytes.length;
          const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxrefOffset}\n%%EOF\n`;
          const trailerBytes = enc.encode(xref + trailer);

          const totalLength = startxrefOffset + trailerBytes.length;
          const pdfBytes = new Uint8Array(totalLength);

          let pos = 0;
          pdfBytes.set(hBytes, pos); pos += hBytes.length;
          pdfBytes.set(o1Bytes, pos); pos += o1Bytes.length;
          pdfBytes.set(o2Bytes, pos); pos += o2Bytes.length;
          pdfBytes.set(o3Bytes, pos); pos += o3Bytes.length;
          pdfBytes.set(o4HBytes, pos); pos += o4HBytes.length;
          pdfBytes.set(jpegBytes, pos); pos += jpegBytes.length;
          pdfBytes.set(o4FBytes, pos); pos += o4FBytes.length;
          pdfBytes.set(o5Bytes, pos); pos += o5Bytes.length;
          pdfBytes.set(trailerBytes, pos);

          const baseName = imageFile.name.replace(/\.[^/.]+$/, '');
          const pdfFile = new File([pdfBytes], `${baseName}.pdf`, { type: 'application/pdf' });
          resolve(pdfFile);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Impossible de charger l'image pour la conversion"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier image"));
    reader.readAsDataURL(imageFile);
  });
}

export default function InvoiceUploadModal({ isOpen, onClose, purchaseOrder, onUploaded }) {
  const isMobile = useIsMobile(768);
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState(purchaseOrder?.total_cost || '');
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [isConverted, setIsConverted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !purchaseOrder) return null;

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    e.target.value = '';

    if (selected.size > 10 * 1024 * 1024) {
      setError('Le fichier dépasse la limite maximale de 10 Mo autorisée par le serveur.');
      setFile(null);
      setIsConverted(false);
      e.target.value = '';
      return;
    }

    const isPdf = selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf');
    const isImage = selected.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(selected.name);

    if (isPdf) {
      setError('');
      setFile(selected);
      setIsConverted(false);
      return;
    }

    if (isImage) {
      setError('');
      setConverting(true);
      try {
        const convertedPdf = await convertImageToPdf(selected);
        setFile(convertedPdf);
        setIsConverted(true);
      } catch (err) {
        setError("Erreur lors de la conversion de la photo en PDF : " + err.message);
        setFile(null);
        setIsConverted(false);
      } finally {
        setConverting(false);
      }
      return;
    }

    setError('Seuls les fichiers PDF et les photos (JPEG/PNG) sont acceptés.');
    setFile(null);
    setIsConverted(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Veuillez sélectionner un fichier PDF ou une photo.');
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
        maxWidth: isMobile ? '100%' : '480px',
        maxHeight: '90dvh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #232733',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText style={{ width: '20px', height: '20px', color: '#60a5fa' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
              Attacher Facture : {purchaseOrder.po_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.3rem',
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

        {/* Form */}
        <form onSubmit={handleUpload} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', overflowY: 'auto' }}>
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
              inputMode="decimal"
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

          {/* File Picker with PDF and Camera Image support */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Fichier Facture (PDF ou Photo Reçu) *
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
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                disabled={converting}
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
              
              {converting ? (
                <div>
                  <div style={{ fontWeight: '700', color: '#38bdf8', fontSize: '0.88rem' }}>
                    Conversion de la photo en PDF vectoriel...
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Emballage conforme aux règles comptables
                  </div>
                </div>
              ) : file ? (
                <div>
                  <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '0.88rem' }}>{file.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{(file.size / 1024).toFixed(1)} Ko</div>
                  {isConverted && (
                    <div style={{ marginTop: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: '#4ade80', backgroundColor: '#064e3b44', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      <Sparkles style={{ width: '12px', height: '12px' }} />
                      Photo convertie en PDF vectoriel avec succès !
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: '600', color: '#cbd5e1', fontSize: '0.85rem' }}>
                    Cliquez ou prenez une photo
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                    PDF direct ou Photo JPEG/PNG convertie auto (max 10 Mo)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid #1f242e'
          }}>
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
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={uploading || converting || !file}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: uploading || converting || !file ? 'not-allowed' : 'pointer',
                minHeight: '44px'
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
