import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Row, Space, Switch, Tabs, Tag, Typography, message } from 'antd';
import { CustomerServiceOutlined, LockOutlined, PayCircleOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import TronWalletPanel from '../../components/admin/TronWalletPanel';

const { Text } = Typography;

function getRow(rows, method) {
  return rows.find((item) => item.method === method) || null;
}

function getCfg(rows, method) {
  return getRow(rows, method)?.config || {};
}

function enabled(rows, method) {
  return getRow(rows, method)?.status === 'active';
}

function requiredWhenEnabled(form, label) {
  return {
    validator(_, value) {
      if (!form.getFieldValue('enabled') || value) return Promise.resolve();
      return Promise.reject(new Error(`启用后必须填写${label}`));
    },
  };
}

function GatewayForm({ form, method, title, description, saving, onSave }) {
  return (
    <Card bordered={false} style={{ borderRadius: 16 }} title={<Space><PayCircleOutlined />{title}</Space>} extra={<Button type="primary" loading={saving === method} onClick={() => onSave(method, form)}>保存</Button>}>
      <Alert type="info" showIcon message={description} style={{ marginBottom: 18 }} />
      <Form form={form} layout="vertical">
        <Form.Item name="enabled" label="启用通道" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Form.Item name="gatewayUrl" label="支付网关地址" rules={[requiredWhenEnabled(form, '支付网关地址')]}>
              <Input placeholder="https://pay.example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="appId" label="商户号 / PID" rules={[requiredWhenEnabled(form, '商户号')]}>
              <Input placeholder="商户号" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="appSecret" label="商户密钥" rules={[requiredWhenEnabled(form, '商户密钥')]}>
              <Input.Password placeholder="商户密钥" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="productName" label="支付商品名">
              <Input placeholder="数字商品" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="notifyUrl" label="异步回调地址">
              <Input placeholder="留空则由系统生成 /api/callback/..." />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="returnUrl" label="同步返回地址">
              <Input placeholder="留空则自动返回订单页" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [supportForm] = Form.useForm();
  const [usdtForm] = Form.useForm();
  const [alipayForm] = Form.useForm();
  const [wechatForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [usernameForm] = Form.useForm();
  const { admin, setAuth, accessToken } = useAuthStore();

  const load = async () => {
    const rows = await adminApi.getPaymentConfigs();
    supportForm.setFieldsValue({ supportEnabled: true, ...getCfg(rows, 'site_settings') });
    usdtForm.setFieldsValue({ enabled: enabled(rows, 'usdt_trc20'), exchangeRate: 7, ...getCfg(rows, 'usdt_trc20') });
    alipayForm.setFieldsValue({ enabled: enabled(rows, 'alipay'), productName: '数字商品', ...getCfg(rows, 'alipay') });
    wechatForm.setFieldsValue({ enabled: enabled(rows, 'wechat'), productName: '数字商品', ...getCfg(rows, 'wechat') });
  };

  useEffect(() => {
    load().catch((err) => message.error(err.message || '配置加载失败')).finally(() => setLoading(false));
  }, []);

  const saveConfig = async (method, form) => {
    try {
      const values = await form.validateFields();
      const { enabled: isEnabled, ...configJson } = values;
      setSaving(method);
      await adminApi.savePaymentConfig({ method, status: method === 'site_settings' || isEnabled ? 'active' : 'inactive', configJson: method === 'site_settings' ? values : configJson });
      message.success('配置已保存');
      await load();
    } catch (err) {
      if (err.message) message.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async (values) => {
    setPasswordSaving(true);
    try {
      await adminApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      message.success('密码已修改');
      passwordForm.resetFields();
    } catch (err) {
      message.error(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const changeUsername = async (values) => {
    setUsernameSaving(true);
    try {
      const result = await adminApi.changeUsername(values);
      setAuth(accessToken, { ...admin, username: result.newUsername });
      usernameForm.resetFields();
      message.success('用户名已修改');
    } catch (err) {
      message.error(err.message);
    } finally {
      setUsernameSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Text style={{ display: 'block', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>支付与客服</Text>
        <Text style={{ color: '#64748b' }}>支付通道、客服入口和管理员账号集中配置；未配置完整的通道不会出现在前台。</Text>
      </div>

      <Tabs
        defaultActiveKey="payment"
        items={[
          {
            key: 'payment',
            label: '支付通道',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card bordered={false} style={{ borderRadius: 16 }} title={<Space><PayCircleOutlined />USDT-TRC20</Space>} extra={<Button type="primary" loading={saving === 'usdt_trc20'} onClick={() => saveConfig('usdt_trc20', usdtForm)}>保存</Button>}>
                  <Alert type="warning" showIcon message="USDT 使用地址池分配和 TXID 链上核验。先配置 TronGrid API Key，再在下方添加至少一个公开收款地址。" style={{ marginBottom: 18 }} />
                  <Form form={usdtForm} layout="vertical">
                    <Form.Item name="enabled" label="启用通道" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
                    <Row gutter={16}>
                      <Col xs={24} md={8}><Form.Item name="exchangeRate" label="汇率：1 USDT = ? CNY" rules={[{ required: true, message: '请填写汇率' }]}><InputNumber min={0.1} max={100} step={0.1} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col xs={24}><Form.Item name="trongridApiKey" label="TronGrid API Key"><Input.Password placeholder="用于后续链上自动核验，可先留空" /></Form.Item></Col>
                    </Row>
                  </Form>
                </Card>
                <TronWalletPanel />
                <GatewayForm form={alipayForm} method="alipay" title="支付宝" description="预埋易支付 / 聚合支付兼容接口：填写网关、商户号和密钥后即可启用。" saving={saving} onSave={saveConfig} />
                <GatewayForm form={wechatForm} method="wechat" title="微信支付" description="预埋微信/聚合支付兼容接口：与支付宝使用同一套签名和回调结构。" saving={saving} onSave={saveConfig} />
              </Space>
            ),
          },
          {
            key: 'support',
            label: '客服入口',
            children: (
              <Card bordered={false} style={{ borderRadius: 16 }} title={<Space><CustomerServiceOutlined />前台客服</Space>} extra={<Button type="primary" loading={saving === 'site_settings'} onClick={() => saveConfig('site_settings', supportForm)}>保存</Button>}>
                <Form form={supportForm} layout="vertical">
                  <Form.Item name="supportEnabled" label="启用客服入口" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
                  <Row gutter={16}>
                    <Col xs={24} md={12}><Form.Item name="supportTitle" label="客服标题"><Input placeholder="联系客服" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="businessHours" label="服务时间"><Input placeholder="工作日 10:00-22:00" /></Form.Item></Col>
                    <Col xs={24}><Form.Item name="supportText" label="客服说明"><Input.TextArea rows={3} placeholder="下单前后如需确认库存、支付或交付，请联系人工客服。" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="tgUsername" label="Telegram 用户名"><Input addonBefore="@" placeholder="your_username" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="tgUrl" label="Telegram 完整链接"><Input placeholder="https://t.me/your_username" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="whatsapp" label="WhatsApp"><Input placeholder="+1..." /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="email" label="客服邮箱"><Input placeholder="support@example.com" /></Form.Item></Col>
                  </Row>
                </Form>
              </Card>
            ),
          },
          {
            key: 'account',
            label: '账号安全',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card bordered={false} style={{ borderRadius: 16 }} title={<Space><UserOutlined />修改用户名</Space>}>
                    <Form form={usernameForm} layout="vertical" onFinish={changeUsername}>
                      <Form.Item label="当前用户名"><Input value={admin?.username} disabled /></Form.Item>
                      <Form.Item name="newUsername" label="新用户名" rules={[{ required: true, min: 3, message: '至少 3 位' }]}><Input /></Form.Item>
                      <Form.Item name="password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}><Input.Password /></Form.Item>
                      <Button type="primary" htmlType="submit" loading={usernameSaving}>保存用户名</Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card bordered={false} style={{ borderRadius: 16 }} title={<Space><SafetyOutlined />修改密码</Space>}>
                    <Form form={passwordForm} layout="vertical" onFinish={changePassword}>
                      <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true }]}><Input.Password prefix={<LockOutlined />} /></Form.Item>
                      <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8, message: '至少 8 位' }]}><Input.Password /></Form.Item>
                      <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')); } })]}><Input.Password /></Form.Item>
                      <Button type="primary" htmlType="submit" loading={passwordSaving}>保存密码</Button>
                    </Form>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
}
