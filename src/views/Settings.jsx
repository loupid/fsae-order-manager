import React, { useState, useEffect } from 'react';
import { Database, ShieldAlert, Check, RefreshCw, Key, LogOut } from 'lucide-react';
import { api } from '../db';

function Settings() {
  const isConnected = api.isFirebaseActive();
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);


  useEffect(() => {
    // Load config from local storage to show in form fields if exists
    const localConfig = localStorage.getItem("fsae_firebase_config");
    if (localConfig) {
      try {
        const parsed = JSON.parse(localConfig);
        setApiKey(parsed.apiKey || '');
        setAuthDomain(parsed.authDomain || '');
        setProjectId(parsed.projectId || '');
        setStorageBucket(parsed.storageBucket || '');
        setMessagingSenderId(parsed.messagingSenderId || '');
        setAppId(parsed.appId || '');
      } catch (e) {
        console.error(e);
      }
    }

  }, []);



  const handleSaveConfig = (e) => {
    e.preventDefault();
    if (!apiKey || !projectId || !appId) {
      alert("Veuillez remplir au moins les champs requis (API Key, Project ID, App ID)");
      return;
    }

    const newConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim()
    };

    api.updateFirebaseConfig(newConfig);
    setSaveSuccess(true);
  };

  const handleDisconnect = () => {
    if (confirm("Déconnecter Firebase et repasser en stockage local hors ligne ? Vos modifications seront sauvegardées localement.")) {
      api.clearFirebaseConfig();
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Paramètres de Connexion</h1>
          <p className="page-subtitle">Configurez votre base de données centrale Firebase pour synchroniser les commandes et le stock avec votre équipe.</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Column Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Status panel */}
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database style={{ color: isConnected ? 'var(--status-received)' : 'var(--status-draft)' }} />
              Statut du Stockage
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div 
                style={{ 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  background: isConnected ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                  border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div 
                  className="dot" 
                  style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: isConnected ? 'var(--status-received)' : 'var(--status-draft)',
                    boxShadow: `0 0 10px ${isConnected ? 'var(--status-received)' : 'var(--status-draft)'}`
                  }} 
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                    {isConnected ? 'Connecté à Firebase' : 'Mode Local Uniquement (Hors ligne)'}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {isConnected 
                      ? 'Toutes les données sont synchronisées en temps réel avec le cloud Firebase de votre équipe.' 
                      : 'Les données sont stockées dans le LocalStorage de votre navigateur. Idéal pour le prototypage solo.'}
                  </span>
                </div>
              </div>

              {isConnected ? (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Vous utilisez actuellement une base de données Firestore centralisée. Plusieurs membres de l'équipe FSAE peuvent modifier le catalogue et faire des demandes de pièces simultanément.
                  </p>
                  <button className="btn btn-outline-red" onClick={handleDisconnect} style={{ width: '100%', justifyContent: 'center' }}>
                    <LogOut style={{ width: '16px', height: '16px' }} /> Déconnecter Firebase
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldAlert style={{ color: 'var(--status-draft)', width: '18px', height: '18px' }} />
                    Activer la synchronisation d'équipe
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Pour synchroniser vos commandes avec vos collègues, créez un projet Firebase gratuit (Spark Plan), activez Firestore Database, et renseignez les informations d'identification dans le formulaire ci-contre.
                  </p>
                </div>
              )}
            </div>
          </div>


        </div>

        {/* Configuration Form */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key style={{ color: 'var(--status-ordered)' }} />
            Configuration des clés Firebase
          </h2>

          <form onSubmit={handleSaveConfig}>
            <div className="form-group">
              <label className="form-label">API Key *</label>
              <input 
                type="password" 
                className="input mono" 
                placeholder="AIzaSy..." 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Project ID *</label>
                <input 
                  type="text" 
                  className="input mono" 
                  placeholder="fsae-orders-12345" 
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">App ID *</label>
                <input 
                  type="text" 
                  className="input mono" 
                  placeholder="1:1234567890:web:abcdef..." 
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Auth Domain</label>
                <input 
                  type="text" 
                  className="input mono" 
                  placeholder="fsae-orders-12345.firebaseapp.com" 
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Storage Bucket</label>
                <input 
                  type="text" 
                  className="input mono" 
                  placeholder="fsae-orders-12345.appspot.com" 
                  value={storageBucket}
                  onChange={(e) => setStorageBucket(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Messaging Sender ID</label>
              <input 
                type="text" 
                className="input mono" 
                placeholder="1234567890" 
                value={messagingSenderId}
                onChange={(e) => setMessagingSenderId(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
              <RefreshCw style={{ width: '16px', height: '16px' }} /> Enregistrer et Recharger l'Application
            </button>

            {saveSuccess && (
              <div style={{ color: 'var(--status-received)', fontSize: '0.85rem', marginTop: '0.75rem', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                <Check style={{ width: '16px', height: '16px' }} /> Configuration enregistrée ! Rechargement...
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Settings;
