import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { ArrowLeft, X } from "lucide-react";

interface PracticeHeaderProps {
  title: string;
}

const PracticeHeader = ({ title }: PracticeHeaderProps) => {
  const { currentLineIndex, totalLines, selectedRole } = useScene();
  const navigate = useNavigate();

  const progress = ((currentLineIndex + 1) / totalLines) * 100;

  return (
    <header className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/practice-modes")}
          aria-label="Back to practice modes"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="text-sm font-medium text-foreground">
            {selectedRole} • Line {currentLineIndex + 1} of {totalLines}
          </p>
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/")}
          aria-label="Exit practice"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  );
};

export default PracticeHeader;
