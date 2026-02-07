import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Tabs, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

export default function Login() {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const { user, profile, login, register } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // 已登录用户自动跳转
  useEffect(() => {
    if (user && profile) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (values: { name: string; password: string }) => {
    setLoading(true);
    try {
      const action = activeTab === 'login' ? login : register;
      const result = await action(values.name, values.password);

      if (result.error) {
        message.error(result.error);
      } else {
        message.success(activeTab === 'login' ? '登录成功' : '注册成功');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: '92%',
          maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          borderRadius: 12,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            员工工作量记录系统
          </Title>
          <Text type="secondary">记录工作，计算薪资</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            form.resetFields();
          }}
          centered
          items={[
            { key: 'login', label: '登录' },
            { key: 'register', label: '注册' },
          ]}
        />

        <Form
          form={form}
          onFinish={handleSubmit}
          size="large"
          style={{ marginTop: 8 }}
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="姓名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              ...(activeTab === 'register'
                ? [
                    { min: 8, message: '密码至少8位' },
                    {
                      pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
                      message: '密码必须包含字母和数字',
                    },
                  ]
                : []),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={activeTab === 'register' ? '密码（至少8位，含字母和数字）' : '密码'}
              autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
            />
          </Form.Item>

          {activeTab === 'register' && (
            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认密码"
                autoComplete="new-password"
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {activeTab === 'login' ? '登录' : '注册'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
