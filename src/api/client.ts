// Talks to the real Sufra KDS backend (sufra-kds-backend). Handles the two
// auth identities from FS Section 8: an Admin bearer token, or a persistent
// device credential — never both, and the backend rejects anything without
// one or the other on protected routes.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Live mode: this build was given a server address (the Android app's build
 * sets VITE_API_URL). A live build NEVER falls back to demo data, so a kitchen
 * screen can never show or bump fake orders. Builds without it (the web demo)
 * keep running on demo data exactly as approved.
 */
export const BACKEND_CONFIGURED = !!import.meta.env.VITE_API_URL;

/** The server's public health check (no login needed). */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(API_BASE_URL.replace(/\/api$/, '') + '/health');
    return res.ok;
  } catch {
    return false;
  }
}

const ADMIN_TOKEN_KEY = 'sufra_admin_token';
const DEVICE_CREDENTIAL_KEY = 'sufra_device_credential';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getDeviceCredential(): string | null {
  return localStorage.getItem(DEVICE_CREDENTIAL_KEY);
}
export function setDeviceCredential(credential: string | null) {
  if (credential) localStorage.setItem(DEVICE_CREDENTIAL_KEY, credential);
  else localStorage.removeItem(DEVICE_CREDENTIAL_KEY);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  // Force which identity to send, when a request must be one or the other
  // regardless of what's currently stored (e.g. admin login itself sends
  // neither). Defaults to "whichever we have" — Admin token takes priority
  // if both somehow exist, mirroring requireAdminOrDevice on the backend.
  auth?: 'admin' | 'device' | 'none';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const authMode = options.auth ?? 'auto';
  if (authMode !== 'none') {
    const adminToken = getAdminToken();
    const deviceCredential = getDeviceCredential();
    if ((authMode === 'admin' || authMode === 'auto') && adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    } else if ((authMode === 'device' || authMode === 'auto') && deviceCredential) {
      headers['X-Device-Credential'] = deviceCredential;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

export type SquareStatus = {
  configured: boolean; configProblem?: string | null; connected: boolean; environment?: string;
  businessName?: string; locationId?: string | null; locationName?: string | null;
  locations?: { id: string; name: string }[]; expiresAt?: string;
};

type ServerOrderAction = { order: any; item?: any; pendingActionId?: string; undoSeconds?: number };

export const api = {
  // --- Auth ---
  adminLogin: (email: string, password: string) =>
    request<{ token: string; admin: { id: string; name: string; email: string } }>('/auth/admin/login', {
      method: 'POST',
      body: { email, password },
      auth: 'none',
    }),
  /** Admin pairs this screen to a station, or as the Customer Display (role customer_display). */
  pairDevice: (body: { stationId?: string; deviceLabel: string; role?: 'station' | 'customer_display' }) =>
    request<{ deviceId: string; credential: string; role: 'station' | 'customer_display'; stationId: string | null; stationName: string }>(
      '/auth/devices/pair',
      { method: 'POST', body, auth: 'admin' }
    ),
  unpairDevice: (deviceId: string) =>
    request<{ ok: true }>(`/auth/devices/${deviceId}/unpair`, { method: 'POST', auth: 'admin' }),
  listDevices: () => request<{ devices: any[] }>('/auth/devices', { auth: 'admin' }),
  whoAmI: () =>
    request<{
      deviceId: string; venueId: string; role: 'station' | 'customer_display';
      stationId: string; stationName: string; labelPrintingEnabled: boolean; isDocketHandlingStation: boolean; isPackingStation: boolean;
    }>('/auth/devices/me', { auth: 'device' }),

  // --- Stations (screens and Admin can read; Admin manages) ---
  getStations: () => request<{ stations: any[] }>('/stations'),
  createStation: (body: any) => request<{ station: any }>('/stations', { method: 'POST', body, auth: 'admin' }),
  updateStation: (id: string, body: any) => request<{ station: any }>(`/stations/${id}`, { method: 'PATCH', body, auth: 'admin' }),
  deleteStation: (id: string) => request<{ ok: true }>(`/stations/${id}`, { method: 'DELETE', auth: 'admin' }),

  // --- Printers ---
  getPrinters: () => request<{ printers: any[] }>('/printers'),
  createPrinter: (body: any) => request<{ printer: any }>('/printers', { method: 'POST', body, auth: 'admin' }),
  updatePrinter: (id: string, body: { name?: string; ipAddress?: string; port?: number; paperWidthMm?: 58 | 80; commandMode?: 'starprnt' | 'stargraphic' }) =>
    request<{ printer: any }>(`/printers/${id}`, { method: 'PATCH', body, auth: 'admin' }),
  deletePrinter: (id: string) => request<{ ok: true }>(`/printers/${id}`, { method: 'DELETE', auth: 'admin' }),

  // --- Config ---
  getConfig: () => request<{ config: any }>('/config'),
  updateConfig: (body: any) => request<{ config: any }>('/config', { method: 'PATCH', body, auth: 'admin' }),

  // --- Menu (a station marks its own items out of stock; Packing & Pass and Admin any) ---
  getMenu: () => request<{ items: any[] }>('/menu'),
  setStock: (itemId: string, inStock: boolean) =>
    request<{ item: any }>(`/menu/${itemId}/stock`, { method: 'PATCH', body: { inStock } }),

  // --- Orders ---
  getOrders: (params?: { filter?: string; q?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ orders: any[] }>(`/orders${qs ? `?${qs}` : ''}`, { auth: 'device' });
  },
  getOrder: (orderId: string) => request<{ order: any }>(`/orders/${orderId}`),
  prepareItem: (orderId: string, itemId: string) =>
    request<ServerOrderAction>(`/orders/${orderId}/items/${itemId}/prepare`, { method: 'POST', auth: 'device' }),
  undoPrepare: (orderId: string, itemId: string) =>
    request<ServerOrderAction>(`/orders/${orderId}/items/${itemId}/undo-prepare`, { method: 'POST', auth: 'device' }),
  packItem: (orderId: string, itemId: string) =>
    request<ServerOrderAction>(`/orders/${orderId}/items/${itemId}/pack`, { method: 'POST', auth: 'device' }),
  undoPack: (orderId: string, itemId: string) =>
    request<ServerOrderAction>(`/orders/${orderId}/items/${itemId}/undo-pack`, { method: 'POST', auth: 'device' }),
  recallItem: (orderId: string, itemId: string) =>
    request<ServerOrderAction>(`/orders/${orderId}/items/${itemId}/recall`, { method: 'POST', auth: 'device' }),
  recallEntireOrder: (orderId: string) =>
    request<{ order: any }>(`/orders/${orderId}/recall-entire-order`, { method: 'POST', auth: 'device' }),
  reprintLabel: (orderId: string, itemId: string, unit?: number) =>
    request<{ ok: true; printJobId: string }>(`/orders/${orderId}/items/${itemId}/reprint-label`, { method: 'POST', body: { unit }, auth: 'device' }),
  reprintTicket: (orderId: string) =>
    request<{ ok: true; printJobId: string }>(`/orders/${orderId}/reprint-ticket`, { method: 'POST', auth: 'device' }),
  /** Admin-only test orders, refused unless the server allows them (ALLOW_TEST_ORDERS). */
  createTestOrder: (body: { customerName: string; tableNumber?: string; comboName?: string; notes?: string; items: { name: string; category: string; quantity?: number; modifiers?: string[] }[] }) =>
    request<{ order: any }>('/orders/test', { method: 'POST', body, auth: 'admin' }),

  // --- Print queue (the Packing & Pass app) ---
  listPrintJobs: (statuses?: string[]) =>
    request<{ jobs: any[] }>(`/print-jobs${statuses && statuses.length ? `?status=${statuses.join(',')}` : ''}`),
  claimPrintJobs: (limit = 10) =>
    request<{ reclaimed: any[]; jobs: any[] }>('/print-jobs/claim', { method: 'POST', body: { limit }, auth: 'device' }),
  reportPrintResult: (jobId: string, outcome: 'printed' | 'failed' | 'uncertain', error?: string) =>
    request<{ job: any }>(`/print-jobs/${jobId}/result`, { method: 'POST', body: { outcome, error }, auth: 'device' }),
  resolvePrintJob: (jobId: string, action: 'reprint' | 'mark_printed') =>
    request<{ job: any }>(`/print-jobs/${jobId}/resolve`, { method: 'POST', body: { action }, auth: 'device' }),

  // --- Item routing (Admin): paste section lists ---
  menuRoutingPreview: (text: string) =>
    request<{ sections: { name: string; stationId: string | null; stationName: string | null; matched: string[]; unknownItems: string[] }[] }>(
      '/menu/routing/preview', { method: 'POST', body: { text }, auth: 'admin' }),
  menuRoutingApply: (text: string, createMissingStations: boolean) =>
    request<{ changed: number; createdStations: string[]; sections: { name: string; stationName: string; items: number; unknownItems: string[] }[]; skippedSections: string[] }>(
      '/menu/routing/apply', { method: 'POST', body: { text, createMissingStations }, auth: 'admin' }),

  clearActiveOrders: () => request<{ cleared: number; printsCancelled: number }>('/orders/clear-active', { method: 'POST', auth: 'admin' }),

  // --- Square (Admin) ---
  squareStatus: () => request<SquareStatus>('/square/status', { auth: 'admin' }),
  squareConnectLink: () => request<{ url: string; expiresInMinutes: number }>('/square/oauth/ticket', { method: 'POST', auth: 'admin' }),
  squareSetLocation: (locationId: string) => request<{ ok: true }>('/square/location', { method: 'POST', body: { locationId }, auth: 'admin' }),
  squareImportMenu: () => request<{ imported: number; categories: string[]; newCategories: number }>('/square/import-menu', { method: 'POST', auth: 'admin' }),
  squareDisconnect: () => request<{ ok: true }>('/square/disconnect', { method: 'POST', auth: 'admin' }),

  // --- Audit ---
  getAuditLogs: (q?: string) => request<{ logs: any[] }>(`/audit${q ? `?q=${encodeURIComponent(q)}` : ''}`, { auth: 'admin' }),
};
