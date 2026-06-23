import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Descriptions, Empty, Form, Input, InputNumber, Popconfirm, Radio, Result, Space, Table, Tag, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, LockOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useCartStore } from '../../store/cartStore';
import { publicApi, userApi } from '../../services/api';
import { cnyToUsdt } from '../../utils/format';
import { useUserStore } from '../../store/userStore';

const methodFallback = {
  usdt_trc20: 'USDT-TRC20',
  alipay: '支付宝',
  wechat: '微信支付',
  balance: '余额支付',
};

export default function Cart() {
  const { items, updateQuantity, removeItem, clear, getTotal, getOrderItems } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [method, setMethod] = useState(null);
  const [rate, setRate] = useState(7);
  const [methods, setMethods] = useState([]);
  const { accessToken, user, setUser } = useUserStore();
  const navigate = useNavigate();
  const total = getTotal();
  const usdt = cnyToUsdt(total, rate);

  useEffect(() => {
    if (accessToken && !user) userApi.getMe().then((data) => setUser(data.user)).catch(() => undefined);
  }, [accessToken, user, setUser]);

  useEffect(() => {
    publicApi.getPaymentConfig()
      .then((data) => {
        if (data.exchangeRate) setRate(data.exchangeRate);
        const activeMethods = Array.isArray(data.methods) ? data.methods : [];
        setMethods(activeMethods);
      })
      .catch(() => setMethods([]));
  }, []);

  const balanceEnough = Boolean(user && Number(user.balanceCents || 0) >= Math.round(total * 100));
  const availableMethods = useMemo(() => {
    const external = methods.filter((item) => item.method !== 'balance');
    return balanceEnough ? [{ method: 'balance', label: '余额支付' }, ...external] : external;
  }, [methods, balanceEnough]);
  useEffect(() => {
    setMethod((current) => {
      if (balanceEnough) return 'balance';
      return availableMethods.some((item) => item.method === current) ? current : availableMethods[0]?.method || null;
    });
  }, [availableMethods, balanceEnough]);
  const methodMap = useMemo(() => new Map(availableMethods.map((item) => [item.method, item.label || methodFallback[item.method] || item.method])), [availableMethods]);

  const columns = [
    {
      title: '商品',
      dataIndex: 'name',
      render: (value, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{value}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>¥{Number(record.price).toFixed(2)}</div>
        </div>
      ),
    },
    { title: '数量', dataIndex: 'quantity', width: 100, render: (value, record) => <InputNumber min={1} max={99} value={value} onChange={(next) => updateQuantity(record.productId, next || 1)} /> },
    { title: '小计', width: 130, render: (_, record) => <strong>¥{(Number(record.price) * record.quantity).toFixed(2)}</strong> },
    { title: '', width: 56, render: (_, record) => <Popconfirm title="移除该商品？" onConfirm={() => removeItem(record.productId)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm> },
  ];

  const submit = async () => {
    if (!email) return message.error('请输入邮箱');
    if (!/^\d{6}$/.test(pin)) return message.error('请输入 6 位查询密码');
    if (!items.length) return message.error('购物车为空');
    if (!method) return message.error(user ? '余额不足且当前没有外部支付方式，请联系客服' : '当前没有可用支付方式，请联系客服');
    setSubmitting(true);
    try {
      const result = await publicApi.createOrder({ email, accessPin: pin, paymentMethod: method, items: getOrderItems() });
      if (method === 'balance' && user && result.balanceCents !== null) setUser({ ...user, balanceCents: result.balanceCents });
      setDone(result);
      clear();
      message.success('订单已创建');
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#f6f8fb', padding: 24 }}>
        <Card style={{ maxWidth: 620, margin: '40px auto', borderRadius: 18 }}>
          <Result status="success" title={done.status === 'paid' ? '订单已支付' : '订单已创建'} subTitle={done.status === 'paid' ? '余额已扣除，订单已自动交付。请保存订单号与查询密码。' : '请进入订单页完成支付，并保存订单号与查询密码。'} />
          <Descriptions column={1} bordered size="small" style={{ marginBottom: 18 }}>
            <Descriptions.Item label="订单号"><code>{done.orderNo}</code></Descriptions.Item>
            <Descriptions.Item label="订单金额"><strong style={{ color: '#dc2626', fontSize: 18 }}>¥{Number(done.totalAmount).toFixed(2)}</strong></Descriptions.Item>
            <Descriptions.Item label="支付方式">{methodMap.get(done.paymentMethod) || done.paymentMethod}</Descriptions.Item>
          </Descriptions>
          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button type="primary" size="large" onClick={() => navigate(`/order/${done.orderNo}`)}>{done.status === 'paid' ? '查看订单' : '去支付'}</Button>
            <Button size="large" onClick={() => navigate('/')}>继续选购</Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 800, textDecoration: 'none' }}>蓝域出海</Link>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ borderRadius: 12 }}>返回商品</Button>
        </div>
      </header>
      <main style={{ maxWidth: 960, margin: '24px auto', padding: '0 16px' }}>
        {!items.length ? (
          <Card style={{ borderRadius: 18 }}><Empty description="购物车为空"><Button type="primary" onClick={() => navigate('/')}>去选商品</Button></Empty></Card>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title={<span>购物车 <Tag>{items.length}</Tag></span>} style={{ borderRadius: 18 }}>
              <Table columns={columns} dataSource={items} rowKey="productId" pagination={false} summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={2} align="right"><strong>合计</strong></Table.Summary.Cell>
                  <Table.Summary.Cell><div style={{ fontSize: 22, fontWeight: 800 }}>¥{total.toFixed(2)}</div><div style={{ color: '#94a3b8', fontSize: 12 }}>{usdt} USDT</div></Table.Summary.Cell>
                  <Table.Summary.Cell />
                </Table.Summary.Row>
              )} />
            </Card>
            <Card title="下单信息" style={{ borderRadius: 18 }}>
              <Form layout="vertical" size="large" onFinish={submit}>
                <Form.Item label="邮箱" required extra="用于查询订单和接收异常处理通知。"><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={user?.email || 'your@email.com'} /></Form.Item>
                <Form.Item label="查询密码" required extra="6 位数字，请自行保存；支付后查看卡密需要验证。"><Input.Password prefix={<LockOutlined />} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位数字" style={{ maxWidth: 260 }} /></Form.Item>
                <Form.Item label="支付方式" required>
                  {availableMethods.length ? (
                    <Radio.Group value={method} onChange={(event) => setMethod(event.target.value)}>
                      {availableMethods.map((item) => <Radio.Button key={item.method} value={item.method}>{item.label || methodFallback[item.method] || item.method}</Radio.Button>)}
                    </Radio.Group>
                  ) : (
                    <Alert type="error" showIcon message="暂无可用支付方式" description="请联系网站客服，或等待管理员启用支付通道。" />
                  )}
                </Form.Item>
                {accessToken && user && !balanceEnough && <Alert type="warning" showIcon message="当前余额不足，不能与外部支付混合支付。" description={<span>可选择外部支付完成本单，或先前往 <Link to="/account">个人中心充值</Link> 后使用余额支付。</span>} style={{ marginBottom: 16 }} />}
                {method === 'usdt_trc20' && <Alert type="info" showIcon message={`参考金额：${usdt} USDT，实际收款地址以下单后的订单页为准。`} style={{ marginBottom: 16 }} />}
                {(method === 'alipay' || method === 'wechat') && <Alert type="info" showIcon message="提交订单后会跳转到对应支付通道页面。" style={{ marginBottom: 16 }} />}
                {method === 'balance' && <Alert type="success" showIcon message={`将从账户余额扣除 ¥${total.toFixed(2)}，当前余额 ¥${(Number(user?.balanceCents || 0) / 100).toFixed(2)}。`} style={{ marginBottom: 16 }} />}
                <Button type="primary" htmlType="submit" block size="large" icon={<ShoppingOutlined />} loading={submitting} disabled={!availableMethods.length} style={{ height: 50, borderRadius: 14, fontWeight: 800 }}>{method === 'balance' ? '使用余额支付' : '提交订单'} ¥{total.toFixed(2)}</Button>
              </Form>
            </Card>
          </Space>
        )}
      </main>
    </div>
  );
}
