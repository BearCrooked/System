import { useState } from 'react';
import { Layout as AntLayout, Menu, Button, Space, Tag, Dropdown, Drawer } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EMPLOYEE_TYPE_LABELS } from '../types';

const { Header, Content } = AntLayout;

export default function AppLayout() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const handleMenuClick = (key: string) => {
    navigate(key);
    setDrawerOpen(false);
  };

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
          padding: '0 12px',
          background: '#001529',
        }}
      >
        {/* 移动端汉堡菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ color: '#fff', display: 'none' }}
            className="mobile-menu-btn"
          />
          <h1
            style={{
              color: '#fff',
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            工作量记录系统
          </h1>
          {/* 桌面端水平菜单 */}
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname.startsWith('/admin') ? '/admin' : '/dashboard']}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ flex: 1, minWidth: 160, background: 'transparent', borderBottom: 'none' }}
            className="desktop-menu"
          />
        </div>

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" style={{ color: '#fff', padding: '0 8px' }}>
            <Space size={4}>
              <UserOutlined />
              <span className="desktop-username">{profile?.name}</span>
              <DownOutlined style={{ fontSize: 10 }} />
            </Space>
          </Button>
        </Dropdown>
      </Header>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title="菜单"
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={240}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <UserOutlined />
            <strong>{profile?.name}</strong>
            <Tag color={isAdmin ? 'red' : 'blue'} style={{ fontSize: 11 }}>
              {isAdmin ? '管理员' : '用户'}
            </Tag>
          </Space>
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            {EMPLOYEE_TYPE_LABELS[profile?.employee_type || 'regular']}
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname.startsWith('/admin') ? '/admin' : '/dashboard']}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
        />
        <div style={{ padding: 16 }}>
          <Button danger block icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </Drawer>

      <Content style={{ padding: '12px' }} className="app-content">
        <Outlet />
      </Content>
    </AntLayout>
  );
}
