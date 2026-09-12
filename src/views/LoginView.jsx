import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  User,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  MessageSquare,
  Sparkles,
  ChevronRight
} from 'lucide-react';

const UQTR_DEPARTMENTS = [
  {
    code: 'ELE',
    name: 'Team Électrique',
    icon: '⚡',
    badgeColor: '#10b981',
    bgColor: '#064e3b33',
    borderColor: '#059669',
    description: 'Accumulateur HV, BMS, Onduleur, Low-Voltage, Télémétrie & ECU',
    suggestions: ['BMS & Accu Haute Tension', 'Télémétrie & Capteurs CAN', 'Conception PCB (JLCPCB/LCSC)', 'Faisceau Basse Tension', 'Onduleur & Contrôle Moteur']
  },
  {
    code: 'STR',
    name: 'Team Structure',
    icon: '🦾',
    badgeColor: '#38bdf8',
    bgColor: '#0c4a6e33',
    borderColor: '#0284c7',
    description: 'Châssis tubulaire/monocoque, Aérodynamique carbone, Crashbox',
    suggestions: ['Châssis tubulaire', 'Aérodynamisme & Ailerons', 'Matériaux composites carbone', 'Crashbox & Absorption', 'Conception CAO SolidWorks']
  },
  {
    code: 'DRI',
    name: 'Team Drivetrain',
    icon: '🏎️',
    badgeColor: '#f97316',
    bgColor: '#7c2d1233',
    borderColor: '#ea580c',
    description: 'Moteur électrique, Transmission planétaire, Refroidissement, Différentiel',
    suggestions: ['Moteur électrique synchrone', 'Transmission & Réducteur', 'Circuit de refroidissement liquide', 'Différentiel & Arbres de roues']
  },
  {
    code: 'ERG',
    name: 'Team Ergonomie',
    icon: '💺',
    badgeColor: '#ec4899',
    bgColor: '#83184333',
    borderColor: '#db2777',
    description: 'Volant multifonction, Pédalier réglable, Harnais, Siège pilote',
    suggestions: ['Volant multifonction', 'Pédalier réglable en atelier', 'Moulage siège fibre de carbone', 'Position de pilotage & Sécurité']
  },
  {
    code: 'ADM',
    name: 'Team Administration',
    icon: '📊',
    badgeColor: '#a855f7',
    bgColor: '#581c8733',
    borderColor: '#9333ea',
    description: 'Gestion de projet, Budget global, Commandes, Sponsoring, Cost Report',
    suggestions: ['Gestion des commandes de pièces', 'Relations commanditaires & Sponsors', 'Cost Report & Finances FSAE', 'Communication & Événements']
  }
];

