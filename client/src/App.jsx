import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { useAuthStore } from './store/authStore';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Order from './pages/Order';
import Lookup from './pages/Lookup';
import AdminLogin from './pages/Admin/Login';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminProducts from './pages/Admin/Products';
import AdminInventory from './pages/Admin/Inventory';
import AdminOrders from './pages/Admin/Orders';
import AdminSettings from './pages/Admin/Settings';
import AdminLayout from './pages/Admin/Layout';

function Protected({ children }) {
  if (!useAuthStore(s => s.accessToken)) return <Navigate to="/admin/login" replace />;
  return children;
}

const theme = {
  token: {
    colorPrimary: '#2563eb',
    borderRadius: 8,
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif",
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorBorder: '#e2e8f0',
  },
};

export default function App() {
  return (
    <ConfigProvider theme={theme}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/order/:orderNo" element={<Order />} />
        <Route path="/lookup" element={<Lookup />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Protected><AdminLayout /></Protected>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </ConfigProvider>
  );
}
