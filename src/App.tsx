import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SceneProvider } from "@/context/SceneContext";
import Index from "./pages/Index";
import RolePicker from "./pages/RolePicker";
import SectionPicker from "./pages/SectionPicker";
import PracticeModes from "./pages/PracticeModes";
import CueSayIt from "./pages/practice/CueSayIt";
import FirstLetter from "./pages/practice/FirstLetter";
import Scramble from "./pages/practice/Scramble";
import PlainEnglish from "./pages/practice/PlainEnglish";
import UploadScene from "./pages/UploadScene";
import ParseReview from "./pages/ParseReview";
import SceneList from "./pages/SceneList";
import ModernEnglishGame from "./pages/ModernEnglishGame";
import ModernEnglishSceneViewer from "./pages/ModernEnglishSceneViewer";
import AdminTranslations from "./pages/AdminTranslations";
import AdminTranslationsReview from "./pages/AdminTranslationsReview";
import AdminLogin from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SceneProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="/practice/plain-english" element={<PlainEnglish />} />
            <Route path="/modern-english" element={<ModernEnglishGame />} />
            <Route path="/modern-english-viewer" element={<ModernEnglishSceneViewer />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/translations" element={<AdminTranslations />} />
            <Route path="/admin/translations-review" element={<AdminTranslationsReview />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SceneProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
