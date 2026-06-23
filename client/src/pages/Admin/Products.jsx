
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';

const { Text } = Typography;
const statusOptions = [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }];

function flattenCategories(tree) {
  const rows = [];
  tree.forEach((root) => {
    rows.push({ ...root, level: 1 });
    (root.children || []).forEach((child) => rows.push({ ...child, level: 2, parentName: root.name }));
  });
  return rows;
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productOpen, setProductOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [productForm] = Form.useForm();
  const [categoryForm] = Form.useForm();

  const roots = categories;
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const leafOptions = categories.flatMap((root) => (root.children || []).map((child) => ({ label: root.name + ' / ' + child.name, value: child.id })));
  const parentOptions = roots.map((item) => ({ label: item.name, value: item.id }));

  const load = async () => {
    setLoading(true);
    try {
      const [productResult, categoryResult] = await Promise.all([adminApi.getProducts({ limit: 300 }), adminApi.getCategories({ tree: 1 })]);
      setProducts(productResult.items || []);
      setCategories(categoryResult || []);
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreateProduct = () => { setEditingProduct(null); productForm.resetFields(); productForm.setFieldsValue({ currency: 'CNY', status: 'active', stockVisible: true, sortOrder: 0 }); setProductOpen(true); };
  const openEditProduct = (item) => { setEditingProduct(item); productForm.setFieldsValue({ name: item.name, description: item.description, price: Number(item.price), currency: item.currency || 'CNY', categoryId: item.categoryId, coverImage: item.coverImage, sortOrder: item.sortOrder || 0, status: item.status || 'active', stockVisible: item.stockVisible !== false }); setProductOpen(true); };
  const saveProduct = async () => {
    try {
      const values = await productForm.validateFields();
      setSaving(true);
      if (editingProduct) await adminApi.updateProduct(editingProduct.id, values);
      else await adminApi.createProduct(values);
      message.success('商品已保存'); setProductOpen(false); await load();
    } catch (err) { if (err.message) message.error(err.message); } finally { setSaving(false); }
  };
  const deleteProduct = async (id) => { try { await adminApi.deleteProduct(id); message.success('商品已删除'); await load(); } catch (err) { message.error(err.message || '删除失败'); } };

  const openCreateRoot = () => { setEditingCategory(null); categoryForm.resetFields(); categoryForm.setFieldsValue({ parentId: null, status: 'active', sortOrder: 0 }); setCategoryOpen(true); };
  const openCreateChild = (parentId) => { setEditingCategory(null); categoryForm.resetFields(); categoryForm.setFieldsValue({ parentId, status: 'active', sortOrder: 0 }); setCategoryOpen(true); };
  const openEditCategory = (item) => { setEditingCategory(item); categoryForm.setFieldsValue({ name: item.name, slug: item.slug, parentId: item.parentId || null, sortOrder: item.sortOrder || 0, status: item.status || 'active' }); setCategoryOpen(true); };
  const saveCategory = async () => {
    try {
      const values = await categoryForm.validateFields();
      setSaving(true);
      const payload = { ...values, parentId: values.parentId || null };
      if (editingCategory) await adminApi.updateCategory(editingCategory.id, payload);
      else await adminApi.createCategory(payload);
      message.success('分类已保存'); setCategoryOpen(false); await load();
    } catch (err) { if (err.message) message.error(err.message); } finally { setSaving(false); }
  };
  const deleteCategory = async (id) => { try { await adminApi.deleteCategory(id); message.success('分类已删除'); await load(); } catch (err) { message.error(err.message || '删除失败'); } };

  const productColumns = [
    { title: '商品', dataIndex: 'name', render: (value, row) => <div><Text strong>{value}</Text><div style={{ color: '#94a3b8', fontSize: 12 }}>{row.description || '-'}</div></div> },
    { title: '分类', width: 180, render: (_, row) => <Space wrap>{row.category?.parent && <Tag>{row.category.parent.name}</Tag>}<Tag color="blue">{row.category?.name}</Tag></Space> },
    { title: '价格', width: 110, render: (_, row) => <Text strong>¥{Number(row.price || 0).toFixed(2)}</Text> },
    { title: '库存', width: 90, render: (_, row) => <Tag>{row._count?.inventory || 0}</Tag> },
    { title: '状态', width: 90, render: (_, row) => <Tag color={row.status === 'active' ? 'green' : 'default'}>{row.status === 'active' ? '启用' : '停用'}</Tag> },
    { title: '操作', width: 150, render: (_, row) => <Space><Button size="small" icon={<EditOutlined />} onClick={() => openEditProduct(row)}>编辑</Button><Popconfirm title="确认删除商品？" onConfirm={() => deleteProduct(row.id)}><Button size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> },
  ];

  const categoryColumns = [
    { title: '分类', dataIndex: 'name', render: (value, row) => <Space><Tag color={row.level === 1 ? 'geekblue' : 'blue'}>{row.level === 1 ? '父级' : '子级'}</Tag><Text strong={row.level === 1}>{value}</Text>{row.parentName && <Text style={{ color: '#94a3b8' }}>属于 {row.parentName}</Text>}</Space> },
    { title: 'Slug', dataIndex: 'slug', width: 170, render: (value) => <Text code>{value}</Text> },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    { title: '状态', width: 90, render: (_, row) => <Tag color={row.status === 'active' ? 'green' : 'default'}>{row.status === 'active' ? '启用' : '停用'}</Tag> },
    { title: '操作', width: 230, render: (_, row) => <Space><Button size="small" icon={<EditOutlined />} onClick={() => openEditCategory(row)}>编辑</Button>{row.level === 1 && <Button size="small" icon={<PlusOutlined />} onClick={() => openCreateChild(row.id)}>加子类</Button>}<Popconfirm title="确认删除分类？" onConfirm={() => deleteCategory(row.id)}><Button size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> },
  ];

  return <div>
    <div style={{ marginBottom: 20 }}><Text style={{ display: 'block', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>商品与分类</Text><Text style={{ color: '#64748b' }}>父级分类和子级分类都可新增、修改、停用；商品必须挂到子级分类。</Text></div>
    <Tabs items={[
      { key: 'products', label: '商品管理', children: <Card bordered={false} style={{ borderRadius: 16 }} extra={<Space><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreateProduct}>新增商品</Button></Space>}><Table rowKey="id" loading={loading} columns={productColumns} dataSource={products} pagination={{ pageSize: 20 }} /></Card> },
      { key: 'categories', label: '分类管理', children: <Row gutter={[16, 16]}><Col xs={24} lg={8}><Card bordered={false} style={{ borderRadius: 16 }} title="分类结构" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateRoot}>新增父级</Button>}>{roots.map((root) => <Card key={root.id} size="small" style={{ marginBottom: 12, borderRadius: 12 }} title={<Space><Tag color="geekblue">父级</Tag>{root.name}</Space>} extra={<Space><Button size="small" onClick={() => openEditCategory(root)}>编辑</Button><Button size="small" onClick={() => openCreateChild(root.id)}>加子类</Button></Space>}>{(root.children || []).length ? <Space wrap>{root.children.map((child) => <Tag key={child.id} color="blue" style={{ cursor: 'pointer' }} onClick={() => openEditCategory(child)}>{child.name}</Tag>)}</Space> : <Text style={{ color: '#94a3b8' }}>暂无子类</Text>}</Card>)}</Card></Col><Col xs={24} lg={16}><Card bordered={false} style={{ borderRadius: 16 }}><Table rowKey="id" loading={loading} columns={categoryColumns} dataSource={flatCategories} pagination={false} /></Card></Col></Row> },
    ]} />

    <Modal title={editingProduct ? '编辑商品' : '新增商品'} open={productOpen} onCancel={() => setProductOpen(false)} onOk={saveProduct} confirmLoading={saving} width={720} okText="保存">
      <Form form={productForm} layout="vertical"><Row gutter={16}><Col xs={24} md={12}><Form.Item name="name" label="商品名" rules={[{ required: true, message: '请输入商品名' }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item name="categoryId" label="子级分类" rules={[{ required: true, message: '请选择子级分类' }]}><Select showSearch optionFilterProp="label" options={leafOptions} /></Form.Item></Col><Col xs={24}><Form.Item name="description" label="商品描述"><Input.TextArea rows={3} /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="price" label="价格" rules={[{ required: true, message: '请输入价格' }]}><InputNumber min={0.01} precision={2} style={{ width: '100%' }} /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="currency" label="币种"><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="sortOrder" label="排序"><InputNumber precision={0} style={{ width: '100%' }} /></Form.Item></Col><Col xs={24}><Form.Item name="coverImage" label="封面图 URL"><Input placeholder="/assets/example.svg 或 https://..." /></Form.Item></Col><Col xs={24} md={12}><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Col><Col xs={24} md={12}><Form.Item name="stockVisible" label="显示库存状态" valuePropName="checked"><Switch checkedChildren="显示" unCheckedChildren="隐藏" /></Form.Item></Col></Row></Form>
    </Modal>
    <Modal title={editingCategory ? '编辑分类' : '新增分类'} open={categoryOpen} onCancel={() => setCategoryOpen(false)} onOk={saveCategory} confirmLoading={saving} okText="保存">
      <Form form={categoryForm} layout="vertical"><Form.Item name="name" label="分类名" rules={[{ required: true, message: '请输入分类名' }]}><Input /></Form.Item><Form.Item name="slug" label="Slug"><Input placeholder="留空则自动生成" /></Form.Item><Form.Item name="parentId" label="父级分类"><Select allowClear placeholder="留空表示父级分类" options={parentOptions.filter((item) => item.value !== editingCategory?.id)} /></Form.Item><Form.Item name="sortOrder" label="排序"><InputNumber precision={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="status" label="状态"><Select options={statusOptions} /></Form.Item></Form>
    </Modal>
  </div>;
}
