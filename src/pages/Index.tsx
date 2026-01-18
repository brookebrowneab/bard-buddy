import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { Sparkles, Drama, Upload, FolderOpen } from "lucide-react";

const Index = () => {
  const { sceneTitle, selectedRole, useSampleScene } = useScene();
  const navigate = useNavigate();

  const handleUseSample = () => {
    useSampleScene();
    navigate("/role-picker");
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
          Memorize Your Lines
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
              <p className="text-xs text-muted-foreground mt-1">{sceneTitle}</p>
            </div>
          )}

          {/* Upload PDF */}
          <Link to="/upload" className="block w-full">
            <Button variant="stage" size="xl" className="w-full">
              <Upload className="w-5 h-5 mr-2" />
              Upload Scene PDF
            </Button>
          </Link>

          {/* My Scenes */}
          <Link to="/scenes" className="block w-full">
            <Button variant="outline" size="xl" className="w-full">
              <FolderOpen className="w-5 h-5 mr-2" />
              My Uploaded Scenes
            </Button>
          </Link>

          {/* Sample Scene */}
          <Button 
            variant="ghost" 
            size="lg" 
            className="w-full"
            onClick={handleUseSample}
          >
            <Drama className="w-5 h-5 mr-2" />
            Try Sample Scene
          </Button>

          {/* Continue Practicing */}
          {selectedRole && (
            <Link to="/practice-modes" className="block w-full">
              <Button 
                variant="default" 
                size="xl" 
                className="w-full"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Continue Practice
              </Button>
            </Link>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          "All the world's a stage..."
        </p>
      </footer>
    </div>
  );
};

export default Index;
