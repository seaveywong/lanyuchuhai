
import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_BASE_URL || '/api';
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL.slice(0, -1) : rawBaseURL;
const api = axios.create({ baseURL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token && config.url?.startsWith('/admin')) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(new Error(error.response?.data?.error || 'Network error')),
);

export const publicApi = {
  getProducts: (params) => api.get('/public/products', { params }),
  getProduct: (id) => api.get('/public/products/' + id),
  getCategories: () => api.get('/public/categories'),
  createOrder: (data) => api.post('/public/orders', data),
  getOrder: (orderNo) => api.get('/public/orders/' + orderNo),
  lookupOrder: (data) => api.post('/public/orders/lookup', data),
  getPaymentConfig: () => api.get('/public/payment/config'),
  createPayment: (data) => api.post('/public/payment/create', data),
};

export const adminApi = {
  login: (data) => api.post('/admin/login', data),
  getMe: () => api.get('/admin/me'),
  changePassword: (data) => api.post('/admin/change-password', data),
  changeUsername: (data) => api.post('/admin/change-username', data),
  getDashboard: () => api.get('/admin/dashboard'),
  getProducts: (params) => api.get('/admin/products', { params }),
  createProduct: (data) => api.post('/admin/products', data),
  updateProduct: (id, data) => api.put('/admin/products/' + id, data),
  deleteProduct: (id) => api.delete('/admin/products/' + id),
  getCategories: (params) => api.get('/admin/categories', { params }),
  createCategory: (data) => api.post('/admin/categories', data),
  updateCategory: (id, data) => api.put('/admin/categories/' + id, data),
  deleteCategory: (id) => api.delete('/admin/categories/' + id),
  getInventory: (params) => api.get('/admin/inventory', { params }),
  searchInventory: (data) => api.post('/admin/inventory/search', data),
  batchImport: (data) => api.post('/admin/inventory/batch-import', data),
  updateInventory: (id, data) => api.put('/admin/inventory/' + id, data),
  deleteInventory: (id) => api.delete('/admin/inventory/' + id),
  batchDeleteInventory: (ids) => api.post('/admin/inventory/batch-delete', { ids }),
  getOrders: (params) => api.get('/admin/orders', { params }),
  getOrderDetail: (id) => api.get('/admin/orders/' + id),
  cancelOrder: (id) => api.post('/admin/orders/' + id + '/cancel'),
  confirmPayment: (id) => api.post('/admin/orders/' + id + '/confirm-payment'),
  getPaymentConfigs: () => api.get('/admin/payment-configs'),
  savePaymentConfig: (data) => api.post('/admin/payment-configs', data),
};
