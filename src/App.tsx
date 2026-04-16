import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import HomePage from "./pages/HomePage";

// Lazy-load non-landing routes to reduce initial JS bundle size
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const ConceptsPage = lazy(() => import("./pages/ConceptsPage"));
const SubQuestionsPage = lazy(() => import("./pages/SubQuestionsPage"));
const PovGroupingPage = lazy(() => import("./pages/PovGroupingPage"));
const SubQuestionAnalysisPage = lazy(() => import("./pages/SubQuestionAnalysisPage"));
const AssumptionsPage = lazy(() => import("./pages/AssumptionsPage"));
const SynthesisPage = lazy(() => import("./pages/SynthesisPage"));
const ConsequencesPage = lazy(() => import("./pages/ConsequencesPage"));
const ImplicationsPage = lazy(() => import("./pages/ImplicationsPage"));
const PublicViewPage = lazy(() => import("./pages/PublicViewPage"));
const FrameworkPage = lazy(() => import("./pages/FrameworkPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground font-display">Loading...</div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function VisitorTracker() {
  useVisitorTracking();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <VisitorTracker />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/analysis/:id" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/concepts" element={<ProtectedRoute><ConceptsPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/sub-questions" element={<ProtectedRoute><SubQuestionsPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/pov-grouping" element={<ProtectedRoute><PovGroupingPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/sub-question/:subQuestionId" element={<ProtectedRoute><SubQuestionAnalysisPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/sub-question/:subQuestionId/assumptions" element={<ProtectedRoute><AssumptionsPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/synthesis" element={<ProtectedRoute><SynthesisPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/consequences" element={<ProtectedRoute><ConsequencesPage /></ProtectedRoute>} />
              <Route path="/analysis/:analysisId/implications" element={<ProtectedRoute><ImplicationsPage /></ProtectedRoute>} />
              <Route path="/public/:id" element={<PublicViewPage />} />
              <Route path="/framework" element={<FrameworkPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
