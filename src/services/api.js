import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 품목 마스터 API
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  import: (formData) => api.post('/products/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// 발주 API
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  import: (formData) => api.post('/orders/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  export: (params) => api.get('/orders/export/excel', {
    params,
    responseType: 'blob',
  }),
};

// 재고 API
export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
  getAlerts: (params) => api.get('/inventory/alerts', { params }),
  import: (formData) => api.post('/inventory/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  export: (params) => api.get('/inventory/export/excel', {
    params,
    responseType: 'blob',
  }),
};

// 법인카드 API
export const expensesAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  getSummary: (month, params) => api.get(`/expenses/summary/${month}`, { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  import: (formData) => api.post('/expenses/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  export: (params) => api.get('/expenses/export/excel', {
    params,
    responseType: 'blob',
  }),
};

// 거래 API
export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  import: (formData) => api.post('/transactions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  export: (params) => api.get('/transactions/export/excel', {
    params,
    responseType: 'blob',
  }),
};

// 통계 API
export const analyticsAPI = {
  getDashboard: (params) => api.get('/analytics/dashboard', { params }),
  getMonthly: (params) => api.get('/analytics/monthly', { params }),
  getYearly: (params) => api.get('/analytics/yearly', { params }),
  getCategory: (params) => api.get('/analytics/category', { params }),
  getStore: (params) => api.get('/analytics/store', { params }),
};

// 입출고 내역 API
export const inventoryHistoryAPI = {
  getAll: (params) => api.get('/inventory-history', { params }),
  getByItem: (itemName, params) => api.get(`/inventory-history/item/${encodeURIComponent(itemName)}`, { params }),
  create: (data) => api.post('/inventory-history', data),
  delete: (id) => api.delete(`/inventory-history/${id}`),
  getStats: (params) => api.get('/inventory-history/stats', { params }),
};

export default api;