export default function LoginView() {
  const { login, register, error } = useAuth();

  // Mode: false = Connexion classique, true = Questionnaire d'intégration UQTR
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isCleanInstall, setIsCleanInstall] = useState(false);
  const [step, setStep] = useState(1); // 1, 2, 3

  React.useEffect(() => {
    fetch('/api/auth/setup-status')
      .then((r) => r.json())
      .then((d) => {
        if (d.isCleanInstall) {
          setIsCleanInstall(true);
          setIsRegisterMode(true);
        }
      })
      .catch(() => {});
  }, []);

  // Champs du formulaire & questionnaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('ELE');
  const [subsystem, setSubsystem] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [role, setRole] = useState('Member');

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  // Détection du courriel officiel UQTR
  const isUqtrEmail = email.trim().toLowerCase().endsWith('@uqtr.ca');

  const handleQuickPersona = (pEmail, pPassword) => {
    setEmail(pEmail);
    setPassword(pPassword);
    setLocalError('');
  };

  const selectedDeptObj = UQTR_DEPARTMENTS.find(d => d.code === department) || UQTR_DEPARTMENTS[0];

  const handleNextStep = (e) => {
    e.preventDefault();
    setLocalError('');

    if (step === 1) {
      if (!name.trim()) {
        setLocalError('Veuillez renseigner votre prénom et nom.');
        return;
      }
      if (!email.trim()) {
        setLocalError('Veuillez renseigner votre courriel.');
        return;
      }
      if (!password || password.length < 3) {
        setLocalError('Le mot de passe doit comporter au moins 3 caractères.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!department) {
        setLocalError('Veuillez sélectionner un pôle / département.');
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setLocalError('');
    if (step > 1) setStep(step - 1);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSubmitting(true);

    try {
      if (isRegisterMode) {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          department,
          subsystem: subsystem.trim() || selectedDeptObj.name,
          discord_handle: discordHandle.trim()
        });
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setLocalError(err.message || 'Erreur lors de la connexion/inscription.');
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
      backgroundImage: 'radial-gradient(ellipse at top, #1e293b26 0%, #0c0d10 80%)'
    }}>
      <div style={{
        backgroundColor: '#14171d',
        border: '1px solid #262c38',
        borderRadius: '16px',
        width: '100%',
        maxWidth: isRegisterMode ? '560px' : '440px',
        padding: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        transition: 'max-width 0.25s ease'
      }}>
        {/* Header commun */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
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

        {/* Affichage d'erreur */}
        {(localError || error) && (
          <div style={{
            backgroundColor: '#451a1a',
            border: '1px solid #dc2626',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.82rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ShieldAlert style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{localError || error}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 1 : QUESTIONNAIRE D'INTÉGRATION UQTR                     */}
        {/* ------------------------------------------------------------- */}
        {isRegisterMode ? (
          <div>
            {/* Barre de progression des 3 étapes */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: step >= 1 ? '#10b981' : '#64748b' }}>
                  1. Identité UQTR
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: step >= 2 ? '#10b981' : '#64748b' }}>
                  2. Pôle FSAE
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: step >= 3 ? '#10b981' : '#64748b' }}>
                  3. Spécialité & Discord
                </span>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(step / 3) * 100}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Notification Première Installation / Base Propre */}
            {isCleanInstall && (
              <div style={{
                padding: '0.75rem 0.9rem',
                backgroundColor: '#78350f22',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                color: '#fef3c7',
                fontSize: '0.8rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem'
              }}>
                <span style={{ fontSize: '1.35rem' }}>👑</span>
                <div>
                  <div style={{ fontWeight: '800', color: '#fbbf24', fontSize: '0.84rem' }}>
                    Premier Compte : Administrateur Principal
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#fde68a' }}>
                    Bienvenue ! La base est vierge : ce tout premier compte disposera des pleins privilèges d'administration de l'écurie.
                  </div>
                </div>
              </div>
            )}

            {/* ÉTAPE 1 : Identité & Courriel UQTR */}
            {step === 1 && (
              <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#064e3b22',
                  border: '1px solid #05966955',
                  borderRadius: '8px',
                  color: '#a7f3d0',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Sparkles style={{ width: '16px', height: '16px', flexShrink: 0, color: '#10b981' }} />
                  <span>Questionnaire d'accueil pour les recrues et membres des Patriotes FSAE UQTR.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Prénom & Nom complet *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ex: Jean Tremblay"
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1' }}>
                      Courriel Universitaire UQTR *
                    </label>
                    {email && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        color: isUqtrEmail ? '#10b981' : '#fb923c'
                      }}>
                        {isUqtrEmail ? '✓ Courriel @uqtr.ca reconnu 🎓' : '💡 Préférer adresse @uqtr.ca'}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@uqtr.ca"
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem 0.65rem 2.25rem',
                        backgroundColor: '#0f1115',
                        border: isUqtrEmail ? '1px solid #10b981' : '1px solid #334155',
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
                    Mot de passe simple *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Choisis un mot de passe simple"
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

                <button
                  type="submit"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
                  }}
                >
                  <span>Continuer : Mon Pôle FSAE</span>
                  <ArrowRight style={{ width: '16px', height: '16px' }} />
                </button>
              </form>
            )}

            {/* ÉTAPE 2 : Choix du Pôle / Département */}
            {step === 2 && (
              <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                  Sélectionne ton pôle d'activité au sein de la monoplace :
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {UQTR_DEPARTMENTS.map((dept) => {
                    const isSelected = department === dept.code;
                    return (
                      <div
                        key={dept.code}
                        onClick={() => setDepartment(dept.code)}
                        style={{
                          padding: '0.75rem 0.9rem',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${dept.borderColor}` : '1px solid #1f242e',
                          backgroundColor: isSelected ? dept.bgColor : '#0f1115',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: '1.4rem' }}>{dept.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                            <span style={{ fontWeight: '700', color: '#f8fafc', fontSize: '0.88rem' }}>
                              {dept.name}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: '#1e293b',
                              color: dept.badgeColor
                            }}>
                              {dept.code}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {dept.description}
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 style={{ width: '18px', height: '18px', color: dept.badgeColor }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    style={{
                      flex: 1,
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      backgroundColor: '#1e293b',
                      color: '#cbd5e1',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <ArrowLeft style={{ width: '15px', height: '15px' }} />
                    <span>Retour</span>
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 2,
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#059669',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
                    }}
                  >
                    <span>Continuer : Spécialité</span>
                    <ArrowRight style={{ width: '15px', height: '15px' }} />
                  </button>
                </div>
              </form>
            )}

            {/* ÉTAPE 3 : Spécialité Technique & Discord */}
            {step === 3 && (
              <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Récapitulatif du pôle */}
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  backgroundColor: selectedDeptObj.bgColor,
                  border: `1px solid ${selectedDeptObj.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>{selectedDeptObj.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#f8fafc' }}>
                      Pôle sélectionné : {selectedDeptObj.name} ({selectedDeptObj.code})
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                      {name} • {email}
                    </div>
                  </div>
                </div>

                {/* Suggestions de sous-systèmes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Spécialité / Sous-système visé
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                    {selectedDeptObj.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSubsystem(sug)}
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          border: subsystem === sug ? `1px solid ${selectedDeptObj.borderColor}` : '1px solid #334155',
                          backgroundColor: subsystem === sug ? '#1e293b' : '#0f1115',
                          color: subsystem === sug ? selectedDeptObj.badgeColor : '#94a3b8',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={subsystem}
                    onChange={(e) => setSubsystem(e.target.value)}
                    placeholder={`ex: ${selectedDeptObj.suggestions[0]}`}
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

                {/* Pseudo Discord */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1' }}>
                      Pseudo Discord (Optionnel)
                    </label>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Pour les salons d'écurie
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <MessageSquare style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                    <input
                      type="text"
                      value={discordHandle}
                      onChange={(e) => setDiscordHandle(e.target.value)}
                      placeholder="ex: alex_fsae#1234 ou @alex_fsae"
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

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      backgroundColor: '#1e293b',
                      color: '#cbd5e1',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <ArrowLeft style={{ width: '15px', height: '15px' }} />
                    <span>Retour</span>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      flex: 2,
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
                    <span>{submitting ? 'Création...' : "🏁 Rejoindre l'écurie UQTR"}</span>
                    <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              </form>
            )}

            {/* Revenir à la connexion */}
            {!isCleanInstall && (
              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => { setIsRegisterMode(false); setStep(1); setLocalError(''); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Déjà membre ? Se connecter avec son compte
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* MODE 2 : CONNEXION CLASSIQUE AVEC BOUTON QUESTIONNAIRE        */
          /* ------------------------------------------------------------- */
          <div>
            {/* Bouton d'accès au Questionnaire UQTR */}
            <div
              onClick={() => { setIsRegisterMode(true); setStep(1); setLocalError(''); }}
              style={{
                backgroundColor: '#064e3b22',
                border: '1px solid #059669',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#064e3b44'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#064e3b22'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🎓</span>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#a7f3d0' }}>
                    Inscription Membre UQTR
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>
                    Remplir le questionnaire d'accueil pour rejoindre l'équipe
                  </div>
                </div>
              </div>
              <ChevronRight style={{ width: '18px', height: '18px', color: '#10b981' }} />
            </div>

            {/* Comptes Démo Rapides (uniquement hors première installation propre) */}
            {!isCleanInstall && (
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
                    onClick={() => handleQuickPersona('member@fsae.org', 'member123')}
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
                    onClick={() => handleQuickPersona('purchaser@fsae.org', 'purchaser123')}
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
                    onClick={() => handleQuickPersona('admin@fsae.org', 'admin123')}
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
            )}

            {/* Formulaire de Connexion */}
            <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Courriel *
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@uqtr.ca ou admin@fsae.org"
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
                <span>{submitting ? 'Connexion en cours...' : 'Se connecter'}</span>
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
