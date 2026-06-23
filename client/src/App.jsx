import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { useAuthStore } from './store/authStore';

const surface = import.meta.env.VITE_APP_SURFACE || 'public';
const Home = lazy(() => import('./pages/Home'));
const Cart = lazy(() => import('./pages/Cart'));
const Order = lazy(() => import('./pages/Order'));
const Lookup = lazy(() => import('./pages/Lookup'));
const AdminLogin = lazy(() => import('./pages/Admin/Login'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/Admin/Products'));
const AdminInventory = lazy(() => import('./pages/Admin/Inventory'));
const AdminOrders = lazy(() => import('./pages/Admin/Orders'));
const AdminSettings = lazy(() => import('./pages/Admin/Settings'));
const AdminLayout = lazy(() => import('./pages/Admin/Layout'));

function Protected({ children }) {
  const loginPath = surface === 'admin' ? '/login' : '/admin/login';
  if (!useAuthStore(s => s.accessToken)) return <Navigate to={loginPath} replace />;
  return children;
}

const theme = { token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif", colorText: '#0f172a', colorTextSecondary: '#64748b', colorBorder: '#e2e8f0' } };
const fallback=<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Spin size="large"/></div>;

function AdminSurface(){return <Routes><Route path="/login" element={<AdminLogin/>}/><Route path="/" element={<Protected><AdminLayout/></Protected>}><Route index element={<Navigate to="dashboard" replace/>}/><Route path="dashboard" element={<AdminDashboard/>}/><Route path="products" element={<AdminProducts/>}/><Route path="inventory" element={<AdminInventory/>}/><Route path="orders" element={<AdminOrders/>}/><Route path="settings" element={<AdminSettings/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
function PublicSurface(){return <Routes><Route path="/" element={<Home/>}/><Route path="/cart" element={<Cart/>}/><Route path="/order/:orderNo" element={<Order/>}/><Route path="/lookup" element={<Lookup/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
export default function App(){return <ConfigProvider theme={theme}><Suspense fallback={fallback}>{surface==='admin'?<AdminSurface/>:<PublicSurface/>}</Suspense></ConfigProvider>}
