import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { usePracticeData } from "@/hooks/usePracticeData";
import PracticeHeader from "@/components/PracticeHeader";
import PracticeNavigation from "@/components/PracticeNavigation";
import { Eye, Quote, Loader2, ChevronDown } from "lucide-react";

const CueSayIt = () => {
  const { getCurrentLine, selectedRole, currentLineIndex, totalLines } = useScene();
  const { loading, error, isReady } = usePracticeData();
  const [revealedLineCount, setRevealedLineCount] = useState(0);
  const navigate = useNavigate();

  const line = getCurrentLine();

  // Split shakespeare_line by newlines into verse lines
  const verseLines = useMemo(() => {
    if (!line) return [];
    return line.shakespeare_line.split('\n').filter(l => l.trim());
  }, [line]);

  const hasMultipleLines = verseLines.length > 1;
  const allRevealed = revealedLineCount >= verseLines.length;

  // Reset revealed state when line changes
  useEffect(() => {
    setRevealedLineCount(0);
  }, [currentLineIndex]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => navigate('/scenes')}>Choose a Scene</Button>
        </div>
      </div>
    );
  }

  // No lines for this role
  if (!line || totalLines === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-muted-foreground mb-4">
            No lines found for {selectedRole} in this scene
          </p>
          <Button onClick={() => navigate('/scenes')}>Choose a Scene</Button>
        </div>
      </div>
    );
  }

  const handleRevealNext = () => {
    if (revealedLineCount < verseLines.length) {
      setRevealedLineCount(prev => prev + 1);
    }
  };

  const handleRevealAll = () => {
    setRevealedLineCount(verseLines.length);
  };

  const handleNextReset = () => {
    setRevealedLineCount(0);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <PracticeHeader title="Cue → Say It" />

      <main className="flex-1 flex flex-col px-4 md:px-6 py-6 overflow-y-auto overflow-x-hidden">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {/* Cue Line */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Quote className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wide">Your Cue</span>
            </div>
            <div className="p-4 md:p-5 bg-muted/50 rounded-lg border border-border">
              <p className="font-serif text-base md:text-lg text-foreground italic leading-relaxed break-words">
                "{line.cue_line}"
              </p>
            </div>
          </div>

          {/* Prompt */}
          <div className="text-center mb-6 py-4">
            <p className="text-muted-foreground">
              {allRevealed 
                ? "How did you do?" 
                : revealedLineCount > 0 && hasMultipleLines
                  ? `Line ${revealedLineCount} of ${verseLines.length} revealed`
                  : "Speak your line aloud, then reveal to check"
              }
            </p>
          </div>

          {/* Your Line (Hidden or Revealed) */}
          <div className="flex-1">
            {revealedLineCount === 0 ? (
              <Button
                variant="reveal"
                size="xl"
                className="w-full h-auto py-6"
                onClick={handleRevealNext}
              >
                <Eye className="w-5 h-5 mr-2" />
                {hasMultipleLines ? "Reveal First Line" : "Reveal Your Line"}
              </Button>
            ) : (
              <div className="p-4 md:p-5 bg-card rounded-lg border-2 border-primary shadow-md animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-primary mb-3">
                  <span className="text-xs md:text-sm font-semibold uppercase tracking-wide break-words">
                    {selectedRole}'s Line
                  </span>
                  {hasMultipleLines && (
                    <span className="text-xs text-muted-foreground">
                      {revealedLineCount}/{verseLines.length}
                    </span>
                  )}
                </div>
                <div className="font-serif text-lg md:text-xl text-foreground leading-relaxed space-y-2">
                  {verseLines.slice(0, revealedLineCount).map((verseLine, idx) => (
                    <p key={idx} className="break-words animate-in fade-in slide-in-from-top-2 duration-300">
                      {idx === 0 ? '"' : ''}{verseLine}{idx === verseLines.length - 1 && revealedLineCount === verseLines.length ? '"' : ''}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Reveal More / Reveal All buttons */}
            {revealedLineCount > 0 && !allRevealed && hasMultipleLines && (
              <div className="mt-4 flex gap-3">
                <Button
                  variant="reveal"
                  size="lg"
                  className="flex-1"
                  onClick={handleRevealNext}
                >
                  <ChevronDown className="w-5 h-5 mr-2" />
                  Next Line
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleRevealAll}
                >
                  <Eye className="w-5 h-5 mr-2" />
                  Show All
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <PracticeNavigation onNext={handleNextReset} />
    </div>
  );
};

export default CueSayIt;
