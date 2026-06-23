
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, message, Typography } from 'antd';
import { DashboardOutlined, ShoppingOutlined, DatabaseOutlined, OrderedListOutlined, SettingOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { adminApi } from '../../services/api';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;
const adminSurface = import.meta.env.VITE_APP_SURFACE === 'admin';
const path = (value) => (adminSurface ? value : '/admin' + value);

const menuItems = [
  { key: path('/dashboard'), icon: <DashboardOutlined />, label: '数据看板' },
  { key: path('/products'), icon: <ShoppingOutlined />, label: '商品与分类' },
  { key: path('/inventory'), icon: <DatabaseOutlined />, label: '库存工作台' },
  { key: path('/orders'), icon: <OrderedListOutlined />, label: '订单管理' },
  { key: path('/settings'), icon: <SettingOutlined />, label: '支付与客服' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, setAdmin, logout } = useAuthStore();

  useEffect(() => {
    if (!admin) {
      adminApi.getMe()
        .then((data) => setAdmin(data.admin))
        .catch(() => {
          logout();
          navigate(adminSurface ? '/login' : '/admin/login');
        });
    }
  }, []);

  const doLogout = () => {
    logout();
    navigate(adminSurface ? '/login' : '/admin/login');
    message.success('已退出登录');
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#eef2f7' }}>
      <Sider width={224} style={{ background: '#0b1220', boxShadow: '8px 0 24px rgba(15,23,42,.18)' }}>
        <div style={{ height: 72, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.35 }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>蓝域出海</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.35 }}>后台运营中心</Text>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} style={{ background: '#0b1220', borderInlineEnd: 0 }} />
      </Sider>
      <Layout>
        <Header style={{ height: 64, lineHeight: 'normal', background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', overflow: 'visible' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, lineHeight: 1.25, minWidth: 0 }}>
            <Text style={{ display: 'block', fontWeight: 800, color: '#0f172a', fontSize: 15, lineHeight: '20px' }}>运营后台</Text>
            <Text style={{ display: 'block', fontSize: 12, color: '#64748b', lineHeight: '18px' }}>库存、订单、支付、客服统一管理</Text>
          </div>
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }],
              onClick: doLogout,
            }}
          >
            <Button type="text" icon={<UserOutlined />} style={{ borderRadius: 10 }}>{admin?.username || '管理员'}</Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24, background: '#eef2f7' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
