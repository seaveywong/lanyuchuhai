import{useState,useEffect}from'react';import{Card,Form,Input,InputNumber,Button,message,Divider}from'antd';import{adminApi}from'../../services/api';import{useAuthStore}from'../../store/authStore';
export default function Settings(){
  const[configs,setConfigs]=useState([]);const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[pwdSaving,setPwdSaving]=useState(false);const[userSaving,setUserSaving]=useState(false);
  const[form]=Form.useForm();const[pwdForm]=Form.useForm();const[userForm]=Form.useForm();
  const{admin,setAuth,accessToken}=useAuthStore();
  useEffect(()=>{adminApi.getPaymentConfigs().then(d=>setConfigs(d||[])).finally(()=>setLoading(false))},[]);
  const save=async method=>{try{const v=await form.validateFields();setSaving(true);await adminApi.savePaymentConfig({method,configJson:v,status:'active'});message.success('已保存');const d=await adminApi.getPaymentConfigs();setConfigs(d||[])}catch(e){if(e.message)message.error(e.message)}finally{setSaving(false)}};
  const getCfg=method=>configs.find(c=>c.method===method)?.config||{};

  const changePwd=async v=>{setPwdSaving(true);try{await adminApi.changePassword(v);message.success('密码已修改，下次登录生效');pwdForm.resetFields()}catch(e){message.error(e.message)}finally{setPwdSaving(false)}};

  const changeUser=async v=>{setUserSaving(true);try{const r=await adminApi.changeUsername(v);message.success('用户名已修改');setAuth(accessToken,{...admin,username:r.newUsername});userForm.resetFields()}catch(e){message.error(e.message)}finally{setUserSaving(false)}};

  if(loading)return null;
  return(<div><h2 style={{marginBottom:24}}>系统设置</h2>

    <Card title="管理员账号" style={{marginBottom:24,borderRadius:12}}>
      <div style={{display:'flex',gap:32,flexWrap:'wrap'}}>
        <div style={{flex:'1 1 300px'}}>
          <h4 style={{marginBottom:12}}>修改用户名</h4>
          <Form form={userForm} layout="vertical" onFinish={changeUser}>
            <Form.Item label="当前用户名"><Input value={admin?.username} disabled/></Form.Item>
            <Form.Item name="newUsername" label="新用户名" rules={[{required:true,min:3,message:'至少3位'}]}><Input placeholder="新用户名"/></Form.Item>
            <Form.Item name="password" label="密码确认" rules={[{required:true,message:'请输入密码确认身份'}]}><Input.Password placeholder="输入当前密码"/></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={userSaving}>修改用户名</Button></Form.Item>
          </Form>
        </div>
        <div style={{flex:'1 1 300px'}}>
          <h4 style={{marginBottom:12}}>修改密码</h4>
          <Form form={pwdForm} layout="vertical" onFinish={changePwd}>
            <Form.Item name="currentPassword" label="当前密码" rules={[{required:true}]}><Input.Password placeholder="当前密码"/></Form.Item>
            <Form.Item name="newPassword" label="新密码" rules={[{required:true,min:6,message:'至少6位'}]}><Input.Password placeholder="新密码"/></Form.Item>
            <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']} rules={[{required:true},{({getFieldValue})=>({validator(_,v){if(!v||getFieldValue('newPassword')===v)return Promise.resolve();return Promise.reject(new Error('两次不一致'))}})]}><Input.Password placeholder="再次输入"/></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={pwdSaving}>修改密码</Button></Form.Item>
          </Form>
        </div>
      </div>
    </Card>

    <Card title="客服配置" style={{marginBottom:24,borderRadius:12}} extra={<Button type="primary" onClick={()=>save('site_settings')} loading={saving}>保存</Button>}>
      <Form form={form} layout="vertical" initialValues={getCfg('site_settings')}>
        <Form.Item name="tgUsername" label="Telegram 用户名"><Input placeholder="your_username" addonBefore="@"/></Form.Item>
        <Form.Item name="tgUrl" label="TG 完整链接"><Input placeholder="https://t.me/xxx"/></Form.Item>
      </Form>
    </Card>

    <Card title="USDT-TRC20 支付" style={{borderRadius:12}} extra={<Button type="primary" onClick={()=>save('usdt_trc20')} loading={saving}>保存</Button>}>
      <Form form={form} layout="vertical" initialValues={getCfg('usdt_trc20')}>
        <Form.Item name="exchangeRate" label="汇率 (1 USDT = ? CNY)"><InputNumber min={0.1} max={100} step={0.1} precision={1} style={{width:200}} addonBefore="1 USDT =" addonAfter="CNY"/></Form.Item>
        <Divider>链上配置</Divider>
        <Form.Item name="trongridApiKey" label="TronGrid API Key"><Input placeholder="https://www.trongrid.io/ 获取"/></Form.Item>
        <Form.Item name="merchantAddress" label="收款地址"><Input placeholder="TRx..."/></Form.Item>
      </Form>
    </Card>
  </div>)}
