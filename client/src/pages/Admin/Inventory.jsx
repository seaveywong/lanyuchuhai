import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, Upload, message } from 'antd';
import { DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';

const { Text } = Typography;
const { TextArea } = Input;
const MAX_WORKBOOK_BYTES = 8 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
const statusMeta = {
  available: { color: 'green', text: '可售' },
  reserved: { color: 'blue', text: '预占' },
  sold: { color: 'red', text: '已售' },
};

function formatTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function isLocked(item) {
  return item.status === 'sold' || Boolean(item.orderItemId);
}

function cellToText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

async function readInventoryWorkbook(file, skipFirstRow) {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('仅支持 .xlsx 文件，请将旧版 Excel 另存为 .xlsx 后导入');
  if (file.size > MAX_WORKBOOK_BYTES) throw new Error('Excel 文件不能超过 8MB');

  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const rows = await readXlsxFile(file);
  return rows
    .slice(skipFirstRow ? 1 : 0)
    .map((row) => row.map(cellToText).filter(Boolean).join('----').trim())
    .filter(Boolean);
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [productFilter, setProductFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchType, setSearchType] = useState('orderNo');
  const [searchValue, setSearchValue] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchLabel, setSearchLabel] = useState('');
  const [importForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const productOptions = products.map((item) => ({ label: item.name + ' / ¥' + Number(item.price || 0).toFixed(2), value: item.id }));
  const deletableItems = items.filter((item) => !isLocked(item));
  const allDeletableSelected = deletableItems.length > 0 && deletableItems.every((item) => selectedIds.includes(item.id));
  const stats = useMemo(() => ({
    total: items.length,
    available: items.filter((item) => item.status === 'available').length,
    reserved: items.filter((item) => item.status === 'reserved').length,
    sold: items.filter((item) => item.status === 'sold').length,
  }), [items]);

  const load = async () => {
    setLoading(true);
    setSearchLabel('');
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

  const doSearch = async () => {
    const query = searchValue.trim();
    if (!query) return message.warning(searchType === 'orderNo' ? '请输入订单号' : '请输入完整卡密内容');

    setSearching(true);
    try {
      const result = await adminApi.searchInventory({ type: searchType, query });
      setItems(result.items || []);
      setSelectedIds([]);
      setSearchLabel(searchType === 'orderNo' ? '订单号：' + query : '卡密精确匹配');
      if (searchType === 'cardContent') setSearchValue('');
      message.success('找到 ' + (result.total || 0) + ' 条库存');
    } catch (err) {
      message.error(err.message || '检索失败');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = async () => {
    setSearchValue('');
    await load();
  };

  const doImport = async () => {
    try {
      const values = await importForm.validateFields();
      setSubmitting(true);
      const typedCards = (values.cardText || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const excelCards = importFile ? await readInventoryWorkbook(importFile, values.skipFirstRow !== false) : [];
      const cards = Array.from(new Set([...typedCards, ...excelCards]));
      if (!cards.length) throw new Error('请粘贴卡密内容或选择 Excel 文件');
      if (cards.length > MAX_IMPORT_ROWS) throw new Error('单次最多导入 ' + MAX_IMPORT_ROWS + ' 条，请拆分 Excel 后重试');

      let imported = 0;
      let skipped = 0;
      message.loading({ key: 'inventory-import', content: '正在加密并导入 ' + cards.length + ' 条库存...', duration: 0 });
      for (let start = 0; start < cards.length; start += 1000) {
        const result = await adminApi.batchImport({ productId: values.productId, cards: cards.slice(start, start + 1000), skipDuplicates: true });
        imported += result.imported || 0;
        skipped += result.skipped || 0;
      }
      message.success({ key: 'inventory-import', content: '已导入 ' + imported + ' 条，跳过 ' + skipped + ' 条重复库存' });
      setImportOpen(false);
      setImportFile(null);
      importForm.resetFields();
      await load();
    } catch (err) {
      message.destroy('inventory-import');
      if (err.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item) => {
    setEditing(item);
    editForm.setFieldsValue({ productId: item.productId, status: item.status });
    setEditOpen(true);
  };

  const doEdit = async () => {
    if (!editing) return;
    try {
      const values = await editForm.validateFields();
      const payload = { productId: values.productId, status: values.status };
      if (values.cardContent?.trim()) payload.cardContent = values.cardContent.trim();
      setSubmitting(true);
      await adminApi.updateInventory(editing.id, payload);
      message.success('库存已更新');
      setEditOpen(false);
      setEditing(null);
      editForm.resetFields();
      await load();
    } catch (err) {
      if (err.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async (item) => {
    try {
      await adminApi.deleteInventory(item.id);
      message.success('库存已删除');
      await load();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const doBatchDelete = async () => {
    if (!selectedIds.length) return;
    try {
      setSubmitting(true);
      const result = await adminApi.batchDeleteInventory(selectedIds);
      message.success('已删除 ' + result.deleted + ' 条，跳过 ' + result.skipped + ' 条已售或锁定库存');
      await load();
    } catch (err) {
      message.error(err.message || '批量删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  const tableColumns = [
    { title: '库存编号', dataIndex: 'id', width: 96, render: (value) => <Text code>#{value}</Text> },
    { title: '商品', dataIndex: 'product', ellipsis: true, render: (product) => <Space direction="vertical" size={0}><Text strong>{product?.name || '-'}</Text><Text type="secondary" style={{ fontSize: 12 }}>¥{Number(product?.price || 0).toFixed(2)}</Text></Space> },
    { title: '状态', dataIndex: 'status', width: 90, render: (value) => <Tag color={(statusMeta[value] || {}).color}>{(statusMeta[value] || {}).text || value}</Tag> },
    { title: '卡密指纹', dataIndex: 'shortHash', width: 160, render: (value) => <Text code copyable={{ text: value || '' }}>{value || '-'}</Text> },
    { title: '关联订单', key: 'orderNo', width: 180, render: (_, item) => item.orderItem?.order?.orderNo ? <Text code copyable={{ text: item.orderItem.order.orderNo }}>{item.orderItem.order.orderNo}</Text> : <Text type="secondary">未关联</Text> },
    { title: '入库时间', dataIndex: 'createdAt', width: 165, render: (value) => <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(value)}</Text> },
    { title: '操作', key: 'action', width: 160, fixed: 'right', render: (_, item) => <Space size="small"><Button size="small" icon={<EditOutlined />} disabled={isLocked(item)} onClick={() => openEdit(item)}>修改</Button><Popconfirm title="确认删除这条库存？" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => doDelete(item)} disabled={isLocked(item)}><Button size="small" danger icon={<DeleteOutlined />} disabled={isLocked(item)}>删除</Button></Popconfirm></Space> },
  ];

  return <div>
    <div style={{ marginBottom: 20 }}>
      <Text style={{ display: 'block', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>库存工作台</Text>
      <Text style={{ color: '#64748b' }}>Excel 批量入库、订单与卡密精确检索、库存修改和批量删除统一管理。</Text>
    </div>

    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="当前结果" value={stats.total} prefix={<InboxOutlined />} /></Card></Col>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="可售" value={stats.available} valueStyle={{ color: '#16a34a' }} /></Card></Col>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="预占" value={stats.reserved} valueStyle={{ color: '#2563eb' }} /></Card></Col>
      <Col xs={12} md={6}><Card bordered={false} style={{ borderRadius: 16 }}><Statistic title="已售" value={stats.sold} valueStyle={{ color: '#dc2626' }} /></Card></Col>
    </Row>

    <Card bordered={false} style={{ borderRadius: 16, marginBottom: 16 }}>
      <Space wrap size={[10, 10]} style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select allowClear showSearch optionFilterProp="label" placeholder="按商品筛选" value={productFilter} onChange={setProductFilter} options={productOptions} style={{ minWidth: 240 }} />
          <Select allowClear placeholder="按状态筛选" value={statusFilter} onChange={setStatusFilter} options={[{ label: '可售', value: 'available' }, { label: '预占', value: 'reserved' }, { label: '已售', value: 'sold' }]} style={{ width: 130 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
        <Space wrap>
          <Select value={searchType} onChange={setSearchType} options={[{ label: '订单号', value: 'orderNo' }, { label: '完整卡密', value: 'cardContent' }]} style={{ width: 118 }} />
          <Input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} onPressEnter={doSearch} placeholder={searchType === 'orderNo' ? '精确订单号' : '粘贴完整卡密'} style={{ width: 220 }} />
          <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={doSearch}>检索</Button>
          {searchLabel && <Button onClick={clearSearch}>返回列表</Button>}
        </Space>
      </Space>
      {searchType === 'cardContent' && <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>卡密仅用于本次 HTTPS 请求的哈希匹配，不会显示在结果、URL 或操作日志中。</Text>}
    </Card>

    <Card bordered={false} style={{ borderRadius: 16 }} title={<Space><span>库存明细</span>{searchLabel && <Tag color="blue">{searchLabel}</Tag>}</Space>} extra={<Space wrap><Button onClick={() => setSelectedIds(allDeletableSelected ? [] : deletableItems.map((item) => item.id))}>{allDeletableSelected ? '取消全选' : '全选可删除'}{deletableItems.length ? ' (' + deletableItems.length + ')' : ''}</Button><Popconfirm title={'确认批量删除选中的 ' + selectedIds.length + ' 条库存？'} okText="删除" okButtonProps={{ danger: true }} onConfirm={doBatchDelete} disabled={!selectedIds.length}><Button danger icon={<DeleteOutlined />} loading={submitting} disabled={!selectedIds.length}>批量删除 {selectedIds.length || ''}</Button></Popconfirm><Button type="primary" icon={<PlusOutlined />} onClick={() => { importForm.resetFields(); importForm.setFieldsValue({ skipFirstRow: true }); setImportFile(null); setImportOpen(true); }}>Excel 导入</Button></Space>}>
      {items.length === 0 && !loading ? <Empty description="暂无库存" /> : <Table rowKey="id" loading={loading} columns={tableColumns} dataSource={items} scroll={{ x: 1020 }} rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds, preserveSelectedRowKeys: true, getCheckboxProps: (item) => ({ disabled: isLocked(item) }) }} pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'], showTotal: (total, range) => '第 ' + range[0] + '-' + range[1] + ' 条，共 ' + total + ' 条' }} />}
    </Card>

    <Modal title="Excel 批量导入库存" open={importOpen} onCancel={() => { setImportOpen(false); setImportFile(null); }} onOk={doImport} confirmLoading={submitting} width={720} okText="导入">
      <Alert type="info" showIcon message="Excel 仅在浏览器本地解析，提交时逐条加密入库；重复卡密会自动跳过。" description="使用首个工作表：每行一条库存，单列会原样导入，多列将按 ---- 合并。支持 .xlsx，单文件最大 8MB，单次最多 5,000 条。" style={{ marginBottom: 16 }} />
      <Form form={importForm} layout="vertical" initialValues={{ skipFirstRow: true }}>
        <Form.Item name="productId" label="商品" rules={[{ required: true, message: '请选择商品' }]}><Select showSearch optionFilterProp="label" options={productOptions} placeholder="选择要导入库存的商品" /></Form.Item>
        <Form.Item label="Excel 文件（可选）" extra="旧版 .xls 请先另存为 .xlsx。"><Upload accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" maxCount={1} beforeUpload={() => false} onChange={({ fileList }) => setImportFile(fileList[0]?.originFileObj || null)} onRemove={() => { setImportFile(null); return true; }}><Button icon={<UploadOutlined />}>选择 Excel 文件</Button></Upload></Form.Item>
        <Form.Item name="skipFirstRow" valuePropName="checked"><Checkbox>第一行是表头，不导入</Checkbox></Form.Item>
        <Form.Item name="cardText" label="或直接粘贴卡密内容" extra="一行一条；可与 Excel 文件合并导入。"><TextArea rows={8} placeholder={'账号----密码----备注\n账号----密码----备注\nCookie 或 Token 内容'} style={{ fontFamily: 'monospace' }} /></Form.Item>
      </Form>
    </Modal>

    <Modal title={'修改库存 #' + (editing?.id || '')} open={editOpen} onCancel={() => setEditOpen(false)} onOk={doEdit} confirmLoading={submitting} okText="保存">
      <Alert type="warning" showIcon message="出于安全原因，后台不回显明文卡密；如需修正卡密，请直接粘贴新的内容替换。" style={{ marginBottom: 16 }} />
      <Form form={editForm} layout="vertical">
        <Form.Item name="productId" label="所属商品" rules={[{ required: true, message: '请选择商品' }]}><Select showSearch optionFilterProp="label" options={productOptions} /></Form.Item>
        <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}><Select options={[{ label: '可售', value: 'available' }, { label: '预占', value: 'reserved' }]} /></Form.Item>
        <Form.Item name="cardContent" label="替换卡密内容"><TextArea rows={6} placeholder="留空则不替换原卡密" style={{ fontFamily: 'monospace' }} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
