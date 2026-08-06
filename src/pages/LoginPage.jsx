import { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (values) => {
    setLoading(true);

    // 하드코딩된 인증 정보 (나중에 변경 가능)
    const validUsername = 'tium';
    const validPassword = 'tium2026!';

    setTimeout(() => {
      if (values.username === validUsername && values.password === validPassword) {
        // 로그인 성공
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('username', values.username);
        message.success('로그인 성공!');
        navigate('/');
      } else {
        // 로그인 실패
        message.error('아이디 또는 비밀번호가 올바르지 않습니다.');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            🌱 틔움 관리자 페이지
          </Title>
          <Typography.Text type="secondary">
            로그인하여 시스템에 접속하세요
          </Typography.Text>
        </div>

        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '아이디를 입력하세요' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="아이디"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력하세요' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ height: 45 }}
            >
              로그인
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            © 2026 틔움 관리자 페이지. All rights reserved.
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
