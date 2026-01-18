import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { useSceneData } from "@/hooks/useSceneData";
import { ArrowLeft, User, Check, Loader2 } from "lucide-react";

const RolePicker = () => {
  const { sceneId: paramSceneId } = useParams<{ sceneId?: string }>();
  const { 
    selectedRole, setSelectedRole, characters, setCharacters, 
    setSceneId, setSceneTitle, sceneId 
  } = useScene();
  const { fetchScene, fetchCharacters, loading } = useSceneData();
  const navigate = useNavigate();

  const activeSceneId = paramSceneId || sceneId;

  // Load scene data if we have a scene ID
  useEffect(() => {
    if (activeSceneId) {
      setSceneId(activeSceneId);
      fetchScene(activeSceneId).then(scene => {
        if (scene) setSceneTitle(scene.title);
      });
      fetchCharacters(activeSceneId).then(chars => {
        if (chars) setCharacters(chars.map(c => c.name));
      });
    }
  }, [activeSceneId, fetchScene, fetchCharacters, setSceneId, setSceneTitle, setCharacters]);

  const handleRoleSelect = (character: string) => {
    setSelectedRole(character);
    // Navigate to section picker to choose which scene to practice
    navigate('/section-picker');
  };

  if (loading && characters.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/scenes")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Scenes
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          Choose Your Role
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          Which character will you play?
        </p>
      </header>

      {/* Character List */}
      <main className="flex-1 px-6 py-4">
        <div className="max-w-sm mx-auto space-y-3">
          {characters.map((character) => {
            const isSelected = selectedRole === character;
            
            return (
              <button
                key={character}
                onClick={() => handleRoleSelect(character)}
                className={`
                  w-full p-5 rounded-lg border-2 text-left transition-all duration-200
                  flex items-center justify-between
                  ${isSelected 
                    ? "border-primary bg-primary/5 shadow-md" 
                    : "border-border bg-card hover:border-primary/50 hover:shadow-sm"
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                  `}>
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-foreground">
                      {character}
                    </h2>
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-6 h-6 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          Take your place upon the stage
        </p>
      </footer>
    </div>
  );
};

export default RolePicker;
