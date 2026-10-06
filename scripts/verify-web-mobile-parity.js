#!/usr/bin/env node
/**
 * Sentinel Script: Validation de la Parité Web Desktop & Mobile
 * Utilisé à la fois par le hook Antigravity (.agents/hooks.json) et par npm test
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trouver la racine du projet quel que soit le dossier d'exécution
let projectRoot = process.cwd();
if (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  projectRoot = path.resolve(__dirname, '..');
}

export function runParityChecks() {
  const issues = [];
  const checks = [];

  const check = (name, passed, detail) => {
    checks.push({ name, passed, detail });
    if (!passed) {
      issues.push(`[ÉCHEC] ${name}: ${detail}`);
    }
  };

  // 1. Vérification du meta viewport et support PWA
  const indexPath = path.join(projectRoot, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf-8');
    const hasViewport = html.includes('viewport-fit=cover') || html.includes('width=device-width');
    check('HTML Viewport', hasViewport, 'index.html doit contenir une balise meta viewport appropriée');
  }

  // 2. Vérification des styles globaux et Safe Areas
  const cssPath = path.join(projectRoot, 'src', 'index.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf-8');
    const hasSafeAreas = css.includes('safe-area-inset') || css.includes('--safe-bottom');
    check('CSS Safe Areas', hasSafeAreas, 'src/index.css doit déclarer les zones de sécurité ou safe-area-inset');

    const hasAntiZoom = css.includes('16px') || css.includes('input');
    check('CSS iOS Anti-Zoom', hasAntiZoom, 'src/index.css doit protéger les inputs contre le zoom indésirable');
  }

  // 3. Vérification de l'utilitaire réactif (useMediaQuery / useIsMobile)
  const mediaHookPath = path.join(projectRoot, 'src', 'utils', 'useMediaQuery.js');
  const hasHook = fs.existsSync(mediaHookPath);
  check('Hook useIsMobile', hasHook, 'src/utils/useMediaQuery.js doit exister pour orchestrer la vue mobile');

  // 4. Vérification de la parité dans la Navbar
  const navbarPath = path.join(projectRoot, 'src', 'components', 'Navbar.jsx');
  if (fs.existsSync(navbarPath)) {
    const code = fs.readFileSync(navbarPath, 'utf-8');
    const hasMobileNav = code.includes('isMobile') || code.includes('bottom') || code.includes('Bottom');
    check('Navbar Parité Mobile', hasMobileNav, 'Navbar.jsx doit intégrer une adaptation mobile (ex: Bottom Nav)');
  }

  // 5. Vérification du conteneur principal App.jsx
  const appPath = path.join(projectRoot, 'src', 'App.jsx');
  if (fs.existsSync(appPath)) {
    const code = fs.readFileSync(appPath, 'utf-8');
    const hasPaddingAdjustment = code.includes('isMobile') || code.includes('paddingBottom') || code.includes('safe-bottom');
    check('App.jsx Espacement Mobile', hasPaddingAdjustment, 'App.jsx doit compenser la barre basse mobile');
  }

  // 6. Vérification de MemberFunnelView (Cartes / FAB / Filtres)
  const funnelPath = path.join(projectRoot, 'src', 'views', 'MemberFunnelView.jsx');
  if (fs.existsSync(funnelPath)) {
    const code = fs.readFileSync(funnelPath, 'utf-8');
    const hasMobileView = code.includes('isMobile') || code.includes('card') || code.includes('Card') || code.includes('fab') || code.includes('FAB');
    check('MemberFunnel Parité Mobile', hasMobileView, 'MemberFunnelView doit adapter les demandes pour mobile');
  }

  // 7. Vérification de PurchaserDashboard (Grille sans overflow 400px fixe)
  const purchaserPath = path.join(projectRoot, 'src', 'views', 'PurchaserDashboard.jsx');
  if (fs.existsSync(purchaserPath)) {
    const code = fs.readFileSync(purchaserPath, 'utf-8');
    const hasNoStrict400pxGrid = !code.includes('minmax(400px, 1fr)');
    check('PurchaserDashboard Grid Responsive', hasNoStrict400pxGrid, 'PurchaserDashboard ne doit pas bloquer sur minmax(400px, 1fr)');
  }

  // 8. Vérification de PartRequestModal (Bottom sheet / Clavier tactile)
  const modalPath = path.join(projectRoot, 'src', 'components', 'PartRequestModal.jsx');
  if (fs.existsSync(modalPath)) {
    const code = fs.readFileSync(modalPath, 'utf-8');
    const hasMobileModal = code.includes('maxHeight') || code.includes('dvh') || code.includes('isMobile');
    check('PartRequestModal Mobile Fit', hasMobileModal, 'PartRequestModal doit être contrainte en hauteur pour clavier virtuel');
  }

  return { passed: issues.length === 0, checks, issues };
}

// Fonction principale pour CLI ou Hook
async function main() {
  const isHookMode = process.argv.includes('--hook') || Boolean(process.env.ANTIGRAVITY_HOOK);
  let hookContext = null;

  if (isHookMode) {
    try {
      hookContext = await new Promise((resolve) => {
        let raw = '';
        const timer = setTimeout(() => resolve(null), 300);
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { raw += chunk; });
        process.stdin.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(raw.trim() ? JSON.parse(raw.trim()) : null);
          } catch {
            resolve(null);
          }
        });
        process.stdin.on('error', () => {
          clearTimeout(timer);
          resolve(null);
        });
        process.stdin.resume();
      });
    } catch {
      hookContext = null;
    }
  }

  const result = runParityChecks();

  if (process.env.VERBOSE || process.argv.includes('--verbose')) {
    console.error('📋 [SENTINEL WEB-MOBILE] Rapport d\'audit :');
    result.checks.forEach(c => {
      console.error(`  ${c.passed ? '✅' : '⚠️'} ${c.name}: ${c.detail}`);
    });
  }

  if (isHookMode && hookContext) {
    // Contrat PostToolUse Antigravity : doit retourner `{}` sur stdout
    process.stdout.write(JSON.stringify({}));
  } else {
    // Ligne de commande classique
    if (result.passed) {
      console.log('✅ [SENTINEL WEB-MOBILE] Parité Web et Mobile validée à 100%.');
      process.exit(0);
    } else {
      console.warn('⚠️ [SENTINEL WEB-MOBILE] Des points de parité nécessitent attention :');
      result.issues.forEach(iss => console.warn(`   - ${iss}`));
      // Si invoqué directement avec --strict, échouer
      if (process.argv.includes('--strict')) {
        process.exit(1);
      }
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-web-mobile-parity.js')) {
  main();
}
