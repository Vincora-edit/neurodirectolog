import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { Spinner } from './components/ui/Spinner';
import Layout from './components/Layout';

// Lazy loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Semantics = lazy(() => import('./pages/Semantics'));
const Campaign = lazy(() => import('./pages/Campaign'));
const Creatives = lazy(() => import('./pages/Creatives'));
const Ads = lazy(() => import('./pages/Ads'));
const Strategy = lazy(() => import('./pages/Strategy'));
const MinusWords = lazy(() => import('./pages/MinusWords'));
const KeywordAnalysis = lazy(() => import('./pages/KeywordAnalysis'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectForm = lazy(() => import('./pages/ProjectForm'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ConnectYandex = lazy(() => import('./pages/ConnectYandex'));
const ConnectYandexSimple = lazy(() => import('./pages/ConnectYandexSimple'));
const YandexDashboard = lazy(() => import('./pages/YandexDashboard').then(m => ({ default: m.YandexDashboard })));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  console.log('🎯 App component rendering');

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
