import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SceneProvider } from "@/context/SceneContext";

// Eagerly load the home page for fast initial render
import PracticeModes from "./pages/PracticeModes";
import NotFound from "./pages/NotFound";

// Lazy load all other routes for code splitting
const RolePicker = lazy(() => import("./pages/RolePicker"));
const SectionPicker = lazy(() => import("./pages/SectionPicker"));
const CueSayIt = lazy(() => import("./pages/practice/CueSayIt"));
const FirstLetter = lazy(() => import("./pages/practice/FirstLetter"));
const Scramble = lazy(() => import("./pages/practice/Scramble"));
const UploadScene = lazy(() => import("./pages/UploadScene"));
const ParseReview = lazy(() => import("./pages/ParseReview"));
const SceneList = lazy(() => import("./pages/SceneList"));
const ModernEnglishGame = lazy(() => import("./pages/ModernEnglishGame"));
const ModernEnglishSceneViewer = lazy(() => import("./pages/ModernEnglishSceneViewer"));
const AdminTranslations = lazy(() => import("./pages/AdminTranslations"));
const AdminTranslationsReview = lazy(() => import("./pages/AdminTranslationsReview"));
const AdminTranslationEditor = lazy(() => import("./pages/AdminTranslationEditor"));
const AdminScriptFix = lazy(() => import("./pages/AdminScriptFix"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const queryClient = new QueryClient();

// Simple loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SceneProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<PracticeModes />} />
              <Route path="/upload" element={<UploadScene />} />
              <Route path="/scenes" element={<SceneList />} />
              <Route path="/parse-review/:sceneId" element={<ParseReview />} />
              <Route path="/role-picker" element={<RolePicker />} />
              <Route path="/role-picker/:sectionId" element={<RolePicker />} />
              <Route path="/section-picker" element={<SectionPicker />} />
              <Route path="/section-picker/:sceneId" element={<SectionPicker />} />
              <Route path="/practice/cue-say-it" element={<CueSayIt />} />
              <Route path="/practice/first-letter" element={<FirstLetter />} />
              <Route path="/practice/scramble" element={<Scramble />} />
              <Route path="/practice/plain-english" element={<ModernEnglishSceneViewer />} />
              <Route path="/modern-english" element={<ModernEnglishGame />} />
              <Route path="/modern-english-viewer" element={<ModernEnglishSceneViewer />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/translations" element={<AdminTranslations />} />
              <Route path="/admin/translations-review" element={<AdminTranslationsReview />} />
              <Route path="/admin/translation-editor" element={<AdminTranslationEditor />} />
              <Route path="/admin/script-fix" element={<AdminScriptFix />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SceneProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
