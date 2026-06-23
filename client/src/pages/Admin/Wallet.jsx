import { useEffect, useState } from 'react';
import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';

const { Text } = Typography;
const money = (cents) => '¥' + (Number(cents || 0) / 100).toFixed(2);
const labels = { manual_credit: '内部充值', promotional_credit: '活动赠送', support_compensation: '售后补偿', payment_credit: '支付充值', purchase_debit: '订单支付' };

export default function Wallet() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [actionToken, setActionToken] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState([]);
  const [form] = Form.useForm();

  const loadLedger = async () => { try { const result = await adminApi.getWalletLedger(); setEntries(result.entries || []); } catch (err) { message.error(err.message); } };
  const loadUsers = async (nextQuery = query, expand = false) => { setLoading(true); try { const result = await adminApi.getWalletUsers(nextQuery.trim() ? { query: nextQuery.trim() } : undefined); setUsers(result.items || []); if (expand) setUserPanelOpen(['users']); } catch (err) { message.error(err.message); } finally { setLoading(false); } };
  useEffect(() => { loadUsers(''); loadLedger(); }, []);

  const search = async () => loadUsers(query, true);
  const close = () => { setOpen(false); setActionToken(null); form.resetFields(); };
  const openCredit = (row) => { setSelected(row); setActionToken(null); form.resetFields(); form.setFieldsValue({ type: 'manual_credit' }); setOpen(true); };
  const verify = async () => { try { const { password } = await form.validateFields(['password']); setLoading(true); const result = await adminApi.verifyWalletCredit({ password }); setActionToken(result.actionToken); message.success('密码已验证，请在 5 分钟内确认入账'); } catch (err) { if (err.message) message.error(err.message); } finally { setLoading(false); } };
  const credit = async () => { if (!actionToken) return verify(); try { const values = await form.validateFields(); setLoading(true); const { password, ...payload } = values; await adminApi.creditWallet({ userId: selected.id, ...payload, actionToken }); message.success('余额流水已创建'); close(); await Promise.all([loadUsers(query), loadLedger()]); } catch (err) { if (err.message) message.error(err.message); } finally { setLoading(false); } };

  const userColumns = [
    { title: '用户邮箱', dataIndex: 'email' },
    { title: '状态', dataIndex: 'status', width: 90, render: (value) => <Tag color={value === 'active' ? 'green' : 'red'}>{value === 'active' ? '正常' : value}</Tag> },
    { title: '余额', dataIndex: 'balanceCents', width: 130, render: (value) => <strong>{money(value)}</strong> },
    { title: '邮箱验证', dataIndex: 'emailVerifiedAt', width: 110, render: (value) => value ? <Tag color="green">已验证</Tag> : <Tag>未验证</Tag> },
    { title: '注册时间', dataIndex: 'createdAt', width: 180, render: (value) => new Date(value).toLocaleString('zh-CN') },
    { title: '操作', width: 120, render: (_, row) => <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openCredit(row)}>人工入账</Button> },
  ];
  const ledgerColumns = [
    { title: '用户', render: (_, row) => row.user?.email || '-' },
    { title: '类型', dataIndex: 'type', render: (value) => <Tag color={value === 'purchase_debit' ? 'orange' : 'green'}>{labels[value] || value}</Tag> },
    { title: '变动前', dataIndex: 'balanceBeforeCents', render: (value) => money(value) },
    { title: '金额', dataIndex: 'amountCents', render: (value) => <strong style={{ color: value >= 0 ? '#16a34a' : '#dc2626' }}>{value >= 0 ? '+' : '-'}{money(Math.abs(value))}</strong> },
    { title: '变动后', dataIndex: 'balanceAfterCents', render: (value) => money(value) },
    { title: '订单', render: (_, row) => row.order?.orderNo || '-' },
    { title: '管理员', render: (_, row) => row.admin?.username || '系统' },
    { title: '时间', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('zh-CN') },
  ];

  return <div><div style={{ marginBottom: 20 }}><Text style={{ display: 'block', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>用户与余额</Text><Text style={{ color: '#64748b' }}>默认展示最近注册用户；人工入账必须先验证管理员密码，凭证仅能使用一次且 5 分钟后失效。</Text></div>
    <Card style={{ borderRadius: 16, marginBottom: 16 }}><Space wrap style={{ marginBottom: 12 }}><Input value={query} onChange={(event) => setQuery(event.target.value)} onPressEnter={search} prefix={<SearchOutlined />} placeholder="按用户邮箱搜索；留空显示最近用户" style={{ width: 330 }} /><Button type="primary" loading={loading} onClick={search}>搜索/刷新用户</Button><Button onClick={() => { setQuery(''); loadUsers('', true); }}>显示最近用户</Button><Tag color="blue">已加载 {users.length} 个用户</Tag></Space><Collapse activeKey={userPanelOpen} onChange={(keys) => setUserPanelOpen(Array.isArray(keys) ? keys : [keys])} items={[{ key: 'users', label: '用户列表（默认收起，搜索后展开）', children: <Table rowKey="id" columns={userColumns} dataSource={users} pagination={{ pageSize: 10, showSizeChanger: true }} loading={loading} scroll={{ x: 900 }} /> }]} /></Card>
    <Card title="最近余额流水" extra={<Button icon={<ReloadOutlined />} onClick={loadLedger}>刷新</Button>} style={{ borderRadius: 16 }}><Table rowKey="id" columns={ledgerColumns} dataSource={entries} pagination={{ pageSize: 20 }} scroll={{ x: 1050 }} /></Card>
    <Modal title="人工入账" open={open} onCancel={close} onOk={credit} confirmLoading={loading} okText={actionToken ? '确认入账' : '验证管理员密码'}><Alert type={actionToken ? 'success' : 'warning'} showIcon message={actionToken ? '密码验证完成，凭证将在 5 分钟后失效且只能使用一次。' : '验证密码后才会签发一次性入账凭证。'} style={{ marginBottom: 16 }} /><Text strong style={{ display: 'block', marginBottom: 12 }}>{selected?.email}，当前余额 {money(selected?.balanceCents)}</Text><Form form={form} layout="vertical"><Form.Item name="amount" label="入账金额（元）" rules={[{ required: true, message: '请输入金额' }]}><InputNumber min={0.01} max={100000} precision={2} style={{ width: '100%' }} /></Form.Item><Form.Item name="type" label="入账类型" rules={[{ required: true }]}><Select options={[{ value: 'manual_credit', label: '内部充值' }, { value: 'promotional_credit', label: '活动赠送' }, { value: 'support_compensation', label: '售后补偿' }]} /></Form.Item><Form.Item name="note" label="原因与备注" rules={[{ required: true, min: 2, max: 300, message: '请填写 2-300 字原因' }]}><Input.TextArea rows={3} /></Form.Item>{!actionToken && <Form.Item name="password" label="当前管理员密码" rules={[{ required: true, message: '请验证管理员密码' }]}><Input.Password /></Form.Item>}</Form></Modal>
  </div>;
}

