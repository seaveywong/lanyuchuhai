import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Descriptions, Form, Input, Table, Tabs, Tag, message } from 'antd';
import { LogoutOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons';
import { userApi } from '../../services/api';
import { useUserStore } from '../../store/userStore';

const labels = { manual_credit: '人工充值', promotional_credit: '活动赠送', support_compensation: '售后补偿', purchase_debit: '订单支付' };
const money = (cents) => '¥' + (Number(cents || 0) / 100).toFixed(2);

export default function Account() {
  const { accessToken, user, setAuth, setUser, logout } = useUserStore();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [form] = Form.useForm();
  const loadAccount = async () => {
    if (!accessToken) return;
    try {
      const [me, ledger] = await Promise.all([userApi.getMe(), userApi.getLedger()]);
      setUser(me.user);
      setEntries(ledger.entries || []);
    } catch (_) { logout(); }
  };
  useEffect(() => { loadAccount(); }, [accessToken]);
  const submit = async (values) => {
    setLoading(true);
    try {
      const result = mode === 'login' ? await userApi.login(values) : await userApi.register(values);
      setAuth(result.accessToken, result.user);
      message.success(mode === 'login' ? '登录成功' : '注册成功');
      form.resetFields();
    } catch (err) { message.error(err.message); } finally { setLoading(false); }
  };
  if (!accessToken || !user) return <div style={{ minHeight: '100vh', background: '#f6f8fb', padding: 24 }}><Card style={{ maxWidth: 430, margin: '44px auto', borderRadius: 18 }}>
    <Link to="/" style={{ color: '#475569', fontWeight: 700 }}>返回商品</Link><h1 style={{ margin: '18px 0 4px', fontSize: 26 }}>账户与余额</h1><p style={{ color: '#64748b', marginTop: 0 }}>注册后可使用余额支付、接收充值赠送。</p>
    <Tabs activeKey={mode} onChange={setMode} items={[{ key: 'login', label: '登录' }, { key: 'register', label: '注册' }]} />
    <Form form={form} layout="vertical" onFinish={submit} size="large"><Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input prefix={<UserOutlined />} placeholder="you@example.com" /></Form.Item><Form.Item name="password" label="密码" rules={[{ required: true, min: 10, message: '密码至少 10 位' }]}><Input.Password placeholder="至少 10 位" /></Form.Item><Button type="primary" htmlType="submit" block loading={loading} style={{ height: 46, borderRadius: 12 }}>{mode === 'login' ? '登录账户' : '创建账户'}</Button></Form>
  </Card></div>;
  const columns = [
    { title: '类型', dataIndex: 'type', render: (value) => <Tag color={value === 'purchase_debit' ? 'orange' : 'green'}>{labels[value] || value}</Tag> },
    { title: '变动', dataIndex: 'amountCents', render: (value) => <strong style={{ color: value >= 0 ? '#16a34a' : '#dc2626' }}>{value >= 0 ? '+' : '-'}{money(Math.abs(value))}</strong> },
    { title: '余额', dataIndex: 'balanceAfterCents', render: (value) => money(value) },
    { title: '订单', render: (_, row) => row.order?.orderNo || '-' },
    { title: '时间', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('zh-CN') },
  ];
  return <div style={{ minHeight: '100vh', background: '#f6f8fb', padding: '24px 16px' }}><main style={{ maxWidth: 960, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}><Link to="/" style={{ color: '#475569', fontWeight: 700 }}>返回商品</Link><Button icon={<LogoutOutlined />} onClick={logout}>退出登录</Button></div>
    <Card style={{ borderRadius: 18, marginBottom: 16 }}><Descriptions column={{ xs: 1, sm: 2 }}><Descriptions.Item label="账户邮箱">{user.email}</Descriptions.Item><Descriptions.Item label="可用余额"><strong style={{ color: '#2563eb', fontSize: 24 }}><WalletOutlined /> {money(user.balanceCents)}</strong></Descriptions.Item></Descriptions><Alert type="info" showIcon message="余额可用于订单支付；人工充值、赠送与订单扣款均可在下方流水中核对。" style={{ marginTop: 16 }} /></Card>
    <Card title="余额流水" style={{ borderRadius: 18 }}><Table rowKey="id" columns={columns} dataSource={entries} pagination={{ pageSize: 20 }} scroll={{ x: 700 }} /></Card>
  </main></div>;
}
