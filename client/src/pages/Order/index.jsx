import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Result, Space, Spin, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CopyOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { publicApi } from '../../services/api';

const { Paragraph } = Typography;
const methodLabel = { usdt_trc20: 'USDT-TRC20', alipay: '支付宝', wechat: '微信支付', balance: '余额支付' };
const statusLabel = { pending: { color: 'processing', text: '待支付' }, paid: { color: 'success', text: '已支付' }, cancelled: { color: 'default', text: '已取消' } };

export default function Order() {
  const { orderNo } = useParams();
  const [order, setOrder] = useState(null);
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [submittingTx, setSubmittingTx] = useState(false);
  const loadOrder = () => publicApi.getOrder(orderNo).then(setOrder).catch(() => undefined).finally(() => setLoading(false));
  useEffect(() => { loadOrder(); }, [orderNo]);
  useEffect(() => {
    if (!order || order.status !== 'pending') return undefined;
    const timer = setInterval(() => publicApi.getOrder(orderNo).then(setOrder).catch(() => undefined), 10000);
    return () => clearInterval(timer);
  }, [order, orderNo]);
  const verify = async (values) => {
    setVerifying(true);
    try {
      const result = await publicApi.lookupOrder({ email: values.email, accessPin: values.accessPin });
      setOrder(result); setCards(result.cards || null); setShowPin(false);
    } catch (err) { message.error(err.message); } finally { setVerifying(false); }
  };
  const openFiatPayment = async () => {
    setPaying(true);
    try { const result = await publicApi.createPayment({ orderNo: order.orderNo, method: order.paymentMethod }); window.open(result.url, '_blank', 'noopener,noreferrer'); }
    catch (err) { message.error(err.message); } finally { setPaying(false); }
  };
  const submitTx = async (values) => {
    setSubmittingTx(true);
    try {
      const result = await publicApi.submitOrderUsdtTx({ orderNo: order.orderNo, ...values });
      message.success('链上交易已核验，订单已交付');
      setOrder((current) => ({ ...current, status: result.status, paidAt: result.paidAt }));
    } catch (err) { message.error(err.message); } finally { setSubmittingTx(false); }
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
          <h2 style={{ margin: '10px 0 4px' }}>{status.text}</h2><p style={{ color: '#64748b', margin: 0 }}>保存订单号和查询密码，支付后可验证查看卡密。</p>
        </div>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 18 }}>
          <Descriptions.Item label="订单号" span={2}><Paragraph copyable style={{ margin: 0, fontFamily: 'monospace' }}>{order.orderNo}</Paragraph></Descriptions.Item>
          <Descriptions.Item label="金额"><strong style={{ fontSize: 18 }}>¥{Number(order.totalAmount).toFixed(2)}</strong></Descriptions.Item><Descriptions.Item label="状态"><Tag color={status.color}>{status.text}</Tag></Descriptions.Item>
          <Descriptions.Item label="支付方式" span={2}>{methodLabel[order.paymentMethod] || order.paymentMethod || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>{new Date(order.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
          {order.paidAt && <Descriptions.Item label="支付时间" span={2}>{new Date(order.paidAt).toLocaleString('zh-CN')}</Descriptions.Item>}
        </Descriptions>
        {order.status === 'pending' && order.paymentMethod === 'usdt_trc20' && <Card size="small" style={{ borderRadius: 16, borderColor: '#fde68a', background: '#fffbeb' }}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Alert type={address ? 'warning' : 'error'} showIcon message="USDT-TRC20 支付" description={address ? '请使用 TRC20 网络，精确转入以下金额；每笔订单分配独立地址，提交 TXID 后立即核验。' : '订单暂未分配收款地址，请联系客服。'} />
            {address && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 18, alignItems: 'center' }}><div><div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginBottom: 10 }}>{usdtAmount} USDT</div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>收款地址</div><Paragraph copyable={{ icon: <CopyOutlined /> }} style={{ margin: 0, overflowWrap: 'anywhere', fontFamily: 'monospace', fontWeight: 700 }}>{address}</Paragraph></div><div style={{ background: '#fff', padding: 8, borderRadius: 12 }}><QRCodeSVG value={address} size={116} level="M" includeMargin /></div></div>}
            {address && <Form layout="vertical" onFinish={submitTx}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}><Form.Item name="email" label="下单邮箱" rules={[{ required: true, type: 'email', message: '请输入下单邮箱' }]}><Input /></Form.Item><Form.Item name="accessPin" label="查询密码" rules={[{ required: true, pattern: /^\d{6}$/, message: '请输入 6 位密码' }]}><Input.Password prefix={<LockOutlined />} maxLength={6} /></Form.Item></div><Form.Item name="txHash" label="交易 TXID" extra="仅接受已确认的 USDT-TRC20 交易；金额、收款地址和 TXID 必须同时一致。" rules={[{ required: true, min: 40, message: '请输入完整 TXID' }]}><Input.TextArea rows={2} style={{ fontFamily: 'monospace' }} /></Form.Item><Button type="primary" htmlType="submit" loading={submittingTx} icon={<SafetyCertificateOutlined />}>提交 TXID 并核验</Button></Form>}
          </Space>
        </Card>}
        {order.status === 'pending' && (order.paymentMethod === 'alipay' || order.paymentMethod === 'wechat') && <Alert type="info" showIcon message="请在支付通道完成付款" action={<Button type="primary" loading={paying} onClick={openFiatPayment}>打开支付页面</Button>} />}
        {order.status === 'paid' && <div style={{ marginTop: 18 }}>{cards ? <Card size="small" title="已交付卡密" style={{ borderRadius: 14 }}>{cards.map((group) => <div key={group.productName} style={{ marginBottom: 14 }}><strong>{group.productName} × {group.quantity}</strong>{group.cards.map((card, index) => <Input.TextArea key={index} value={card} autoSize={{ minRows: 2 }} readOnly style={{ marginTop: 8, fontFamily: 'monospace' }} />)}</div>)}</Card> : <Button type="primary" onClick={() => setShowPin(true)}>验证并查看卡密</Button>}</div>}
      </Card>
      <VerifyModal open={showPin} onCancel={() => setShowPin(false)} onFinish={verify} loading={verifying} />
    </div>
  </div>;
}
function VerifyModal({ open, onCancel, onFinish, loading }) {
  const [form] = Form.useForm();
  return <Modal open={open} title="验证订单身份" onCancel={onCancel} onOk={() => form.validateFields().then(onFinish)} confirmLoading={loading} okText="验证"><Form form={form} layout="vertical"><Form.Item name="email" label="下单邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item><Form.Item name="accessPin" label="查询密码" rules={[{ required: true, pattern: /^\d{6}$/ }]}><Input.Password maxLength={6} /></Form.Item></Form></Modal>;
}
