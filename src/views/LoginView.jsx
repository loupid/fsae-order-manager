import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';

export default function LoginView() {
  const { login, register, error } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Member');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleQuickPersona = (pEmail, pPassword) => {
    setEmail(pEmail);
    setPassword(pPassword);
    setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSubmitting(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Veuillez renseigner votre nom complet.');
        await register(name.trim(), email.trim(), password, role);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setLocalError(err.message || 'Erreur lors de la connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0c0d10',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundImage: 'radial-gradient(ellipse at top, #1e293b22 0%, #0c0d10 80%)'
    }}>
      <div style={{
        backgroundColor: '#14171d',
        border: '1px solid #262c38',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '440px',
        padding: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.65rem',
            margin: '0 auto 0.75rem',
            boxShadow: '0 0 22px rgba(16, 185, 129, 0.45)',
            border: '1px solid #10b981'
          }}>
            ⚡
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f8fafc', margin: '0 0 0.25rem' }}>
            Formule SAE <span style={{ color: '#10b981' }}>UQTR</span>
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#fb923c', margin: 0, fontWeight: '600' }}>
            Logistique & Approvisionnement — Monoplace Électrique
          </p>
        </div>

        {/* Quick Demo Persona Pickers */}
        <div style={{
          backgroundColor: '#0b0d11',
          border: '1px solid #1f242e',
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
            Comptes Démo Rapides :
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => handleQuickPersona('member@fsae.org', 'MemberPassword123!')}
              style={{
                padding: '0.35rem 0.45rem',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '5px',
                color: '#cbd5e1',
                fontSize: '0.72rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              👤 Alexandre (Élec)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPersona('purchaser@fsae.org', 'PurchaserPassword123!')}
              style={{
                padding: '0.35rem 0.45rem',
                backgroundColor: '#1e3a8a',
                border: '1px solid #2563eb',
                borderRadius: '5px',
                color: '#93c5fd',
                fontSize: '0.72rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🛒 Sarah (Achats)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPersona('admin@fsae.org', 'AdminPassword123!')}
              style={{
                padding: '0.35rem 0.45rem',
                backgroundColor: '#064e3b',
                border: '1px solid #059669',
                borderRadius: '5px',
                color: '#a7f3d0',
                fontSize: '0.72rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              👑 William (ECU)
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {(localError || error) && (
          <div style={{
            backgroundColor: '#451a1a',
            border: '1px solid #dc2626',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.82rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ShieldAlert style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Nom Complet *
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Tremblay"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.25rem',
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
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Email Universitaire *
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom.prenom@polymtl.ca ou member@fsae.org"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.25rem',
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

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Mot de passe *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.25rem',
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

          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Rôle d'équipe *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
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
                <option value="Member">Membre (Soumission de pièces)</option>
                <option value="Purchaser">Acheteur (Création PO & Commande)</option>
                <option value="Admin">Administrateur (Gestion complète)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#059669',
              color: '#fff',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
            }}
          >
            <span>{submitting ? 'Vérification...' : isRegister ? 'Créer mon compte' : 'Se connecter'}</span>
            <ArrowRight style={{ width: '16px', height: '16px' }} />
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setLocalError(''); }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.82rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isRegister ? 'Déjà un compte ? Connectez-vous' : "Nouveau membre ? Créez un compte"}
          </button>
        </div>
      </div>
    </div>
  );
}
