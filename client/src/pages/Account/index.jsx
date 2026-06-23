import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Avatar, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Radio, Space, Table, Tabs, Tag, message } from 'antd';
import { LogoutOutlined, PlusOutlined, SafetyCertificateOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { publicApi, userApi } from '../../services/api';
import { useUserStore } from '../../store/userStore';

const money = (cents) => '¥' + (Number(cents || 0) / 100).toFixed(2);
const ledgerLabel = { payment_credit: '余额充值', purchase_debit: '订单支付' };

export default function Account() {
  const { accessToken, user, setAuth, setUser, logout } = useUserStore();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState({ methods: [] });
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [topUp, setTopUp] = useState(null);
  const [creating, setCreating] = useState(false);
  const [submittingTx, setSubmittingTx] = useState(false);
  const [form] = Form.useForm();
  const [rechargeForm] = Form.useForm();
  const loadAccount = async () => {
    if (!accessToken) return;
    try {
      const [me, ledger, payment] = await Promise.all([userApi.getMe(), userApi.getLedger(), publicApi.getPaymentConfig()]);
      setUser(me.user);
      setEntries(ledger.entries || []);
      setPaymentConfig(payment || { methods: [] });
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
  const createTopup = async () => {
    try {
      const values = await rechargeForm.validateFields();
      setCreating(true);
      const result = await userApi.createTopup(values);
      setTopUp(result);
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
      message.success(result.url ? '充值订单已创建，请在支付页面完成付款' : '充值订单已创建');
    } catch (err) { message.error(err.message); } finally { setCreating(false); }
  };
  const submitTopupTx = async (values) => {
    setSubmittingTx(true);
    try {
      const result = await userApi.submitTopupTx(topUp.topUpNo, values);
      setUser({ ...user, balanceCents: result.balanceCents });
      setTopUp({ ...topUp, status: 'paid' });
      message.success('充值已到账');
      loadAccount();
    } catch (err) { message.error(err.message); } finally { setSubmittingTx(false); }
  };
  if (!accessToken || !user) return <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#eff6ff,#f8fafc)', padding: 24 }}><Card style={{ maxWidth: 430, margin: '44px auto', borderRadius: 22, boxShadow: '0 18px 45px rgba(15,23,42,.08)' }}>
    <Link to="/" style={{ color: '#475569', fontWeight: 700 }}>返回商品</Link><h1 style={{ margin: '18px 0 4px', fontSize: 26 }}>个人中心</h1><p style={{ color: '#64748b', marginTop: 0 }}>登录后可使用余额支付、充值和管理订单信息。</p>
    <Tabs activeKey={mode} onChange={setMode} items={[{ key: 'login', label: '登录' }, { key: 'register', label: '注册' }]} />
    <Form form={form} layout="vertical" onFinish={submit} size="large"><Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input prefix={<UserOutlined />} placeholder="you@example.com" /></Form.Item><Form.Item name="password" label="密码" rules={[{ required: true, min: 10, message: '密码至少 10 位' }]}><Input.Password /></Form.Item><Button type="primary" htmlType="submit" block loading={loading} style={{ height: 46, borderRadius: 12 }}>{mode === 'login' ? '登录账户' : '创建账户'}</Button></Form>
  </Card></div>;
  const columns = [
    { title: '类型', dataIndex: 'type', render: (value) => <Tag color={value === 'purchase_debit' ? 'orange' : 'blue'}>{ledgerLabel[value] || '余额变动'}</Tag> },
    { title: '变动', dataIndex: 'amountCents', render: (value) => <strong style={{ color: value >= 0 ? '#16a34a' : '#dc2626' }}>{value >= 0 ? '+' : '-'}{money(Math.abs(value))}</strong> },
    { title: '余额', dataIndex: 'balanceAfterCents', render: (value) => money(value) },
    { title: '订单', render: (_, row) => row.order?.orderNo || '-' },
    { title: '时间', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('zh-CN') },
  ];
  const displayName = user.email.split('@')[0];
  return <div style={{ minHeight: '100vh', background: '#f4f7fb', padding: '24px 16px 48px' }}><main style={{ maxWidth: 1020, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}><Link to="/" style={{ color: '#475569', fontWeight: 700 }}>返回商品</Link><Button icon={<LogoutOutlined />} onClick={logout}>退出登录</Button></div>
    <Card style={{ borderRadius: 22, marginBottom: 16, background: 'linear-gradient(115deg,#0f172a,#1d4ed8)', color: '#fff', overflow: 'hidden' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <Space size={14}><Avatar size={62} style={{ background: '#fff', color: '#1d4ed8', fontSize: 24, fontWeight: 800 }}>{displayName.slice(0, 1).toUpperCase()}</Avatar><div><div style={{ fontSize: 20, fontWeight: 800 }}>{displayName}</div><div style={{ opacity: .76 }}>{user.email}</div></div></Space>
      <div><div style={{ fontSize: 13, opacity: .72, marginBottom: 4 }}>可用余额</div><div style={{ fontSize: 34, fontWeight: 850 }}><WalletOutlined /> {money(user.balanceCents)}</div></div>
      <Button size="large" icon={<PlusOutlined />} onClick={() => { rechargeForm.resetFields(); rechargeForm.setFieldsValue({ amount: 100, method: paymentConfig.methods?.[0]?.method }); setTopUp(null); setRechargeOpen(true); }} style={{ borderRadius: 12, fontWeight: 800 }}>充值余额</Button>
    </div></Card>
    <Card style={{ borderRadius: 18 }}><Tabs items={[{ key: 'overview', label: '账户信息', children: <Descriptions column={{ xs: 1, sm: 2 }}><Descriptions.Item label="账户邮箱">{user.email}</Descriptions.Item><Descriptions.Item label="账户状态"><Tag color="green">正常</Tag></Descriptions.Item><Descriptions.Item label="余额支付">余额足够时结算页自动优先选中</Descriptions.Item><Descriptions.Item label="支付规则">不支持余额与外部支付混搭</Descriptions.Item></Descriptions> }, { key: 'ledger', label: '余额明细', children: <Table rowKey="id" columns={columns} dataSource={entries} pagination={{ pageSize: 20 }} scroll={{ x: 700 }} /> }]} /></Card>
    <Modal title="充值余额" open={rechargeOpen} onCancel={() => setRechargeOpen(false)} footer={null} width={topUp?.paymentMethod === 'usdt_trc20' ? 680 : 520}>
      {!topUp ? <Form form={rechargeForm} layout="vertical" onFinish={createTopup}><Form.Item name="amount" label="充值金额（CNY）" rules={[{ required: true, message: '请输入充值金额' }]}><InputNumber min={1} max={100000} precision={2} style={{ width: '100%' }} /></Form.Item><Form.Item name="method" label="支付方式" rules={[{ required: true, message: '请选择支付方式' }]}><Radio.Group>{(paymentConfig.methods || []).map((item) => <Radio.Button key={item.method} value={item.method}>{item.label}</Radio.Button>)}</Radio.Group></Form.Item>{!paymentConfig.methods?.length && <Alert type="warning" message="暂未启用充值方式，请联系客服。" />}<Button type="primary" htmlType="submit" loading={creating} disabled={!paymentConfig.methods?.length} block style={{ height: 44, borderRadius: 10 }}>创建充值订单</Button></Form> : topUp.paymentMethod === 'usdt_trc20' ? <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert type={topUp.status === 'paid' ? 'success' : 'warning'} showIcon message={topUp.status === 'paid' ? '充值已到账' : '请转入 ' + Number(topUp.expectedUsdt).toFixed(6).replace(/\.?0+$/, '') + ' USDT'} description="仅使用 TRC20 网络；转账完成后提交 TXID，系统核验金额和收款地址。" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}><div><div style={{ color: '#64748b', fontSize: 12 }}>收款地址</div><Input value={topUp.tronWallet?.address} readOnly addonAfter={<Button type="link" size="small" onClick={() => navigator.clipboard.writeText(topUp.tronWallet?.address || '')}>复制</Button>} /></div><div style={{ background: '#fff', padding: 8, border: '1px solid #e2e8f0', borderRadius: 12 }}><QRCodeSVG value={topUp.tronWallet?.address || ''} size={112} includeMargin /></div></div>
        {topUp.status !== 'paid' && <Form layout="vertical" onFinish={submitTopupTx}><Form.Item name="txHash" label="交易 TXID" rules={[{ required: true, min: 40, message: '请输入完整 TXID' }]}><Input.TextArea rows={2} style={{ fontFamily: 'monospace' }} /></Form.Item><Button type="primary" htmlType="submit" loading={submittingTx} icon={<SafetyCertificateOutlined />}>提交并核验</Button></Form>}
      </Space> : <Alert type="info" showIcon message="充值订单已创建" description={<span>请在已打开的支付页面完成付款。订单号：<code>{topUp.topUpNo}</code></span>} />}
    </Modal>
  </main></div>;
}
