import { Layout as AntLayout, Menu, Button, Dropdown, Avatar, message } from 'antd';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  CreditCardOutlined,
  TransactionOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  TagsOutlined,
  RiseOutlined,
  LineChartOutlined,
  UploadOutlined,
  WalletOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = AntLayout;

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 메뉴를 업무 흐름별로 묶음: 매출 → 매입·비용 → 재고
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '홈',
    },
    {
      key: 'grp-sales',
      icon: <RiseOutlined />,
      label: '매출',
      children: [
        { key: '/sales', icon: <LineChartOutlined />, label: '매출 리포트' },
        { key: '/sales/product-trend', icon: <ShoppingOutlined />, label: '상품 판매 추이' },
        { key: '/sales/upload', icon: <UploadOutlined />, label: '매출 업로드' },
        { key: '/menu-pricing', icon: <TagsOutlined />, label: '메뉴 단가·원가' },
      ],
    },
    {
      key: 'grp-cost',
      icon: <WalletOutlined />,
      label: '매입·비용',
      children: [
        { key: '/orders', icon: <ShoppingCartOutlined />, label: '발주 관리' },
        { key: '/transactions', icon: <TransactionOutlined />, label: '세금계산서(거래내역)' },
        { key: '/expenses', icon: <CreditCardOutlined />, label: '법인카드' },
      ],
    },
    {
      key: 'grp-stock',
      icon: <InboxOutlined />,
      label: '재고',
      children: [
        { key: '/inventory', icon: <InboxOutlined />, label: '재고 관리' },
        { key: '/inventory-analytics', icon: <BarChartOutlined />, label: '재고 분석' },
      ],
    },
  ];

  // 상단 제목 표시용 (하위 메뉴까지 펼친 목록)
  const flatItems = menuItems.flatMap((item) => (item.children ? item.children.map((c) => ({ ...c, group: item.label })) : [item]));
  const currentItem = flatItems.find((item) => item.key === location.pathname);
  const [openKeys, setOpenKeys] = useState(['grp-sales', 'grp-cost', 'grp-stock']);

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    message.success('로그아웃되었습니다.');
    navigate('/login');
  };

  const username = localStorage.getItem('username') || 'User';

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="md"
        onBreakpoint={(broken) => setCollapsed(broken)}
        theme="dark"
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 16 : 20,
          fontWeight: 'bold',
        }}>
          {collapsed ? '🌱' : '🌱 틔움 관리자 페이지'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          style={{ textAlign: 'left' }}
          items={menuItems}
          {...(collapsed ? {} : { openKeys, onOpenChange: setOpenKeys })}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {currentItem ? (
              <>
                {currentItem.group && <span style={{ color: '#999', fontWeight: 400 }}>{currentItem.group} / </span>}
                {currentItem.label}
              </>
            ) : '틔움 관리자 페이지'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ color: '#666' }}>
              큰길 / 태광
            </div>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
                <span>{username}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          margin: '16px 24px',
          padding: '20px 32px',
          background: '#fff',
          borderRadius: 8,
          minWidth: 0,
        }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
