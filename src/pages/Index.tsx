import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { Sparkles, Drama } from "lucide-react";

const Index = () => {
  const { scene, selectedRole } = useScene();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-primary mb-2">
          <Drama className="w-6 h-6" />
          <span className="font-serif text-sm uppercase tracking-wide">Shakespeare Lines</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          {scene.title}
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-4">
          {/* Current Role Display */}
          {selectedRole && (
            <div className="text-center mb-6 p-4 bg-card rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-1">Your Role</p>
              <p className="font-serif text-xl font-semibold text-foreground">{selectedRole}</p>
            </div>
          )}

          {/* Main Actions */}
          <Link to="/role-picker" className="block w-full">
            <Button variant="stage" size="xl" className="w-full">
              <Drama className="w-5 h-5 mr-2" />
              {selectedRole ? "Change My Role" : "Choose My Role"}
            </Button>
          </Link>

          <Link 
            to={selectedRole ? "/practice-modes" : "/role-picker"} 
            className="block w-full"
          >
            <Button 
              variant="default" 
              size="xl" 
              className="w-full"
              disabled={!selectedRole}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Practice
            </Button>
          </Link>

          {!selectedRole && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Choose your role to start practicing
            </p>
          )}
        </div>
      </main>

      {/* Encouraging Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          "All the world's a stage..."
        </p>
      </footer>
    </div>
  );
};

export default Index;
