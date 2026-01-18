import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import PracticeHeader from "@/components/PracticeHeader";
import PracticeNavigation from "@/components/PracticeNavigation";
import { Quote, MessageSquare, Scroll, Eye } from "lucide-react";

const PlainEnglish = () => {
  const { getCurrentLine, selectedRole, currentLineIndex } = useScene();
  const [isRevealed, setIsRevealed] = useState(false);
  const navigate = useNavigate();

  const line = getCurrentLine();

  // Reset revealed state when line changes
  useEffect(() => {
    setIsRevealed(false);
  }, [currentLineIndex]);

  if (!selectedRole || !line) {
    navigate("/role-picker");
    return null;
  }

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleNextReset = () => {
    setIsRevealed(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PracticeHeader title="Plain English → Shakespeare" />

      <main className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {/* Cue Line */}
          <div className="mb-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Quote className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wide">Your Cue</span>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <p className="font-serif text-base text-foreground italic leading-relaxed">
                "{line.cue_line}"
              </p>
            </div>
          </div>

          {/* Modern Hint */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wide">In Plain English</span>
            </div>
            <div className="p-5 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-lg text-foreground leading-relaxed">
                {line.modern_hint}
              </p>
            </div>
          </div>

          {/* Prompt */}
          <div className="text-center mb-5 py-2">
            <p className="text-muted-foreground">
              {isRevealed 
                ? "Now speak it as Shakespeare wrote it" 
                : "Can you say it in Shakespeare's words?"
              }
            </p>
          </div>

          {/* Shakespeare Line (Hidden or Revealed) */}
          <div className="flex-1">
            {!isRevealed ? (
              <Button
                variant="reveal"
                size="xl"
                className="w-full h-auto py-6"
                onClick={handleReveal}
              >
                <Scroll className="w-5 h-5 mr-2" />
                Show Shakespeare
              </Button>
            ) : (
              <div className="p-5 bg-card rounded-lg border-2 border-primary shadow-md animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-primary mb-3">
                  <Scroll className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    Shakespeare's Words
                  </span>
                </div>
                <p className="font-serif text-xl text-foreground leading-relaxed">
                  "{line.shakespeare_line}"
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <PracticeNavigation onNext={handleNextReset} />
    </div>
  );
};

export default PlainEnglish;
