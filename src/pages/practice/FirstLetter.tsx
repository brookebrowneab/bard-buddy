import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { usePracticeData } from "@/hooks/usePracticeData";
import PracticeHeader from "@/components/PracticeHeader";
import PracticeNavigation from "@/components/PracticeNavigation";
import { Quote, Eye, EyeOff, Loader2, ChevronDown } from "lucide-react";

const FirstLetter = () => {
  const { getCurrentLine, selectedRole, currentLineIndex, totalLines } = useScene();
  const { loading, error } = usePracticeData();
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [revealedVerseLines, setRevealedVerseLines] = useState(0);
  const navigate = useNavigate();

  const line = getCurrentLine();

  // Split shakespeare_line by newlines into verse lines, then each into words
  const verseLineData = useMemo(() => {
    if (!line) return [];
    const verseLines = line.shakespeare_line.split('\n').filter(l => l.trim());
    let globalIndex = 0;
    return verseLines.map((verseLine, lineIdx) => {
      const words = verseLine.split(/\s+/).filter(w => w);
      const wordData = words.map((word, wordIdx) => ({
        word,
        globalKey: `${lineIdx}-${wordIdx}`,
        globalIndex: globalIndex++,
      }));
      return { verseLine, words: wordData, lineIdx };
    });
  }, [line]);

  const hasMultipleVerseLines = verseLineData.length > 1;
  const allVerseLinesRevealed = revealedVerseLines >= verseLineData.length;

  // Reset state when line changes
  useEffect(() => {
    setRevealedWords(new Set());
    setRevealedVerseLines(0);
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

  const toggleWordReveal = (key: string) => {
    setRevealedWords(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleRevealNextVerseLine = () => {
    if (revealedVerseLines < verseLineData.length) {
      setRevealedVerseLines(prev => prev + 1);
    }
  };

  const revealAllWords = () => {
    const allKeys = verseLineData.flatMap(vl => vl.words.map(w => w.globalKey));
    setRevealedWords(new Set(allKeys));
    setRevealedVerseLines(verseLineData.length);
  };

  const hideAllWords = () => {
    setRevealedWords(new Set());
  };

  const handleNextReset = () => {
    setRevealedWords(new Set());
    setRevealedVerseLines(0);
  };

  const showAll = revealedWords.size === verseLineData.flatMap(vl => vl.words).length;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <PracticeHeader title="First-Letter Help" />

      <main className="flex-1 flex flex-col px-4 md:px-6 py-6 overflow-y-auto overflow-x-hidden">
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
            {hasMultipleVerseLines && revealedVerseLines < verseLineData.length
              ? `Reveal lines one at a time, tap words for hints (${revealedVerseLines}/${verseLineData.length} lines shown)`
              : "Tap any word to reveal it"
            }
          </p>

          {/* First Letter Display - one verse line at a time */}
          <div className="flex-1 p-4 md:p-5 bg-card rounded-lg border border-border mb-4 space-y-3">
            {verseLineData.slice(0, hasMultipleVerseLines ? revealedVerseLines : verseLineData.length).map((verseLineItem, vIdx) => (
              <p key={vIdx} className="font-serif text-lg md:text-xl leading-loose break-words animate-in fade-in slide-in-from-top-2 duration-300">
                {verseLineItem.words.map((wordData, wIdx) => {
                  const isRevealed = revealedWords.has(wordData.globalKey);
                  return (
                    <span key={wordData.globalKey}>
                      <button
                        onClick={() => toggleWordReveal(wordData.globalKey)}
                        className={`
                          inline-block px-0.5 md:px-1 py-0.5 rounded transition-all duration-200 break-all
                          ${isRevealed 
                            ? "text-primary font-medium" 
                            : "text-foreground hover:bg-primary/10"
                          }
                        `}
                      >
                        {isRevealed ? wordData.word : getFirstLetterDisplay(wordData.word)}
                      </button>
                      {wIdx < verseLineItem.words.length - 1 && " "}
                    </span>
                  );
                })}
              </p>
            ))}

            {/* Show placeholder if no lines revealed yet in multi-line mode */}
            {hasMultipleVerseLines && revealedVerseLines === 0 && (
              <p className="text-muted-foreground text-center italic">
                Tap "Reveal Next Line" to begin
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Next Line button for multi-line passages */}
            {hasMultipleVerseLines && !allVerseLinesRevealed && (
              <Button
                variant="reveal"
                size="lg"
                onClick={handleRevealNextVerseLine}
                className="w-full"
              >
                <ChevronDown className="w-5 h-5 mr-2" />
                Reveal Next Line ({revealedVerseLines + 1}/{verseLineData.length})
              </Button>
            )}

            {/* Reveal/Hide All Button */}
            <Button
              variant="outline"
              size="lg"
              onClick={showAll ? hideAllWords : revealAllWords}
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
        </div>
      </main>

      <PracticeNavigation onNext={handleNextReset} />
    </div>
  );
};

export default FirstLetter;
