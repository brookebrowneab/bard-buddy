import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { usePracticeData } from "@/hooks/usePracticeData";
import PracticeHeader from "@/components/PracticeHeader";
import PracticeNavigation from "@/components/PracticeNavigation";
import { Quote, Eye, EyeOff, Loader2 } from "lucide-react";

const FirstLetter = () => {
  const { getCurrentLine, selectedRole, currentLineIndex, totalLines } = useScene();
  const { loading, error } = usePracticeData();
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  const line = getCurrentLine();

  // Reset state when line changes
  useEffect(() => {
    setRevealedWords([]);
    setShowAll(false);
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

  const words = line.shakespeare_line.split(/\s+/);

  const getFirstLetterDisplay = (word: string): string => {
    // Keep punctuation, show first letter
    const match = word.match(/^([^a-zA-Z]*)([a-zA-Z])(.*?)([^a-zA-Z]*)$/);
    if (match) {
      const [, leadingPunc, firstLetter, rest, trailingPunc] = match;
      const underscores = "_".repeat(rest.length);
      return `${leadingPunc}${firstLetter}${underscores}${trailingPunc}`;
    }
    return word.charAt(0) + "_".repeat(Math.max(0, word.length - 1));
  };

  const toggleWordReveal = (index: number) => {
    if (revealedWords.includes(index)) {
      setRevealedWords(prev => prev.filter(i => i !== index));
    } else {
      setRevealedWords(prev => [...prev, index]);
    }
  };

  const revealAll = () => {
    setShowAll(true);
    setRevealedWords(words.map((_, i) => i));
  };

  const hideAll = () => {
    setShowAll(false);
    setRevealedWords([]);
  };

  const handleNextReset = () => {
    setRevealedWords([]);
    setShowAll(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PracticeHeader title="First-Letter Help" />

      <main className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {/* Cue Line */}
          <div className="mb-6">
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

          {/* Instruction */}
          <p className="text-center text-muted-foreground text-sm mb-4">
            Tap any word to reveal it
          </p>

          {/* First Letter Display */}
          <div className="flex-1 p-5 bg-card rounded-lg border border-border mb-4">
            <p className="font-serif text-xl leading-loose">
              {words.map((word, index) => {
                const isRevealed = revealedWords.includes(index) || showAll;
                return (
                  <span key={index}>
                    <button
                      onClick={() => toggleWordReveal(index)}
                      className={`
                        inline-block px-1 py-0.5 rounded transition-all duration-200
                        ${isRevealed 
                          ? "text-primary font-medium" 
                          : "text-foreground hover:bg-primary/10"
                        }
                      `}
                    >
                      {isRevealed ? word : getFirstLetterDisplay(word)}
                    </button>
                    {index < words.length - 1 && " "}
                  </span>
                );
              })}
            </p>
          </div>

          {/* Reveal/Hide All Button */}
          <Button
            variant="outline"
            size="lg"
            onClick={showAll ? hideAll : revealAll}
            className="w-full"
          >
            {showAll ? (
              <>
                <EyeOff className="w-5 h-5 mr-2" />
                Hide All Words
              </>
            ) : (
              <>
                <Eye className="w-5 h-5 mr-2" />
                Reveal All Words
              </>
            )}
          </Button>
        </div>
      </main>

      <PracticeNavigation onNext={handleNextReset} />
    </div>
  );
};

export default FirstLetter;
