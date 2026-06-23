
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';

const { Text } = Typography;
const { TextArea } = Input;
const statusMeta = { available: { color: 'green', text: '可售' }, reserved: { color: 'blue', text: '预占' }, sold: { color: 'red', text: '已售' } };
function formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN') : '-'; }

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [productFilter, setProductFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [importForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const productOptions = products.map((item) => ({ label: item.name + ' / ¥' + Number(item.price || 0).toFixed(2), value: item.id }));
  const selectedSet = new Set(selectedIds);
  const deletableItems = items.filter((item) => item.status !== 'sold' && !item.orderItemId);
  const allDeletableSelected = deletableItems.length > 0 && deletableItems.every((item) => selectedSet.has(item.id));

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (productFilter) params.productId = productFilter;
      if (statusFilter) params.status = statusFilter;
      const [inventoryResult, productResult] = await Promise.all([adminApi.getInventory(params), adminApi.getProducts({ limit: 300 })]);
      setItems(inventoryResult.items || []);
      setProducts(productResult.items || []);
      setSelectedIds([]);
    } catch (err) {
      message.error(err.message || '库存加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [productFilter, statusFilter]);

  const stats = useMemo(() => ({ total: items.length, available: items.filter((item) => item.status === 'available').length, reserved: items.filter((item) => item.status === 'reserved').length, sold: items.filter((item) => item.status === 'sold').length }), [items]);
  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((item) => { if (!map.has(item.productId)) map.set(item.productId, { product: item.product, items: [] }); map.get(item.productId).items.push(item); });
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const toggleOne = (id, checked) => setSelectedIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter((item) => item !== id));
  const toggleAll = (checked) => setSelectedIds(checked ? deletableItems.map((item) => item.id) : []);

  const doImport = async () => {
    try {
      const values = await importForm.validateFields();
      const cards = values.cardText.split('\n').map((line) => line.trim()).filter(Boolean);
      if (!cards.length) return message.error('请输入至少一条卡密');
      setSubmitting(true);
      const result = await adminApi.batchImport({ productId: values.productId, cards, skipDuplicates: true });
      message.success('导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条重复');
      setImportOpen(false); importForm.resetFields(); await load();
    } catch (err) { if (err.message) message.error(err.message); } finally { setSubmitting(false); }
  };

  const openEdit = (item) => { setEditing(item); editForm.setFieldsValue({ productId: item.productId, status: item.status }); setEditOpen(true); };
  const doEdit = async () => {
    if (!editing) return;
    try {
      const values = await editForm.validateFields();
      const payload = { productId: values.productId, status: values.status };
      if (values.cardContent?.trim()) payload.cardContent = values.cardContent.trim();
      setSubmitting(true);
      await adminApi.updateInventory(editing.id, payload);
      message.success('库存已更新'); setEditOpen(false); setEditing(null); editForm.resetFields(); await load();
    } catch (err) { if (err.message) message.error(err.message); } finally { setSubmitting(false); }
  };
  const doDelete = async (item) => { try { await adminApi.deleteInventory(item.id); message.success('库存已删除'); await load(); } catch (err) { message.error(err.message || '删除失败'); } };
  const doBatchDelete = async () => {
    if (!selectedIds.length) return;
    try {
      setSubmitting(true);
      const result = await adminApi.batchDeleteInventory(selectedIds);
      message.success('已删除 ' + result.deleted + ' 条，跳过 ' + result.skipped + ' 条已售/锁定库存');
      await load();
    } catch (err) { message.error(err.message || '批量删除失败'); } finally { setSubmitting(false); }
  };

  return <div>
    <div style={{ marginBottom: 20 }}><Text style={{ display: 'block', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>库存工作台</Text><Text style={{ color: '#64748b' }}>按商品组织库存，支持导入、修改、单条删除和批量删除未售库存。</Text></div>
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="库存总数" value={stats.total} prefix={<InboxOutlined />} /></Card></Col>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="可售" value={stats.available} valueStyle={{ color: '#16a34a' }} /></Card></Col>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="预占" value={stats.reserved} valueStyle={{ color: '#2563eb' }} /></Card></Col>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="已售" value={stats.sold} valueStyle={{ color: '#dc2626' }} /></Card></Col>
    </Row>
    <Card bordered={false} style={{ borderRadius: 16, marginBottom: 16 }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select allowClear showSearch optionFilterProp="label" placeholder="按商品筛选" value={productFilter} onChange={setProductFilter} options={productOptions} style={{ minWidth: 280 }} />
          <Select allowClear placeholder="按状态筛选" value={statusFilter} onChange={setStatusFilter} options={[{ label: '可售', value: 'available' }, { label: '预占', value: 'reserved' }, { label: '已售', value: 'sold' }]} style={{ width: 140 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Checkbox checked={allDeletableSelected} indeterminate={selectedIds.length > 0 && !allDeletableSelected} onChange={(event) => toggleAll(event.target.checked)}>全选可删除</Checkbox>
        </Space>
        <Space>
          <Popconfirm title={'确认批量删除选中的 ' + selectedIds.length + ' 条库存？'} okText="删除" okButtonProps={{ danger: true }} onConfirm={doBatchDelete} disabled={!selectedIds.length}>
            <Button danger icon={<DeleteOutlined />} loading={submitting} disabled={!selectedIds.length}>批量删除 {selectedIds.length || ''}</Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { importForm.resetFields(); setImportOpen(true); }}>批量导入库存</Button>
        </Space>
      </Space>
    </Card>
    {grouped.length === 0 ? <Card bordered={false} style={{ borderRadius: 16 }} loading={loading}><Empty description="暂无库存" /></Card> : <Row gutter={[16, 16]}>{grouped.map((group) => {
      const available = group.items.filter((item) => item.status === 'available').length;
      const sold = group.items.filter((item) => item.status === 'sold').length;
      return <Col xs={24} xl={12} key={group.product.id}><Card loading={loading} bordered={false} style={{ borderRadius: 18, overflow: 'hidden' }} title={<div><Text strong>{group.product.name}</Text><Text style={{ marginLeft: 10, color: '#94a3b8' }}>¥{Number(group.product.price || 0).toFixed(2)}</Text></div>} extra={<Space><Tag color="green">可售 {available}</Tag><Tag color="red">已售 {sold}</Tag></Space>}>
        <div style={{ display: 'grid', gap: 10 }}>{group.items.map((item) => {
          const meta = statusMeta[item.status] || { color: 'default', text: item.status };
          const locked = item.status === 'sold' || !!item.orderItemId;
          return <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, background: locked ? '#f8fafc' : '#fff', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <Space wrap><Checkbox disabled={locked} checked={selectedSet.has(item.id)} onChange={(event) => toggleOne(item.id, event.target.checked)} /><Tag color={meta.color}>{meta.text}</Tag><Text code>#{item.id}</Text><Text code style={{ color: '#64748b' }}>{item.shortHash || item.cardContentHash?.slice(0, 12)}...</Text></Space>
              <Space><Button size="small" icon={<EditOutlined />} disabled={locked} onClick={() => openEdit(item)}>修改</Button><Popconfirm title="确认删除这条库存？" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => doDelete(item)} disabled={locked}><Button size="small" danger icon={<DeleteOutlined />} disabled={locked}>删除</Button></Popconfirm></Space>
            </div>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>创建：{formatTime(item.createdAt)}{item.soldAt ? ' / 售出：' + formatTime(item.soldAt) : ''}</Text>
          </div>;
        })}</div>
      </Card></Col>;
    })}</Row>}
    <Modal title="批量导入库存" open={importOpen} onCancel={() => setImportOpen(false)} onOk={doImport} confirmLoading={submitting} width={720} okText="导入"><Alert type="info" showIcon message="每行一条卡密，系统会加密存储；重复内容会自动跳过。" style={{ marginBottom: 16 }} /><Form form={importForm} layout="vertical"><Form.Item name="productId" label="商品" rules={[{ required: true, message: '请选择商品' }]}><Select showSearch optionFilterProp="label" options={productOptions} placeholder="选择要导入库存的商品" /></Form.Item><Form.Item name="cardText" label="卡密内容" rules={[{ required: true, message: '请输入卡密内容' }]}><TextArea rows={12} placeholder={'账号----密码----备注\n账号----密码----备注\nCookie 或 Token 内容'} style={{ fontFamily: 'monospace' }} /></Form.Item></Form></Modal>
    <Modal title={'修改库存 #' + (editing?.id || '')} open={editOpen} onCancel={() => setEditOpen(false)} onOk={doEdit} confirmLoading={submitting} okText="保存"><Alert type="warning" showIcon message="出于安全原因，后台不回显明文卡密；如需修正卡密，请直接粘贴新的内容替换。" style={{ marginBottom: 16 }} /><Form form={editForm} layout="vertical"><Form.Item name="productId" label="所属商品" rules={[{ required: true, message: '请选择商品' }]}><Select showSearch optionFilterProp="label" options={productOptions} /></Form.Item><Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}><Select options={[{ label: '可售', value: 'available' }, { label: '预占', value: 'reserved' }]} /></Form.Item><Form.Item name="cardContent" label="替换卡密内容"><TextArea rows={6} placeholder="留空则不替换原卡密" style={{ fontFamily: 'monospace' }} /></Form.Item></Form></Modal>
  </div>;
}
