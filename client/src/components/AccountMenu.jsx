import { useEffect } from 'react';
import { Avatar, Button, Dropdown, Space } from 'antd';
import { LoginOutlined, LogoutOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../services/api';
import { useUserStore } from '../store/userStore';

export default function AccountMenu() {
  const navigate = useNavigate();
  const { accessToken, user, setUser, logout } = useUserStore();
  useEffect(() => {
    if (accessToken && !user) userApi.getMe().then((result) => setUser(result.user)).catch(() => logout());
  }, [accessToken, user, setUser, logout]);
  if (!accessToken || !user) return <Button icon={<LoginOutlined />} onClick={() => navigate('/account')} style={{ borderRadius: 12 }}>登录</Button>;
  const name = user.email.slice(0, 1).toUpperCase();
  const items = [
    { key: 'account', icon: <UserOutlined />, label: '个人中心' },
    { key: 'logout', icon: <LogoutOutlined />, danger: true, label: '退出登录' },
  ];
  return <Dropdown menu={{ items, onClick: ({ key }) => key === 'logout' ? logout() : navigate('/account') }} placement="bottomRight">
    <Button type="text" style={{ height: 40, paddingInline: 6, borderRadius: 20 }}><Space size={7}><Avatar size={30} style={{ background: '#2563eb' }}>{name}</Avatar><span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', color: '#334155', fontWeight: 700 }}>{user.email.split('@')[0]}</span><WalletOutlined style={{ color: '#2563eb' }} /></Space></Button>
  </Dropdown>;
}
