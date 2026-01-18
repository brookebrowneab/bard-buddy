import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { ArrowLeft, User, Check } from "lucide-react";

const RolePicker = () => {
  const { scene, selectedRole, setSelectedRole } = useScene();
  const navigate = useNavigate();

  const handleRoleSelect = (character: string) => {
    setSelectedRole(character);
    navigate("/practice-modes");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
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
          {scene.characters.map((character) => {
            const isSelected = selectedRole === character;
            const lineCount = scene.lines.filter(l => l.character === character).length;
            
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
                    <p className="text-sm text-muted-foreground">
                      {lineCount} lines to practice
                    </p>
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

      {/* Encouraging Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          Take your place upon the stage
        </p>
      </footer>
    </div>
  );
};

export default RolePicker;
