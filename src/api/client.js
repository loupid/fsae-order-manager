/**
 * FSAE Order Manager API Client
 * Centralized HTTP client communicating with Express REST Backend
 */

const API_BASE = '/api';

export function getStoredToken() {
  return localStorage.getItem('fsae_token') || '';
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('fsae_token', token);
  } else {
    localStorage.removeItem('fsae_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // If unauthenticated, notify and clear invalid token
    if (endpoint !== '/auth/login' && endpoint !== '/auth/register') {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent('fsae:auth_expired'));
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) errorMessage = data.error;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  // Handle blob responses (e.g. PDF downloads)
  if (options.responseType === 'blob') {
    return response.blob();
  }

  return response.json();
}

export const apiClient = {
  // Auth
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  register: (name, email, password, role) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role })
  }),
  getMe: () => request('/auth/me'),

  // Subsystems
  getSubsystems: () => request('/subsystems'),
  createSubsystem: (subsystem) => request('/subsystems', {
    method: 'POST',
    body: JSON.stringify(subsystem)
  }),

  // Part Requests
  getPartRequests: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return request(`/part-requests${qStr}`);
  },
  createPartRequest: (reqData) => request('/part-requests', {
    method: 'POST',
    body: JSON.stringify(reqData)
  }),
  updatePartRequest: (id, updates) => request(`/part-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  }),
  updatePartRequestStatus: (id, status) => request(`/part-requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  deletePartRequest: (id) => request(`/part-requests/${id}`, {
    method: 'DELETE'
  }),

  // Purchase Orders
  getPurchaseOrders: () => request('/purchase-orders'),
  createPurchaseOrder: (poData) => request('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(poData)
  }),
  updatePurchaseOrderStatus: (id, status) => request(`/purchase-orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  // Invoices
  getInvoicesByPo: (poId) => request(`/invoices/po/${poId}`),
  uploadInvoice: (poId, file, amount) => {
    const formData = new FormData();
    formData.append('file', file);
    if (amount !== undefined && amount !== null) {
      formData.append('amount', amount);
    }
    return request(`/invoices/po/${poId}`, {
      method: 'POST',
      body: formData
    });
  },
  downloadInvoiceBlob: (invoiceId) => request(`/invoices/${invoiceId}/download`, {
    responseType: 'blob'
  }),
  deleteInvoice: (invoiceId) => request(`/invoices/${invoiceId}`, {
    method: 'DELETE'
  }),

  // Vendor Parsers
  parseUrl: (url) => request('/parsers/parse-url', {
    method: 'POST',
    body: JSON.stringify({ url })
  })
};
