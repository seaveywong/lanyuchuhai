import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Descriptions, Divider, Form, Input, Result, Space, Spin, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CopyOutlined, CustomerServiceOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { publicApi } from '../../services/api';
import { cnyToUsdt } from '../../utils/format';

const { Paragraph } = Typography;
const methodLabel = { usdt_trc20: 'USDT-TRC20', alipay: '支付宝', wechat: '微信支付' };
const statusLabel = { pending: { color: 'processing', text: '待支付' }, paid: { color: 'success', text: '已支付' }, cancelled: { color: 'default', text: '已取消' } };

function SupportBox({ contact }) {
  if (!contact?.supportEnabled) return null;
  const links = [];
  if (contact.tgUsername || contact.tgUrl) links.push({ label: 'Telegram', href: contact.tgUrl || `https://t.me/${contact.tgUsername}` });
  if (contact.whatsapp) links.push({ label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}` });
  if (contact.email) links.push({ label: '邮箱', href: `mailto:${contact.email}` });
  if (!links.length) return null;
  return (
    <Alert
      type="info"
      showIcon
      icon={<CustomerServiceOutlined />}
      message={contact.supportTitle || '联系客服'}
      description={<div><p style={{ margin: '4px 0 10px' }}>{contact.supportText || '如支付或交付异常，请联系人工客服。'}</p><Space wrap>{links.map((item) => <Button key={item.label} href={item.href} target="_blank">{item.label}</Button>)}</Space></div>}
      style={{ borderRadius: 12, marginTop: 16 }}
    />
  );
}

export default function Order() {
  const { orderNo } = useParams();
  const [order, setOrder] = useState(null);
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState(7);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    publicApi.getPaymentConfig().then((data) => {
      setPaymentConfig(data);
      if (data.exchangeRate) setRate(data.exchangeRate);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    publicApi.getOrder(orderNo).then((data) => setOrder(data)).catch(() => {}).finally(() => setLoading(false));
  }, [orderNo]);

  useEffect(() => {
    if (!order || order.status !== 'pending') return undefined;
    const timer = setInterval(() => {
      publicApi.getOrder(orderNo).then((data) => data && setOrder(data)).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [order, orderNo]);

  const verify = async (values) => {
    setVerifying(true);
    try {
      const result = await publicApi.lookupOrder({ email: values.email, accessPin: values.accessPin });
      setOrder(result);
      if (result.cards) setCards(result.cards);
      setShowPin(false);
    } catch (err) {
      message.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const openFiatPayment = async () => {
    setPaying(true);
    try {
      const result = await publicApi.createPayment({ orderNo: order.orderNo, method: order.paymentMethod });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      message.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
  if (!order) return <div style={{ maxWidth: 560, margin: '80px auto', padding: 16 }}><Result status="warning" title="订单不存在" extra={<Link to="/"><Button type="primary">返回首页</Button></Link>} /></div>;

  const status = statusLabel[order.status] || { color: 'default', text: order.status };
  const usdtAmount = cnyToUsdt(order.totalAmount, rate);
  const walletAddress = paymentConfig?.usdt?.walletAddress;

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb', padding: 24 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'inline-block', marginBottom: 16, color: '#2563eb', fontWeight: 700 }}>返回商品列表</Link>
        <Card style={{ borderRadius: 18 }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            {order.status === 'paid' ? <CheckCircleOutlined style={{ fontSize: 52, color: '#16a34a' }} /> : <ClockCircleOutlined style={{ fontSize: 52, color: '#f59e0b' }} />}
            <h2 style={{ margin: '10px 0 4px' }}>{status.text}</h2>
            <p style={{ color: '#64748b', margin: 0 }}>请保存订单号和查询密码，支付后可验证查看卡密。</p>
          </div>

          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 18 }}>
            <Descriptions.Item label="订单号" span={2}><Paragraph copyable style={{ margin: 0, fontFamily: 'monospace' }}>{order.orderNo}</Paragraph></Descriptions.Item>
            <Descriptions.Item label="金额"><strong style={{ fontSize: 18 }}>¥{Number(order.totalAmount).toFixed(2)}</strong></Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={status.color}>{status.text}</Tag></Descriptions.Item>
            <Descriptions.Item label="支付方式" span={2}>{methodLabel[order.paymentMethod] || order.paymentMethod || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{new Date(order.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
            {order.paidAt && <Descriptions.Item label="支付时间" span={2}>{new Date(order.paidAt).toLocaleString('zh-CN')}</Descriptions.Item>}
          </Descriptions>

          {order.status === 'pending' && (order.paymentMethod === 'usdt_trc20' || !order.paymentMethod) && (
            <Alert
              type={walletAddress ? 'warning' : 'error'}
              showIcon
              message="USDT-TRC20 支付"
              description={<div style={{ marginTop: 8 }}>{walletAddress ? <><p>请转账 <strong style={{ color: '#dc2626' }}>{usdtAmount} USDT</strong> 到以下地址：</p><Paragraph copyable code style={{ wordBreak: 'break-all', padding: 10, borderRadius: 8, background: '#0f172a', color: '#22c55e' }}>{walletAddress}</Paragraph><p style={{ color: '#64748b', fontSize: 13 }}>网络必须选择 TRC20。到账确认后系统会更新订单状态。</p></> : <p>管理员尚未配置 USDT 收款地址，请先联系客服，不要向任何示例地址付款。</p>}</div>}
              style={{ borderRadius: 12, marginBottom: 16 }}
            />
          )}

          {order.status === 'pending' && (order.paymentMethod === 'alipay' || order.paymentMethod === 'wechat') && (
            <Alert
              type="info"
              showIcon
              message={`${methodLabel[order.paymentMethod]}支付`}
              description={<div style={{ marginTop: 8 }}><p>点击按钮打开支付页面。支付完成后请回到本页等待状态更新。</p><Button type="primary" loading={paying} onClick={openFiatPayment}>{`打开${methodLabel[order.paymentMethod]}支付`}</Button></div>}
              style={{ borderRadius: 12, marginBottom: 16 }}
            />
          )}

          {order.status === 'paid' && !cards && (
            <div style={{ textAlign: 'center', padding: 18 }}>
              {showPin ? (
                <Card size="small" title="验证订单" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left', borderRadius: 12 }}>
                  <Form onFinish={verify} layout="vertical" size="large">
                    <Form.Item name="email" label="下单邮箱" rules={[{ required: true, type: 'email', message: '请输入下单邮箱' }]}><Input prefix={<MailOutlined />} placeholder="email" /></Form.Item>
                    <Form.Item name="accessPin" label="查询密码" rules={[{ required: true, pattern: /^\d{6}$/, message: '请输入 6 位数字' }]}><Input.Password prefix={<LockOutlined />} maxLength={6} placeholder="6 位数字" /></Form.Item>
                    <Button type="primary" htmlType="submit" block loading={verifying}>查看卡密</Button>
                  </Form>
                </Card>
              ) : (
                <Space direction="vertical"><p style={{ color: '#64748b' }}>支付成功后需要验证下单邮箱和查询密码。</p><Button type="primary" icon={<LockOutlined />} onClick={() => setShowPin(true)}>验证并查看卡密</Button></Space>
              )}
            </div>
          )}

          {cards?.length > 0 && (
            <div>
              <Divider>交付内容</Divider>
              {cards.map((group, index) => (
                <Card key={index} size="small" title={<span>{group.productName} <Tag>x{group.quantity}</Tag></span>} style={{ marginBottom: 10, borderRadius: 12 }}>
                  {group.cards.map((card, cardIndex) => (
                    <div key={cardIndex} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, background: '#f1f5f9', borderRadius: 10, marginBottom: 8, fontFamily: 'monospace' }}>
                      <span style={{ wordBreak: 'break-all' }}>{card}</span>
                      <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(card); message.success('已复制'); }}>复制</Button>
                    </div>
                  ))}
                </Card>
              ))}
              <Alert type="success" showIcon message="请及时保存交付内容。" style={{ borderRadius: 12 }} />
            </div>
          )}

          <SupportBox contact={paymentConfig?.contact} />
        </Card>
      </div>
    </div>
  );
}
