const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export const api = {
  // Public
  categories: () => request('/public/categories'),
  services: () => request('/public/services'),
  masters: () => request('/public/masters'),
  mastersForService: (serviceId) => request(`/public/masters-for-service/${serviceId}`),
  slots: (masterId, date, serviceId) =>
    request(`/public/slots?master_id=${masterId}&date=${date}&service_id=${serviceId}`),
  createBooking: (payload) => request('/public/bookings', { method: 'POST', body: JSON.stringify(payload) }),

  // Admin
  login: (login, password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  logout: () => request('/admin/logout', { method: 'POST' }),
  me: () => request('/admin/me'),
  dashboard: () => request('/admin/dashboard'),
  bookings: (params = '') => request(`/admin/bookings${params}`),
  booking: (id) => request(`/admin/bookings/${id}`),
  createBookingAdmin: (payload) => request('/admin/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  updateBooking: (id, payload) => request(`/admin/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteBooking: (id) => request(`/admin/bookings/${id}`, { method: 'DELETE' }),
  schedule: (params = '') => request(`/admin/schedule${params}`),

  // Settings
  categoriesAll: () => request('/admin/settings/categories'),
  createCategory: (p) => request('/admin/settings/categories', { method: 'POST', body: JSON.stringify(p) }),
  updateCategory: (id, p) => request(`/admin/settings/categories/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
  deleteCategory: (id) => request(`/admin/settings/categories/${id}`, { method: 'DELETE' }),
  servicesAll: () => request('/admin/settings/services'),
  createService: (p) => request('/admin/settings/services', { method: 'POST', body: JSON.stringify(p) }),
  updateService: (id, p) => request(`/admin/settings/services/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
  deleteService: (id) => request(`/admin/settings/services/${id}`, { method: 'DELETE' }),
  mastersAll: () => request('/admin/settings/masters'),
  updateMaster: (id, p) => request(`/admin/settings/masters/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
  masterSchedules: (id) => request(`/admin/settings/masters/${id}/schedules`),
  putMasterSchedules: (id, p) => request(`/admin/settings/masters/${id}/schedules`, { method: 'PUT', body: JSON.stringify(p) }),
  masterExceptions: (id) => request(`/admin/settings/masters/${id}/exceptions`),
  createException: (id, p) => request(`/admin/settings/masters/${id}/exceptions`, { method: 'POST', body: JSON.stringify(p) }),
  deleteException: (id) => request(`/admin/settings/exceptions/${id}`, { method: 'DELETE' }),
  createStaff: (p) => request('/admin/settings/staff', { method: 'POST', body: JSON.stringify(p) }),
};
