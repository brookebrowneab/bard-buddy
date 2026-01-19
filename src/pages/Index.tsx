import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { useSceneData } from "@/hooks/useSceneData";
import { Sparkles, Drama, Settings, User, Loader2 } from "lucide-react";

const Index = () => {
  const { sceneTitle, selectedRole, setSceneId, setSceneTitle, setCharacters } = useScene();
  const { fetchScenes, fetchCharacters, scenes, loading } = useSceneData();
  const [hasScript, setHasScript] = useState<boolean | null>(null);
  const navigate = useNavigate();

  // Check if a script has been uploaded
  useEffect(() => {
    const checkScript = async () => {
      const data = await fetchScenes();
      if (data && data.length > 0) {
        // Use the most recent script
        const script = data[0];
        setSceneId(script.id);
        setSceneTitle(script.title);
        
        // Load characters
        const chars = await fetchCharacters(script.id);
        if (chars) {
          setCharacters(chars.map(c => c.name));
        }
        setHasScript(true);
      } else {
        setHasScript(false);
      }
    };
    checkScript();
  }, [fetchScenes, fetchCharacters, setSceneId, setSceneTitle, setCharacters]);

  if (hasScript === null || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No script uploaded yet - show admin prompt
  if (!hasScript) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="px-6 pt-8 pb-4 text-center">
          <div className="inline-flex items-center gap-2 text-primary mb-2">
            <Drama className="w-7 h-7 md:w-6 md:h-6" />
            <span className="font-serif text-base md:text-sm uppercase tracking-wide">Shakespeare Lines</span>
          </div>
          <h1 className="font-serif text-2xl md:text-2xl font-bold text-foreground">
            Much Ado About Nothing
          </h1>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm space-y-4 text-center">
            <Drama className="w-16 h-16 mx-auto text-muted-foreground" />
            <p className="text-base md:text-base text-muted-foreground">
              No script has been uploaded yet.
            </p>
            <p className="text-base md:text-sm text-muted-foreground">
              An admin needs to upload the script first.
            </p>
            <Link to="/upload" className="block w-full mt-6">
              <Button variant="stage" size="xl" className="w-full text-base md:text-sm min-h-14">
                <Settings className="w-5 h-5 mr-2" />
                <span className="leading-tight">Admin:<br className="md:hidden" /> Upload Script</span>
              </Button>
            </Link>
          </div>
        </main>

        <footer className="px-6 pb-8 text-center">
          <p className="font-serif text-base md:text-sm text-muted-foreground italic">
            "All the world's a stage..."
          </p>
        </footer>
      </div>
    );
  }

  // Script exists - show student home
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-primary mb-2">
          <Drama className="w-7 h-7 md:w-6 md:h-6" />
          <span className="font-serif text-base md:text-sm uppercase tracking-wide">Shakespeare Lines</span>
        </div>
        <h1 className="font-serif text-2xl md:text-2xl font-bold text-foreground">
          {sceneTitle || "Much Ado About Nothing"}
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-4">
          {/* Current Role Display */}
          {selectedRole && (
            <div className="text-center mb-6 p-4 md:p-4 bg-card rounded-lg border border-border min-h-20">
              <p className="text-base md:text-sm text-muted-foreground mb-1">Your Role</p>
              <p className="font-serif text-xl md:text-xl font-semibold text-foreground">{selectedRole}</p>
            </div>
          )}

          {/* Choose Role - Primary Action */}
          <Link to="/role-picker" className="block w-full">
            <Button variant="stage" size="xl" className="w-full text-base md:text-sm min-h-14">
              <User className="w-5 h-5 mr-2" />
              <span className="leading-tight">{selectedRole ? "Change Role" : "Choose My Role"}</span>
            </Button>
          </Link>

          {/* Continue Practicing - if role selected */}
          {selectedRole && (
            <Link to="/section-picker" className="block w-full">
              <Button variant="default" size="xl" className="w-full text-base md:text-sm min-h-14">
                <Sparkles className="w-5 h-5 mr-2" />
                Practice
              </Button>
            </Link>
          )}

          {/* Admin Settings */}
          <Link to="/upload" className="block w-full">
            <Button variant="ghost" size="lg" className="w-full text-muted-foreground text-base md:text-sm min-h-12">
              <Settings className="w-5 h-5 md:w-4 md:h-4 mr-2" />
              Admin Settings
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-base md:text-sm text-muted-foreground italic">
          "All the world's a stage..."
        </p>
      </footer>
    </div>
  );
};

export default Index;
