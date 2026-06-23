import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Modal, Result, Space, Spin, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CopyOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { publicApi } from '../../services/api';

const { Paragraph } = Typography;
const methodLabel = { usdt_trc20: 'USDT-TRC20', alipay: '支付宝', wechat: '微信支付', balance: '余额支付' };
const statusLabel = { pending: { color: 'processing', text: '待支付' }, paid: { color: 'success', text: '已支付' }, cancelled: { color: 'default', text: '已取消' } };

function SummaryItem({ label, children, wide }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, display: 'grid', gridTemplateColumns: '90px minmax(0,1fr)', minHeight: 42, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: '10px 14px', background: '#f8fafc', color: '#64748b', borderRight: '1px solid #e5e7eb' }}>{label}</div>
      <div style={{ padding: '10px 14px', minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function Order() {
  const { orderNo } = useParams();
  const [order, setOrder] = useState(null);
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadOrder = () => publicApi.getOrder(orderNo).then(setOrder).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { loadOrder(); }, [orderNo]);
  useEffect(() => {
    if (!order || order.status !== 'pending') return undefined;
    const timer = setInterval(() => publicApi.getOrder(orderNo).then(setOrder).catch(() => undefined), 8000);
    return () => clearInterval(timer);
  }, [order, orderNo]);

  const verify = async (values) => {
    setVerifying(true);
    try {
      const result = await publicApi.lookupOrder({ email: values.email, accessPin: values.accessPin });
      setOrder(result);
      setCards(result.cards || null);
      setShowPin(false);
    } catch (err) { message.error(err.message); } finally { setVerifying(false); }
  };

  const openFiatPayment = async () => {
    setPaying(true);
    try {
      const result = await publicApi.createPayment({ orderNo: order.orderNo, method: order.paymentMethod });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) { message.error(err.message); } finally { setPaying(false); }
  };

  const checkPayment = async () => {
    setChecking(true);
    try {
      const result = await publicApi.checkPayment({ orderNo: order.orderNo });
      message[result.status === 'paid' ? 'success' : 'info'](result.message || '支付状态已刷新');
      const latest = await publicApi.getOrder(order.orderNo);
      setOrder(latest);
    } catch (err) { message.error(err.message); } finally { setChecking(false); }
  };

  if (loading) return <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
  if (!order) return <div style={{ maxWidth: 560, margin: '80px auto', padding: 16 }}><Result status="warning" title="订单不存在" extra={<Link to="/"><Button type="primary">返回首页</Button></Link>} /></div>;

  const status = statusLabel[order.status] || { color: 'default', text: order.status };
  const address = order.tronWallet?.address;
  const usdtAmount = Number(order.expectedUsdt || 0).toFixed(6).replace(/\.?0+$/, '');

  return <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#f8fbff,#eef4fb)', padding: '24px 16px 48px' }}>
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: 16, color: '#2563eb', fontWeight: 700 }}>返回商品列表</Link>
      <Card style={{ borderRadius: 22, boxShadow: '0 18px 45px rgba(15,23,42,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          {order.status === 'paid' ? <CheckCircleOutlined style={{ fontSize: 52, color: '#16a34a' }} /> : <ClockCircleOutlined style={{ fontSize: 52, color: '#f59e0b' }} />}
          <h2 style={{ margin: '10px 0 4px' }}>{status.text}</h2>
          <p style={{ color: '#64748b', margin: 0 }}>请保存订单号和查询密码，支付完成后可验证查看卡密。</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10, marginBottom: 18 }}>
          <SummaryItem label="订单号" wide><Paragraph copyable style={{ margin: 0, fontFamily: 'monospace' }}>{order.orderNo}</Paragraph></SummaryItem>
          <SummaryItem label="金额"><strong style={{ fontSize: 18 }}>¥{Number(order.totalAmount).toFixed(2)}</strong></SummaryItem>
          <SummaryItem label="状态"><Tag color={status.color}>{status.text}</Tag></SummaryItem>
          <SummaryItem label="支付方式">{methodLabel[order.paymentMethod] || order.paymentMethod || '-'}</SummaryItem>
          <SummaryItem label="创建时间">{new Date(order.createdAt).toLocaleString('zh-CN')}</SummaryItem>
          {order.paidAt && <SummaryItem label="支付时间" wide>{new Date(order.paidAt).toLocaleString('zh-CN')}</SummaryItem>}
        </div>

        {order.status === 'pending' && order.paymentMethod === 'usdt_trc20' && <Card size="small" style={{ borderRadius: 18, borderColor: '#fde68a', background: '#fffbeb' }}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Alert type={address ? 'warning' : 'error'} showIcon message="USDT-TRC20 支付" description={address ? '请使用 TRC20 网络，精确转入以下金额；系统会按收款地址和金额自动检测到账。' : '订单暂未分配收款地址，请联系客服。'} />
            {address && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 18, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 850, color: '#dc2626', marginBottom: 12 }}>{usdtAmount} USDT</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>收款地址</div>
                <Paragraph copyable={{ icon: <CopyOutlined /> }} style={{ margin: 0, overflowWrap: 'anywhere', fontFamily: 'monospace', fontWeight: 700 }}>{address}</Paragraph>
              </div>
              <div style={{ background: '#fff', padding: 10, borderRadius: 14, border: '1px solid #fde68a' }}><QRCodeSVG value={address} size={118} level="M" includeMargin /></div>
            </div>}
            {address && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button type="primary" icon={<ReloadOutlined />} loading={checking} onClick={checkPayment}>我已付款，检测到账</Button>
              <span style={{ color: '#64748b', fontSize: 13 }}>通常链上确认后可识别；如果刚转账，请等待 1-3 分钟后再检测。</span>
            </div>}
          </Space>
        </Card>}

        {order.status === 'pending' && (order.paymentMethod === 'alipay' || order.paymentMethod === 'wechat') && <Alert type="info" showIcon message="请在支付通道完成付款" description="支付成功后网关会自动回调确认，页面会自动刷新状态；如未跳转或未到账，可重新打开支付页或点击刷新检测。" action={<Space><Button type="primary" loading={paying} onClick={openFiatPayment}>打开支付页面</Button><Button loading={checking} onClick={checkPayment}>刷新检测</Button></Space>} />}

        {order.status === 'paid' && <div style={{ marginTop: 18 }}>{cards ? <Card size="small" title="已交付卡密" style={{ borderRadius: 14 }}>{cards.map((group) => <div key={group.productName} style={{ marginBottom: 14 }}><strong>{group.productName} × {group.quantity}</strong>{group.cards.map((card, index) => <Input.TextArea key={index} value={card} autoSize={{ minRows: 2 }} readOnly style={{ marginTop: 8, fontFamily: 'monospace' }} />)}</div>)}</Card> : <Button type="primary" onClick={() => setShowPin(true)}>验证并查看卡密</Button>}</div>}
      </Card>
      <VerifyModal open={showPin} onCancel={() => setShowPin(false)} onFinish={verify} loading={verifying} />
    </div>
  </div>;
}

function VerifyModal({ open, onCancel, onFinish, loading }) {
  const [form] = Form.useForm();
  return <Modal open={open} title="验证订单身份" onCancel={onCancel} onOk={() => form.validateFields().then(onFinish)} confirmLoading={loading} okText="验证">
    <Form form={form} layout="vertical">
      <Form.Item name="email" label="下单邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
      <Form.Item name="accessPin" label="查询密码" rules={[{ required: true, pattern: /^\d{6}$/ }]}><Input.Password prefix={<LockOutlined />} maxLength={6} /></Form.Item>
    </Form>
  </Modal>;
}

