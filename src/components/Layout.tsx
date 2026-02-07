import { Layout as AntLayout, Menu, Button, Space, Tag, Dropdown } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EMPLOYEE_TYPE_LABELS } from '../types';

const { Header, Content } = AntLayout;

export default function AppLayout() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = profile?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <HomeOutlined />,
      label: '工作台',
    },
    ...(isAdmin
      ? [
          {
            key: '/admin',
            icon: <SettingOutlined />,
            label: '管理面板',
          },
        ]
      : []),
  ];

  const userMenuItems = [
    {
      key: 'info',
      label: (
        <Space>
          <span>身份: {EMPLOYEE_TYPE_LABELS[profile?.employee_type || 'regular']}</span>
          <Tag color={isAdmin ? 'red' : 'blue'}>{isAdmin ? '管理员' : '用户'}</Tag>
        </Space>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: '#001529',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1
            style={{
              color: '#fff',
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            工作量记录系统
          </h1>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname.startsWith('/admin') ? '/admin' : '/dashboard']}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ flex: 1, minWidth: 200, background: 'transparent', borderBottom: 'none' }}
          />
        </div>

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" style={{ color: '#fff' }}>
            <Space>
              <UserOutlined />
              {profile?.name}
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      </Header>

      <Content style={{ padding: '24px', background: '#f5f5f5' }}>
        <Outlet />
      </Content>
    </AntLayout>
  );
}
