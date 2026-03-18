import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ContactPage from "./pages/ContactPage";
import Dashboard from "./pages/Dashboard";
import ProfilePage from "./pages/ProfilePage";
import AnalysisPage from "./pages/AnalysisPage";
import ConceptsPage from "./pages/ConceptsPage";
import SubQuestionsPage from "./pages/SubQuestionsPage";
import PovGroupingPage from "./pages/PovGroupingPage";
import SubQuestionAnalysisPage from "./pages/SubQuestionAnalysisPage";
import AssumptionsPage from "./pages/AssumptionsPage";
import SynthesisPage from "./pages/SynthesisPage";
import ConsequencesPage from "./pages/ConsequencesPage";
import ImplicationsPage from "./pages/ImplicationsPage";
import PublicViewPage from "./pages/PublicViewPage";
import FrameworkPage from "./pages/FrameworkPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground font-display">Loading...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground font-display">Loading...</div></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
