/**
 * Asynchronous & Resilient Discord Webhook Service
 */

/**
 * Dispatches a payload to Discord Webhook. Non-blocking with 5s timeout.
 * @param {object} payload
 * @param {string} [customUrl]
 * @returns {Promise<{ success: boolean, skipped?: boolean, status?: number, error?: string, reason?: string }>}
 */
export async function sendDiscordAlert(payload, customUrl) {
  const webhookUrl = customUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return { skipped: true, reason: 'No webhook URL configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[DISCORD] Webhook returned HTTP ${response.status}: ${response.statusText}`);
      return { success: false, status: response.status };
    }

    return { success: true, status: response.status };
  } catch (err) {
    console.warn('[DISCORD] Webhook dispatch caught exception (non-blocking):', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends Rich Embed alert when a new Purchase Order is created.
 * @param {object} purchaseOrder
 * @param {Array} [items]
 * @param {object} [purchaserUser]
 * @param {string} [customUrl]
 */
export async function notifyPurchaseOrderCreated(purchaseOrder, items = [], purchaserUser = {}, customUrl) {
  // Determine highest urgency
  let maxUrgency = 'NORMAL';
  if (items.some(i => i.urgency_level === 'CRITICAL')) maxUrgency = 'CRITICAL';
  else if (items.some(i => i.urgency_level === 'URGENT')) maxUrgency = 'URGENT';

  // Embed color mapping
  const colorMap = {
    CRITICAL: 0xE74C3C, // Red
    URGENT: 0xE67E22,   // Orange
    NORMAL: 0x2ECC71    // Green
  };

  const urgencyLabelMap = {
    CRITICAL: '🚨 CRITIQUE',
    URGENT: '⚠️ URGENT',
    NORMAL: 'ℹ️ NORMAL'
  };

  // Aggregate subsystems
  const subCounts = {};
  for (const item of items) {
    const sub = item.subsystem_code || item.subsystem_name || 'Autre';
    subCounts[sub] = (subCounts[sub] || 0) + 1;
  }
  const subString = Object.entries(subCounts).map(([code, cnt]) => `${code} (${cnt})`).join(', ') || 'N/A';

  // Item preview list (up to 5 items)
  const itemPreview = items.slice(0, 5).map(i => `• [${i.sku || i.mpn || 'SKU'}] ${i.description} (x${i.quantity})`).join('\n') +
    (items.length > 5 ? `\n... et ${items.length - 5} autre(s) article(s)` : '');

  const payload = {
    username: 'Formule SAE UQTR Logistics Bot',
    embeds: [
      {
        title: `📦 Nouvelle Commande Fournisseur: ${purchaseOrder.po_number}`,
        color: colorMap[maxUrgency] || 0x059669,
        fields: [
          { name: 'PO #', value: purchaseOrder.po_number, inline: true },
          { name: 'Fournisseur', value: purchaseOrder.supplier, inline: true },
          { name: 'Acheteur', value: `${purchaserUser.name || 'Acheteur'} (${purchaserUser.role || 'Purchaser'})`, inline: true },
          { name: 'Urgence Max', value: urgencyLabelMap[maxUrgency] || maxUrgency, inline: true },
          { name: 'Montant Total Est.', value: `$${Number(purchaseOrder.total_cost || 0).toFixed(2)} CAD`, inline: true },
          { name: 'Statut', value: purchaseOrder.status || 'PENDING', inline: true },
          { name: 'Sous-systèmes Impactés', value: subString, inline: false },
          { name: `Articles (${items.length})`, value: itemPreview || 'Aucun article listé', inline: false }
        ],
        footer: { text: 'Formule SAE UQTR • Monoplace Électrique' },
        timestamp: new Date().toISOString()
      }
    ]
  };

  return sendDiscordAlert(payload, customUrl);
}

/**
 * Sends Rich Embed alert when parts arrive at the workshop.
 * @param {object} purchaseOrder
 * @param {Array} [receivedItems]
 * @param {string} [customUrl]
 */
export async function notifyPartsReceived(purchaseOrder, receivedItems = [], customUrl) {
  const itemSummary = receivedItems.map(i => `• [${i.subsystem_code || 'GEN'}] ${i.description} (x${i.quantity}) - SKU: ${i.sku}`).join('\n');

  const payload = {
    username: 'Formule SAE UQTR Logistics Bot',
    embeds: [
      {
        title: `🏁 Pièces Reçues à l'Atelier UQTR: ${purchaseOrder.po_number}`,
        color: 0x9B59B6, // Purple
        description: `Les pièces commandées chez **${purchaseOrder.supplier}** sont arrivées à l'atelier et prêtes pour l'équipe!`,
        fields: [
          { name: 'Fournisseur', value: purchaseOrder.supplier, inline: true },
          { name: 'Statut PO', value: purchaseOrder.status, inline: true },
          { name: 'Articles Disponibles', value: itemSummary || 'Articles marqués reçus', inline: false }
        ],
        footer: { text: 'Formule SAE UQTR • Monoplace Électrique' },
        timestamp: new Date().toISOString()
      }
    ]
  };

  return sendDiscordAlert(payload, customUrl);
}
