import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import Layout from './components/common/Layout';
import PrivateRoute from './components/auth/PrivateRoute';
import LoginPage from './pages/LoginPage';
import MainDashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import InventoryPage from './pages/InventoryPage';
import ExpensesPage from './pages/ExpensesPage';
import TransactionsPage from './pages/TransactionsPage';
import InventoryAnalyticsDashboard from './pages/InventoryAnalyticsDashboard';
import MenuPricingPage from './pages/MenuPricingPage';
import SalesReportPage from './pages/sales/SalesReportPage';
import SalesUploadPage from './pages/sales/SalesUploadPage';

function App() {
  return (
    <ConfigProvider locale={koKR}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<MainDashboardPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/inventory-analytics" element={<InventoryAnalyticsDashboard />} />
                    <Route path="/expenses" element={<ExpensesPage />} />
                    <Route path="/menu-pricing" element={<MenuPricingPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/sales" element={<SalesReportPage />} />
                    <Route path="/sales/upload" element={<SalesUploadPage />} />
                    {/* 예전 주소: 홈과 같은 화면이었으므로 매출 리포트로 연결 */}
                    <Route path="/analytics" element={<Navigate to="/sales" replace />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
