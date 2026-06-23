import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';

export default function TronWalletPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const load = async () => {
    setLoading(true);
    try { setItems((await adminApi.getTronWallets()).items || []); }
    catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await adminApi.createTronWallet({ ...values, status: values.status ? 'active' : 'inactive' });
      message.success('收款地址已添加');
      form.resetFields();
      setOpen(false);
      load();
    } catch (err) { if (err.message) message.error(err.message); }
    finally { setSaving(false); }
  };
  const toggle = async (item) => {
    try {
      await adminApi.updateTronWallet(item.id, { status: item.status === 'active' ? 'inactive' : 'active' });
      load();
    } catch (err) { message.error(err.message); }
  };
  const columns = [
    { title: '标签 / 地址', dataIndex: 'address', render: (address, item) => <div><strong>{item.label || '未命名地址'}</strong><br /><code style={{ fontSize: 12 }}>{address}</code></div> },
    { title: '状态', width: 116, render: (_, item) => <Tag color={item.status === 'active' ? 'green' : 'default'}>{item.status === 'active' ? '启用' : '停用'}</Tag> },
    { title: '优先级', dataIndex: 'priority', width: 86 },
    { title: '最近分配', dataIndex: 'lastAssignedAt', width: 180, render: (value) => value ? new Date(value).toLocaleString('zh-CN') : '尚未分配' },
    { title: '关联单', width: 90, render: (_, item) => (item._count?.orders || 0) + (item._count?.topUps || 0) },
    { title: '操作', width: 100, render: (_, item) => <Popconfirm title={item.status === 'active' ? '停用后不再分配给新订单，历史订单不受影响。' : '确认启用该收款地址？'} onConfirm={() => toggle(item)}><Button size="small">{item.status === 'active' ? '停用' : '启用'}</Button></Popconfirm> },
  ];
  return <Card bordered={false} style={{ borderRadius: 16 }} title="TRON 收款地址池" extra={<Space><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ status: true, priority: 0 }); setOpen(true); }}>添加地址</Button></Space>}>
    <p style={{ marginTop: 0, color: '#64748b' }}>仅保存公开收款地址，不保存私钥。新订单按优先级和最近使用时间轮询分配；停用地址不会影响历史订单核验。</p>
    <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} scroll={{ x: 780 }} />
    <Modal title="添加 TRON 收款地址" open={open} onCancel={() => setOpen(false)} onOk={create} confirmLoading={saving} okText="添加">
      <Form form={form} layout="vertical">
        <Form.Item name="address" label="TRON 地址" rules={[{ required: true, message: '请输入 T 开头的公开收款地址' }]}><Input placeholder="T..." /></Form.Item>
        <Form.Item name="label" label="内部标签"><Input placeholder="例如：主地址 A" /></Form.Item>
        <Form.Item name="priority" label="优先级"><InputNumber min={-100} max={100} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="status" label="立即启用" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </Card>;
}
