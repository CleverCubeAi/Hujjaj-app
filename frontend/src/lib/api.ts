const API_URL = import.meta.env.VITE_API_URL || '/api';

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function notifyUnauthorized() {
  window.dispatchEvent(new Event('hujjaj:unauthorized'));
}

async function request(endpoint: string, options: RequestInit = {}, retried = false) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    } as Record<string, string>,
  });

  if (response.status === 401 && !retried && !endpoint.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) return request(endpoint, options, true);
    notifyUnauthorized();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

async function requestMultipart(endpoint: string, formData: FormData, retried = false) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (response.status === 401 && !retried) {
    const ok = await tryRefresh();
    if (ok) return requestMultipart(endpoint, formData, true);
    notifyUnauthorized();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Auth (public routes - don't need auth header)
  login: (email: string, password: string) => 
    fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  register: (data: any) =>
    fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Seasons
  getSeasons: () => request('/seasons'),
  getSeasonById: (id: string) => request(`/seasons/${id}`),
  createSeason: (data: any) => request('/seasons', { method: 'POST', body: JSON.stringify(data) }),
  updateSeason: (id: string, data: any) => request(`/seasons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSeason: (id: string) => request(`/seasons/${id}`, { method: 'DELETE' }),

  // Flights
  getFlights: (seasonId?: string) => request(`/flights${seasonId ? `?season_id=${seasonId}` : ''}`),
  getFlightById: (id: string) => request(`/flights/${id}`),
  createFlight: (data: any) => request('/flights', { method: 'POST', body: JSON.stringify(data) }),
  updateFlight: (id: string, data: any) => request(`/flights/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFlight: (id: string) => request(`/flights/${id}`, { method: 'DELETE' }),

  // Accommodations
  getAccommodations: (seasonId?: string) => request(`/accommodations${seasonId ? `?season_id=${seasonId}` : ''}`),
  getAccommodationById: (id: string) => request(`/accommodations/${id}`),
  getAccommodationCapacity: (id: string) => request(`/accommodations/${id}/capacity`),
  createAccommodation: (data: any) => request('/accommodations', { method: 'POST', body: JSON.stringify(data) }),
  updateAccommodation: (id: string, data: any) => request(`/accommodations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccommodation: (id: string) => request(`/accommodations/${id}`, { method: 'DELETE' }),
  
  // Room Types
  createRoomType: (data: any) => request('/accommodations/room-types', { method: 'POST', body: JSON.stringify(data) }),
  updateRoomType: (id: string, data: any) => request(`/accommodations/room-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoomType: (id: string) => request(`/accommodations/room-types/${id}`, { method: 'DELETE' }),

  // Pilgrims
  getPilgrims: (params?: { seasonId?: string; flightId?: string; bookingId?: string; clientId?: string }) => {
    const query = new URLSearchParams();
    if (params?.seasonId) query.set('season_id', params.seasonId);
    if (params?.flightId) query.set('flight_id', params.flightId);
    if (params?.bookingId) query.set('booking_id', params.bookingId);
    if (params?.clientId) query.set('client_id', params.clientId);
    return request(`/pilgrims${query.toString() ? `?${query}` : ''}`);
  },
  getPilgrimById: (id: string) => request(`/pilgrims/${id}`),
  createPilgrim: (data: any) => request('/pilgrims', { method: 'POST', body: JSON.stringify(data) }),
  updatePilgrim: (id: string, data: any) => request(`/pilgrims/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePilgrim: (id: string) => request(`/pilgrims/${id}`, { method: 'DELETE' }),
  updatePayment: (id: string, data: any) => request(`/pilgrims/${id}/payment`, { method: 'PUT', body: JSON.stringify(data) }),
  importPilgrims: (pilgrims: any[]) => request('/pilgrims/import', { method: 'POST', body: JSON.stringify({ pilgrims }) }),

  // Expenses
  getExpenses: (params?: { seasonId?: string; category?: string; expense_type?: string }) => {
    const query = new URLSearchParams();
    if (params?.seasonId) query.set('season_id', params.seasonId);
    if (params?.category) query.set('category', params.category);
    if (params?.expense_type) query.set('expense_type', params.expense_type);
    return request(`/expenses${query.toString() ? `?${query}` : ''}`);
  },
  createExpense: (data: any) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: any) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => request(`/expenses/${id}`, { method: 'DELETE' }),
  getExpenseSummary: (seasonId?: string) => request(`/expenses/summary${seasonId ? `?season_id=${seasonId}` : ''}`),

  // Hotel Inventory
  getHotelInventory: (params?: { season_id?: string; accommodation_id?: string; room_type_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.season_id) query.set('season_id', params.season_id);
    if (params?.accommodation_id) query.set('accommodation_id', params.accommodation_id);
    if (params?.room_type_id) query.set('room_type_id', params.room_type_id);
    return request(`/hotel-inventory${query.toString() ? `?${query}` : ''}`);
  },
  getAvailableRooms: (params: { season_id: string; accommodation_id?: string; room_type_id?: string; check_in_date?: string; check_out_date?: string }) => {
    const query = new URLSearchParams();
    query.set('season_id', params.season_id);
    if (params.accommodation_id) query.set('accommodation_id', params.accommodation_id);
    if (params.room_type_id) query.set('room_type_id', params.room_type_id);
    if (params.check_in_date) query.set('check_in_date', params.check_in_date);
    if (params.check_out_date) query.set('check_out_date', params.check_out_date);
    return request(`/hotel-inventory/available?${query}`);
  },
  getBedMap: (inventoryId: string) => request(`/hotel-inventory/${inventoryId}/bed-map`),
  createHotelInventory: (data: any) => request('/hotel-inventory', { method: 'POST', body: JSON.stringify(data) }),
  updateHotelInventory: (id: string, data: any) => request(`/hotel-inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHotelInventory: (id: string) => request(`/hotel-inventory/${id}`, { method: 'DELETE' }),

  // Flight Inventory
  getFlightInventory: (params?: { season_id?: string; flight_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.season_id) query.set('season_id', params.season_id);
    if (params?.flight_id) query.set('flight_id', params.flight_id);
    return request(`/flight-inventory${query.toString() ? `?${query}` : ''}`);
  },
  getAvailableSeats: (params: { season_id: string; flight_id?: string }) => {
    const query = new URLSearchParams();
    query.set('season_id', params.season_id);
    if (params.flight_id) query.set('flight_id', params.flight_id);
    return request(`/flight-inventory/available?${query}`);
  },
  getSeatMap: (inventoryId: string) => request(`/flight-inventory/${inventoryId}/seat-map`),
  createFlightInventory: (data: any) => request('/flight-inventory', { method: 'POST', body: JSON.stringify(data) }),
  updateFlightInventory: (id: string, data: any) => request(`/flight-inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFlightInventory: (id: string) => request(`/flight-inventory/${id}`, { method: 'DELETE' }),

  // Expense Categories
  getExpenseCategories: () => request('/expense-categories'),
  createExpenseCategory: (data: any) => request('/expense-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateExpenseCategory: (id: string, data: any) => request(`/expense-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpenseCategory: (id: string) => request(`/expense-categories/${id}`, { method: 'DELETE' }),

  // ============================================
  // NEW: Clients
  // ============================================
  getClients: (search?: string) => request(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getClientById: (id: string) => request(`/clients/${id}`),
  createClient: (data: any) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: any) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: string) => request(`/clients/${id}`, { method: 'DELETE' }),

  // ============================================
  // NEW: Bookings
  // ============================================
  getBookings: (params?: { status?: string; season_id?: string; search?: string; show_deleted?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.season_id) query.set('season_id', params.season_id);
    if (params?.search) query.set('search', params.search);
    if (params?.show_deleted) query.set('show_deleted', params.show_deleted);
    return request(`/bookings${query.toString() ? `?${query}` : ''}`);
  },
  getBookingById: (id: string) => request(`/bookings/${id}`),
  getBookingHotels: (id: string) => request(`/bookings/${id}/hotels`),
  createBooking: (data: any) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: any) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  confirmBooking: (id: string) => request(`/bookings/${id}/confirm`, { method: 'POST' }),
  cancelBooking: (id: string) => request(`/bookings/${id}/cancel`, { method: 'POST' }),
  extendBookingHold: (id: string, extendHours?: number) => 
    request(`/bookings/${id}/extend-hold`, { method: 'POST', body: JSON.stringify({ extend_hours: extendHours || 24 }) }),
  getBookingHoldStatus: (id: string) => request(`/bookings/${id}/hold-status`),
  softDeleteBooking: (id: string, data: { deletion_password: string; reason?: string }) => 
    request(`/bookings/${id}`, { method: 'DELETE', body: JSON.stringify(data) }),
  permanentDeleteBooking: (id: string, data: { deletion_password: string }) => 
    request(`/bookings/${id}/permanent-delete`, { method: 'POST', body: JSON.stringify(data) }),
  
  // Booking pilgrims
  addPilgrimToBooking: (bookingId: string, data: any) => request(`/bookings/${bookingId}/pilgrims`, { method: 'POST', body: JSON.stringify(data) }),
  removePilgrimFromBooking: (bookingId: string, pilgrimId: string) => request(`/bookings/${bookingId}/pilgrims/${pilgrimId}`, { method: 'DELETE' }),
  
  // Invoice
  getBookingInvoice: (id: string) => request(`/bookings/${id}/invoice`),
  
  downloadInvoicePDF: async (id: string) => {
    const url = `${API_URL}/bookings/${id}/invoice/pdf`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'PDF generation failed' }));
      throw new Error(error.error || 'PDF generation failed');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `invoice_${id}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Get blob and trigger download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
  addInvoiceItem: (bookingId: string, data: any) => request(`/bookings/${bookingId}/invoice-items`, { method: 'POST', body: JSON.stringify(data) }),
  deleteInvoiceItem: (bookingId: string, itemId: string) => request(`/bookings/${bookingId}/invoice-items/${itemId}`, { method: 'DELETE' }),

  // ============================================
  // NEW: Extra Services
  // ============================================
  getServices: (params?: { category?: string; active_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.active_only) query.set('active_only', 'true');
    return request(`/services${query.toString() ? `?${query}` : ''}`);
  },
  getServiceById: (id: string) => request(`/services/${id}`),
  createService: (data: any) => request('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: string, data: any) => request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteService: (id: string) => request(`/services/${id}`, { method: 'DELETE' }),
  getServiceCategories: () => request('/services/categories'),

  // ============================================
  // NEW: Payments
  // ============================================
  getBookingPayments: (bookingId: string) => request(`/payments/booking/${bookingId}`),
  createBookingPayment: (bookingId: string, data: any) => request(`/payments/booking/${bookingId}`, { method: 'POST', body: JSON.stringify(data) }),
  updatePaymentRecord: (id: string, data: any) => request(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePaymentRecord: (id: string) => request(`/payments/${id}`, { method: 'DELETE' }),
  getPaymentSummary: () => request('/payments/summary'),
  getPaymentMethods: () => request('/payments/methods'),

  // ============================================
  // NEW: Room Assignments
  // ============================================
  allocateRooms: (bookingId: string, rules?: any) => request(`/rooms/booking/${bookingId}/allocate`, { method: 'POST', body: JSON.stringify({ rules }) }),
  getBookingRoomAssignments: (bookingId: string) => request(`/rooms/booking/${bookingId}`),
  createRoomAssignment: (data: any) => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoomAssignment: (id: string, data: any) => request(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoomAssignment: (id: string) => request(`/rooms/${id}`, { method: 'DELETE' }),
  getRoomAvailability: (accommodationId: string, params?: { season_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.season_id) query.set('season_id', params.season_id);
    return request(`/rooms/availability/${accommodationId}${query.toString() ? `?${query}` : ''}`);
  },

  // ============================================
  // Reports
  // ============================================
  getReports: (params?: string) => request(`/reports${params ? `?${params}` : ''}`),
  
  // Dashboard
  getDashboardStats: () => request('/dashboard'),

  // File Upload
  uploadFile: (folder: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestMultipart(`/upload/${folder}`, formData);
  },
  
  deleteFile: (folder: string, path: string) => 
    request(`/upload/${folder}`, { method: 'DELETE', body: JSON.stringify({ path }) }),

  exportReport: async (params: string) => {
    const url = `${API_URL}/reports/export${params ? `?${params}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'Export failed');
    }

    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'report';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Get the blob from response
    const blob = await response.blob();
    
    // Create download link
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
  getFinancialStatus: (params?: { season_id?: string; date_from?: string; date_to?: string; user_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.season_id) query.set('season_id', params.season_id);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    if (params?.user_id) query.set('user_id', params.user_id);
    return request(`/reports/financial-status${query.toString() ? `?${query}` : ''}`);
  },

  // ============================================
  // Settings
  // ============================================
  getAgency: () => request('/settings/agency'),
  updateAgency: (data: any) => request('/settings/agency', { method: 'PUT', body: JSON.stringify(data) }),
  getProfile: () => request('/settings/profile'),
  updateProfile: (data: any) => request('/settings/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data: any) => request('/settings/password', { method: 'PUT', body: JSON.stringify(data) }),
  getPreferences: () => request('/settings/preferences'),
  updatePreferences: (data: any) => request('/settings/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  
  // Security settings (deletion password)
  getDeletionPasswordStatus: () => request('/settings/deletion-password/status'),
  setDeletionPassword: (data: { password: string; current_password?: string }) => 
    request('/settings/deletion-password', { method: 'PUT', body: JSON.stringify(data) }),

  // ============================================
  // Branches
  // ============================================
  getBranches: (params?: { search?: string; active_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.active_only) query.set('active_only', 'true');
    return request(`/branches${query.toString() ? `?${query}` : ''}`);
  },
  getBranchById: (id: string) => request(`/branches/${id}`),
  getBranchStats: (id: string) => request(`/branches/${id}/stats`),
  getBranchUsers: (id: string) => request(`/branches/${id}/users`),
  createBranch: (data: {
    name: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    contact_person?: string;
    logo_url?: string;
    bank_name?: string;
    bank_account?: string;
    bank_iban?: string;
    is_headquarters?: boolean;
    settings?: Record<string, any>;
  }) => request('/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: string, data: any) => request(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBranch: (id: string) => request(`/branches/${id}`, { method: 'DELETE' }),

  // ============================================
  // Users/Team
  // ============================================
  getUsers: (params?: { search?: string; branch_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.branch_id) query.set('branch_id', params.branch_id);
    return request(`/users${query.toString() ? `?${query}` : ''}`);
  },
  getUserById: (id: string) => request(`/users/${id}`),
  createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
  updateUserRole: (id: string, role: string) => request(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  // ============================================
  // Notifications
  // ============================================
  getEmailSettings: () => request('/notifications/email'),
  updateEmailSettings: (data: any) => request('/notifications/email', { method: 'PUT', body: JSON.stringify(data) }),
  testEmail: (data: any) => request('/notifications/email/test', { method: 'POST', body: JSON.stringify(data) }),
  getSMSSettings: () => request('/notifications/sms'),
  updateSMSSettings: (data: any) => request('/notifications/sms', { method: 'PUT', body: JSON.stringify(data) }),
  testSMS: (data: any) => request('/notifications/sms/test', { method: 'POST', body: JSON.stringify(data) }),

  // ============================================
  // Financial Handovers
  // ============================================
  getHandovers: (params?: { 
    handover_type?: string; 
    status?: string; 
    season_id?: string; 
    date_from?: string; 
    date_to?: string;
    created_by?: string;
    recipient_user_id?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.handover_type) query.set('handover_type', params.handover_type);
    if (params?.status) query.set('status', params.status);
    if (params?.season_id) query.set('season_id', params.season_id);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    if (params?.created_by) query.set('created_by', params.created_by);
    if (params?.recipient_user_id) query.set('recipient_user_id', params.recipient_user_id);
    return request(`/handovers${query.toString() ? `?${query}` : ''}`);
  },
  getHandoverById: (id: string) => request(`/handovers/${id}`),
  getHandoverStats: (seasonId?: string) => request(`/handovers/stats${seasonId ? `?season_id=${seasonId}` : ''}`),
  createHandover: (data: {
    handover_type: 'sales_to_admin' | 'expense_reimbursement';
    amount: number;
    handover_date?: string;
    payment_method: 'wire' | 'check' | 'cash';
    payment_reference?: string;
    recipient_user_id: string;
    season_id?: string;
    notes?: string;
  }) => request('/handovers', { method: 'POST', body: JSON.stringify(data) }),
  updateHandoverStatus: (id: string, data: { status: string; notes?: string }) => 
    request(`/handovers/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelHandover: (id: string) => request(`/handovers/${id}`, { method: 'DELETE' }),

  // ============================================
  // Booking Locks (Pending Reservations)
  // ============================================
  createBookingLock: (data: {
    resource_type: 'bed' | 'flight_seat';
    accommodation_id?: string;
    room_type_id?: string;
    flight_id?: string;
    season_id: string;
    quantity: number;
    session_id: string;
  }) => request('/booking-locks', { method: 'POST', body: JSON.stringify(data) }),
  
  releaseBookingLock: (sessionId: string, resourceType?: string) => 
    request(`/booking-locks/${sessionId}${resourceType ? `/${resourceType}` : ''}`, { method: 'DELETE' }),
  
  releaseAllBookingLocks: (sessionId: string) => 
    request(`/booking-locks/${sessionId}`, { method: 'DELETE' }),
  
  extendBookingLocks: (sessionId: string) => 
    request(`/booking-locks/extend/${sessionId}`, { method: 'PUT' }),
  
  getActiveBookingLocks: (params?: {
    resource_type?: 'bed' | 'flight_seat';
    accommodation_id?: string;
    room_type_id?: string;
    flight_id?: string;
    season_id?: string;
    exclude_session_id?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.resource_type) query.set('resource_type', params.resource_type);
    if (params?.accommodation_id) query.set('accommodation_id', params.accommodation_id);
    if (params?.room_type_id) query.set('room_type_id', params.room_type_id);
    if (params?.flight_id) query.set('flight_id', params.flight_id);
    if (params?.season_id) query.set('season_id', params.season_id);
    if (params?.exclude_session_id) query.set('exclude_session_id', params.exclude_session_id);
    return request(`/booking-locks${query.toString() ? `?${query}` : ''}`);
  },
  
  getAvailabilityWithLocks: (params: {
    accommodation_id: string;
    room_type_id: string;
    season_id: string;
    quantity_needed: number;
    exclude_session_id?: string;
  }) => {
    const query = new URLSearchParams();
    query.set('accommodation_id', params.accommodation_id);
    query.set('room_type_id', params.room_type_id);
    query.set('season_id', params.season_id);
    query.set('quantity_needed', String(params.quantity_needed));
    if (params.exclude_session_id) query.set('exclude_session_id', params.exclude_session_id);
    return request(`/booking-locks/availability?${query}`);
  },

  // ============================================
  // Discount Management
  // ============================================
  
  // Discount Settings (Admin)
  getDiscountSettings: (params?: { active_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.active_only) query.set('active_only', 'true');
    return request(`/discounts${query.toString() ? `?${query}` : ''}`);
  },
  getDiscountSetting: (id: string) => request(`/discounts/${id}`),
  createDiscountSetting: (data: {
    name: string;
    name_ar?: string;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    max_discount_amount?: number;
    min_booking_amount?: number;
    is_default?: boolean;
    is_active?: boolean;
    sort_order?: number;
  }) => request('/discounts', { method: 'POST', body: JSON.stringify(data) }),
  updateDiscountSetting: (id: string, data: any) => 
    request(`/discounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDiscountSetting: (id: string) => 
    request(`/discounts/${id}`, { method: 'DELETE' }),
  
  // Available Discounts (for Booking)
  getAvailableDiscounts: () => request('/discounts/available'),
  calculateDiscount: (discountId: string, bookingTotal: number) => 
    request('/discounts/calculate', { 
      method: 'POST', 
      body: JSON.stringify({ discount_id: discountId, booking_total: bookingTotal }) 
    }),
  
  // User Discount Permissions (Admin)
  getUserDiscountPermissions: (params?: { user_id?: string; discount_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.user_id) query.set('user_id', params.user_id);
    if (params?.discount_id) query.set('discount_id', params.discount_id);
    return request(`/discounts/user-permissions${query.toString() ? `?${query}` : ''}`);
  },
  getUserPermissions: (userId: string) => 
    request(`/discounts/user-permissions/user/${userId}`),
  createUserDiscountPermission: (data: {
    user_id: string;
    discount_setting_id: string;
    usage_limit?: number;
    reset_period?: 'daily' | 'weekly' | 'monthly' | 'never';
  }) => request('/discounts/user-permissions', { method: 'POST', body: JSON.stringify(data) }),
  updateUserDiscountPermission: (id: string, data: any) => 
    request(`/discounts/user-permissions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUserDiscountPermission: (id: string) => 
    request(`/discounts/user-permissions/${id}`, { method: 'DELETE' }),
  bulkUpdateUserDiscountPermissions: (userId: string, permissions: Array<{
    discount_setting_id: string;
    usage_limit?: number;
    reset_period?: 'daily' | 'weekly' | 'monthly' | 'never';
    is_active?: boolean;
  }>) => request(`/discounts/user-permissions/bulk/${userId}`, { 
    method: 'PUT', 
    body: JSON.stringify({ permissions }) 
  }),
  
  // Discount Usage Log (Admin)
  logDiscountUsage: (data: {
    booking_id?: string;
    discount_setting_id: string;
    discount_amount: number;
    booking_total_before: number;
  }) => request('/discounts/usage-log', { method: 'POST', body: JSON.stringify(data) }),
  getDiscountUsageLog: (params?: { 
    user_id?: string; 
    discount_id?: string; 
    date_from?: string; 
    date_to?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.user_id) query.set('user_id', params.user_id);
    if (params?.discount_id) query.set('discount_id', params.discount_id);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    if (params?.limit) query.set('limit', String(params.limit));
    return request(`/discounts/usage-log${query.toString() ? `?${query}` : ''}`);
  },
  getDiscountUsageStats: (params?: { date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    return request(`/discounts/usage-stats${query.toString() ? `?${query}` : ''}`);
  },

  // ============================================
  // Messages (Sent log + Templates)
  // ============================================
  getSentMessages: (params?: { status?: string; client_id?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.client_id) query.set('client_id', params.client_id);
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    return request(`/messages/sent${query.toString() ? `?${query}` : ''}`);
  },
  sendMessage: (payload: {
    template_id?: string;
    body?: string;
    recipient_phone: string;
    recipient_name?: string;
    client_id?: string;
    booking_id?: string;
  }) => request('/messages/send', { method: 'POST', body: JSON.stringify(payload) }),
  getMessageTemplates: () => request('/messages/templates'),
  getMessageTemplate: (id: string) => request(`/messages/templates/${id}`),
  createMessageTemplate: (data: { name: string; name_ar?: string; body: string; channel?: string }) =>
    request('/messages/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateMessageTemplate: (id: string, data: { name?: string; name_ar?: string; body?: string; channel?: string }) =>
    request(`/messages/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMessageTemplate: (id: string) => request(`/messages/templates/${id}`, { method: 'DELETE' }),
  getPrepaymentBalances: (params?: any) => {
    const query = new URLSearchParams();
    if (params?.resource_type) query.set('resource_type', params.resource_type);
    if (params?.season_id) query.set('season_id', params.season_id);
    return request(`/expenses/prepayments${query.toString() ? `?${query}` : ''}`);
  },
  getExpenseAllocations: (expenseId: string) => request(`/expenses/${expenseId}/allocations`),
};
