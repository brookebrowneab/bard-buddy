import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SceneProvider } from "@/context/SceneContext";
import Index from "./pages/Index";
import RolePicker from "./pages/RolePicker";
import PracticeModes from "./pages/PracticeModes";
import CueSayIt from "./pages/practice/CueSayIt";
import FirstLetter from "./pages/practice/FirstLetter";
import Scramble from "./pages/practice/Scramble";
import PlainEnglish from "./pages/practice/PlainEnglish";
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
            <Route path="/" element={<Index />} />
            <Route path="/role-picker" element={<RolePicker />} />
            <Route path="/practice-modes" element={<PracticeModes />} />
            <Route path="/practice/cue-say-it" element={<CueSayIt />} />
            <Route path="/practice/first-letter" element={<FirstLetter />} />
            <Route path="/practice/scramble" element={<Scramble />} />
            <Route path="/practice/plain-english" element={<PlainEnglish />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SceneProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
