import axios from 'axios';
const api=axios.create({baseURL:'/api',timeout:15000});
api.interceptors.request.use(c=>{const t=localStorage.getItem('admin_token');if(t&&c.url?.startsWith('/admin'))c.headers.Authorization=`Bearer ${t}`;return c});
api.interceptors.response.use(r=>r.data,e=>{const m=e.response?.data?.error||'Network error';return Promise.reject(new Error(m))});
export const publicApi={
  getProducts:p=>api.get('/public/products',{params:p}),
  getProduct:id=>api.get(`/public/products/${id}`),
  createOrder:d=>api.post('/public/orders',d),
  getOrder:no=>api.get(`/public/orders/${no}`),
  lookupOrder:d=>api.post('/public/orders/lookup',d),
  getPaymentConfig:()=>api.get('/public/payment/config'),
  createPayment:d=>api.post('/public/payment/create',d),
};
export const adminApi={
  login:d=>api.post('/admin/login',d),
  getMe:()=>api.get('/admin/me'),
  changePassword:d=>api.post('/admin/change-password',d),
  getDashboard:()=>api.get('/admin/dashboard'),
  getProducts:p=>api.get('/admin/products',{params:p}),
  createProduct:d=>api.post('/admin/products',d),
  updateProduct:(id,d)=>api.put(`/admin/products/${id}`,d),
  deleteProduct:id=>api.delete(`/admin/products/${id}`),
  getCategories:()=>api.get('/admin/categories'),
  createCategory:d=>api.post('/admin/categories',d),
  getInventory:p=>api.get('/admin/inventory',{params:p}),
  batchImport:d=>api.post('/admin/inventory/batch-import',d),
  getOrders:p=>api.get('/admin/orders',{params:p}),
  getOrderDetail:id=>api.get(`/admin/orders/${id}`),
  cancelOrder:id=>api.post(`/admin/orders/${id}/cancel`),
  confirmPayment:id=>api.post(`/admin/orders/${id}/confirm-payment`),
  getPaymentConfigs:()=>api.get('/admin/payment-configs'),
  savePaymentConfig:d=>api.post('/admin/payment-configs',d),
};
