import { HashRouter, Routes, Route } from "react-router-dom";
import MonologueHome from "./pages/MonologueHome";
import MonologueMenu from "./pages/MonologueMenu";
import PracticeGame from "./pages/PracticeGame";
import FullMonologue from "./pages/FullMonologue";
import NotFound from "./pages/NotFound";

const App = () => (
  <HashRouter>
    <Routes>
      <Route path="/" element={<MonologueHome />} />
      <Route path="/monologue/:monologueId" element={<MonologueMenu />} />
      <Route path="/monologue/:monologueId/script" element={<FullMonologue />} />
      <Route path="/practice/:monologueId/:gameId" element={<PracticeGame />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </HashRouter>
);

export default App;
