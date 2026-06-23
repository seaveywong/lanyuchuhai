import { useEffect, useState } from 'react';
import { Button, Tag } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';
import { publicApi } from '../services/api';

export default function SupportWidget() {
  const [contact, setContact] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { publicApi.getPaymentConfig().then((data) => setContact(data.contact || null)).catch(() => undefined); }, []);
  if (!contact?.supportEnabled) return null;
  const links = [];
  if (contact.tgUsername || contact.tgUrl) links.push({ label: 'Telegram', href: contact.tgUrl || 'https://t.me/' + contact.tgUsername });
  if (contact.whatsapp) links.push({ label: 'WhatsApp', href: 'https://wa.me/' + contact.whatsapp.replace(/[^0-9]/g, '') });
  if (contact.email) links.push({ label: 'Email', href: 'mailto:' + contact.email });
  if (!links.length) return null;
  return <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 200 }}>
    {open && <div style={{ width: 300, background: '#fff', border: '1px solid #dbe3ef', boxShadow: '0 18px 50px rgba(15,23,42,.18)', borderRadius: 18, padding: 18, marginBottom: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{contact.supportTitle || '联系客服'}</div>
      <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>{contact.supportText || '如需确认库存、支付或交付，请联系人工客服。'}</div>
      {contact.businessHours && <Tag color="blue" style={{ marginBottom: 12 }}>{contact.businessHours}</Tag>}
      <div style={{ display: 'grid', gap: 8 }}>{links.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noreferrer" style={{ padding: '10px 12px', borderRadius: 12, background: '#f1f5f9', color: '#0f172a', fontWeight: 700 }}>{item.label}</a>)}</div>
    </div>}
    <Button type="primary" size="large" icon={<CustomerServiceOutlined />} onClick={() => setOpen((value) => !value)} style={{ height: 48, borderRadius: 24, boxShadow: '0 12px 30px rgba(37,99,235,.32)' }}>客服</Button>
  </div>;
}
