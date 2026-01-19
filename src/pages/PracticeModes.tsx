import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { MessageCircle, Type, Shuffle, Languages, Drama, Settings } from "lucide-react";

interface PracticeModeOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  requiresHint?: boolean;
}

const practiceModes: PracticeModeOption[] = [
  {
    id: "cue-say-it",
    title: "Cue → Say It",
    description: "See your cue, speak your line, then check yourself",
    icon: <MessageCircle className="w-6 h-6" />,
    path: "/practice/cue-say-it"
  },
  {
    id: "first-letter",
    title: "First-Letter Help",
    description: "See the first letter of each word as a hint",
    icon: <Type className="w-6 h-6" />,
    path: "/practice/first-letter"
  },
  {
    id: "scramble",
    title: "Scramble the Line",
    description: "Put the chunks of your line in the right order",
    icon: <Shuffle className="w-6 h-6" />,
    path: "/practice/scramble"
  },
  {
    id: "plain-english",
    title: "Plain English → Shakespeare",
    description: "Read the modern meaning, then recall the Bard's words",
    icon: <Languages className="w-6 h-6" />,
    path: "/modern-english-viewer",
    requiresHint: true
  }
];

const PracticeModes = () => {
  const { setSelectedMode, resetProgress } = useScene();
  const navigate = useNavigate();

  const handleModeSelect = (mode: PracticeModeOption) => {
    setSelectedMode(mode.path);
    resetProgress();
    navigate("/role-picker"); // Go to character selection first
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-primary mb-2">
          <Drama className="w-6 h-6" />
          <span className="font-serif text-sm uppercase tracking-wide">Shakespeare Lines</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          How Would You Like to Practice?
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Choose a game, then pick your scene
        </p>
      </header>

      {/* Practice Mode Options */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-md mx-auto space-y-4">
          {practiceModes.map((mode) => (
            <Button
              key={mode.id}
              variant="practice"
              className="w-full py-8"
              onClick={() => handleModeSelect(mode)}
            >
              <div className="flex items-center gap-5 w-full">
                <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  {mode.icon}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h2 className="font-semibold text-foreground text-lg mb-1">
                    {mode.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {mode.description}
                  </p>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </main>

      {/* Admin Link */}
      <div className="px-6 pb-4">
        <Button 
          variant="ghost" 
          size="lg" 
          className="w-full text-muted-foreground"
          onClick={() => navigate("/admin")}
        >
          <Settings className="w-4 h-4 mr-2" />
          Admin Settings
        </Button>
      </div>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          "All the world's a stage..."
        </p>
      </footer>
    </div>
  );
};

export default PracticeModes;