import { request, requestMultipart } from './client';

const q = (params: Record<string, string | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) s.set(k, v);
  });
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  login: (email: string, password: string) =>
    request<{ user: any; access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, client: 'mobile' }),
    }),
  logout: (refresh_token?: string | null) =>
    request('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token }) }),
  me: () => request('/auth/me'),
  publicBranding: () => request('/public/branding'),
  sessionBranding: () => request('/settings/branding'),
  profile: () => request('/settings/profile'),
  agency: () => request('/settings/agency'),

  dashboard: () => request('/dashboard'),
  inbox: () => request('/notifications/inbox'),
  markInboxSeen: () => request('/notifications/inbox/seen', { method: 'POST' }),

  getBookings: (params?: { status?: string; season_id?: string; search?: string }) =>
    request(`/bookings${q(params || {})}`),
  getBooking: (id: string) => request(`/bookings/${id}`),
  createBooking: (data: any) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: any) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  confirmBooking: (id: string) => request(`/bookings/${id}/confirm`, { method: 'POST' }),
  addInvoiceItem: (bookingId: string, data: any) =>
    request(`/bookings/${bookingId}/invoice-items`, { method: 'POST', body: JSON.stringify(data) }),

  getClients: (search?: string) => request(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getClient: (id: string) => request(`/clients/${id}`),
  createClient: (data: any) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: any) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getPilgrims: (params?: { clientId?: string; bookingId?: string; seasonId?: string }) =>
    request(`/pilgrims${q({
      client_id: params?.clientId,
      booking_id: params?.bookingId,
      season_id: params?.seasonId,
    })}`),
  getPilgrim: (id: string) => request(`/pilgrims/${id}`),
  updatePilgrim: (id: string, data: any) => request(`/pilgrims/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getSeasons: () => request('/seasons'),
  getFlights: (seasonId?: string) => request(`/flights${seasonId ? `?season_id=${seasonId}` : ''}`),
  getAccommodations: (seasonId?: string) =>
    request(`/accommodations${seasonId ? `?season_id=${seasonId}` : ''}`),
  getHotelInventory: (params?: { season_id?: string; accommodation_id?: string }) =>
    request(`/hotel-inventory${q(params || {})}`),
  getAvailableSeats: (params?: { season_id?: string; flight_id?: string }) =>
    request(`/flight-inventory/available${q(params || {})}`),
  getFlightInventory: (params?: { season_id?: string; flight_id?: string }) =>
    request(`/flight-inventory${q(params || {})}`),

  getServices: () => request('/services?active_only=true'),
  createPayment: (bookingId: string, data: any) =>
    request(`/payments/booking/${bookingId}`, { method: 'POST', body: JSON.stringify(data) }),
  getPayments: (bookingId: string) => request(`/payments/booking/${bookingId}`),

  createLock: (data: any) => request('/booking-locks', { method: 'POST', body: JSON.stringify(data) }),
  releaseLocks: (sessionId: string) => request(`/booking-locks/${sessionId}`, { method: 'DELETE' }),
  extendLocks: (sessionId: string) => request(`/booking-locks/extend/${sessionId}`, { method: 'PUT' }),
  getLocks: (params?: Record<string, string | undefined>) => request(`/booking-locks${q(params || {})}`),
  lockAvailability: (params: Record<string, string>) => request(`/booking-locks/availability${q(params)}`),

  getReports: (params?: { season_id?: string; date_from?: string; date_to?: string }) =>
    request(`/reports${q(params || {})}`),
  getFinancialStatus: (params?: { season_id?: string; date_from?: string; date_to?: string }) =>
    request(`/reports/financial-status${q(params || {})}`),
  getHandovers: () => request('/handovers'),

  uploadPilgrimFile: (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    return requestMultipart('/upload/pilgrims', form);
  },
};
