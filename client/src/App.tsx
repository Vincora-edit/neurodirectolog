import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Semantics from './pages/Semantics';
import Campaign from './pages/Campaign';
import Creatives from './pages/Creatives';
import Ads from './pages/Ads';
import Strategy from './pages/Strategy';
import MinusWords from './pages/MinusWords';
import KeywordAnalysis from './pages/KeywordAnalysis';
import Projects from './pages/Projects';
import ProjectForm from './pages/ProjectForm';
import Analytics from './pages/Analytics';
import ConnectYandex from './pages/ConnectYandex';
import ConnectYandexSimple from './pages/ConnectYandexSimple';
import YandexDashboard from './pages/YandexDashboard';
import AdminPanel from './pages/AdminPanel';
import Layout from './components/Layout';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  console.log('🎯 App component rendering');

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/new" element={<ProjectForm />} />
            <Route path="projects/:projectId/edit" element={<ProjectForm />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="semantics" element={<Semantics />} />
            <Route path="keyword-analysis" element={<KeywordAnalysis />} />
            <Route path="campaign" element={<Campaign />} />
            <Route path="creatives" element={<Creatives />} />
            <Route path="ads" element={<Ads />} />
            <Route path="strategy" element={<Strategy />} />
            <Route path="minus-words" element={<MinusWords />} />
            <Route path="connect-yandex" element={<ConnectYandex />} />
            <Route path="connect-yandex-simple" element={<ConnectYandexSimple />} />
            <Route path="yandex/callback" element={<ConnectYandex />} />
            <Route path="yandex-dashboard" element={<YandexDashboard />} />
            <Route path="admin" element={<AdminPanel />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
