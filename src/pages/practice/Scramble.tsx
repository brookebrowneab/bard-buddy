import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useScene } from "@/context/SceneContext";
import { usePracticeData } from "@/hooks/usePracticeData";
import PracticeHeader from "@/components/PracticeHeader";
import PracticeNavigation from "@/components/PracticeNavigation";
import { Quote, RotateCcw, Check, Shuffle, Loader2 } from "lucide-react";

const Scramble = () => {
  const { getCurrentLine, selectedRole, currentLineIndex, totalLines } = useScene();
  const { loading, error } = usePracticeData();
  const navigate = useNavigate();

  const [groupByLine, setGroupByLine] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<number[]>([]);
  const [availableChunks, setAvailableChunks] = useState<number[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const line = getCurrentLine();

  // Split line into verse lines (by \n)
  const verseLines = useMemo(() => {
    if (!line) return [];
    return line.shakespeare_line.split('\n').filter(l => l.trim());
  }, [line]);

  const hasMultipleVerseLines = verseLines.length > 1;

  // Create chunks based on groupByLine setting
  const chunks = useMemo(() => {
    if (!line) return [];
    
    if (groupByLine && hasMultipleVerseLines) {
      // Each verse line becomes a chunk
      return verseLines;
    } else {
      // Original behavior: split all words into 3-5 chunks
      const words = line.shakespeare_line.replace(/\n/g, ' ').split(/\s+/);
      const numChunks = Math.min(5, Math.max(3, Math.ceil(words.length / 3)));
      const chunkSize = Math.ceil(words.length / numChunks);
      
      const result: string[] = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        result.push(words.slice(i, i + chunkSize).join(" "));
      }
      return result;
    }
  }, [line, groupByLine, hasMultipleVerseLines, verseLines]);

  // Scrambled order (randomized on mount and line change)
  const scrambledOrder = useMemo(() => {
    const indices = chunks.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [chunks, currentLineIndex, groupByLine]);

  // Reset state when line changes or groupByLine changes
  useEffect(() => {
    setSelectedOrder([]);
    setAvailableChunks(scrambledOrder);
    setIsCorrect(null);
  }, [currentLineIndex, scrambledOrder]);

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

  const handleChunkSelect = (chunkIndex: number) => {
    if (isCorrect !== null) return;
    
    setSelectedOrder(prev => [...prev, chunkIndex]);
    setAvailableChunks(prev => prev.filter(i => i !== chunkIndex));
  };

  const handleChunkDeselect = (position: number) => {
    if (isCorrect !== null) return;
    
    const chunkIndex = selectedOrder[position];
    setSelectedOrder(prev => prev.filter((_, i) => i !== position));
    setAvailableChunks(prev => [...prev, chunkIndex]);
  };

  const handleCheck = () => {
    const correct = selectedOrder.every((chunk, index) => chunk === index);
    setIsCorrect(correct);
  };

  const handleReset = () => {
    setSelectedOrder([]);
    setAvailableChunks(scrambledOrder);
    setIsCorrect(null);
  };

  const handleNextReset = () => {
    setSelectedOrder([]);
    setIsCorrect(null);
  };

  const allPlaced = selectedOrder.length === chunks.length;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <PracticeHeader title="Scramble the Line" />

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

          {/* Group by Line Toggle - only show if multiple verse lines */}
          {hasMultipleVerseLines && (
            <div className="flex items-center justify-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
              <Switch
                id="group-by-line"
                checked={groupByLine}
                onCheckedChange={setGroupByLine}
                disabled={isCorrect !== null}
              />
              <Label htmlFor="group-by-line" className="text-sm text-muted-foreground cursor-pointer">
                Order whole lines {groupByLine ? "(on)" : "(off - word chunks)"}
              </Label>
            </div>
          )}

          {/* Selected Order (Drop Zone) */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2 text-center">
              {isCorrect === true 
                ? "Perfect! You got it right! 🎭" 
                : isCorrect === false 
                  ? "Not quite—try again!" 
                  : groupByLine && hasMultipleVerseLines
                    ? "Put the lines in order"
                    : "Tap chunks in the correct order"
              }
            </p>
            <div className={`
              min-h-[100px] p-4 rounded-lg border-2 border-dashed
              ${isCorrect === true 
                ? "border-primary bg-primary/5" 
                : isCorrect === false 
                  ? "border-destructive bg-destructive/5" 
                  : "border-border bg-card/50"
              }
            `}>
              {selectedOrder.length === 0 ? (
                <p className="text-muted-foreground text-center text-sm italic">
                  Your arranged {groupByLine && hasMultipleVerseLines ? 'lines' : 'line'} will appear here
                </p>
              ) : (
                <div className={`flex ${groupByLine && hasMultipleVerseLines ? 'flex-col' : 'flex-wrap'} gap-2`}>
                  {selectedOrder.map((chunkIndex, position) => (
                    <button
                      key={`selected-${position}`}
                      onClick={() => handleChunkDeselect(position)}
                      disabled={isCorrect !== null}
                      className={`
                        px-2 md:px-3 py-2 rounded-md font-serif text-xs md:text-sm transition-all break-words max-w-full text-left
                        ${isCorrect !== null 
                          ? "bg-card border border-border cursor-default" 
                          : "bg-primary/10 border border-primary/30 hover:bg-primary/20 cursor-pointer"
                        }
                      `}
                    >
                      {chunks[chunkIndex]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Available Chunks */}
          {availableChunks.length > 0 && isCorrect === null && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Shuffle className="w-4 h-4" />
                <span className="text-sm">
                  {groupByLine && hasMultipleVerseLines ? 'Available lines' : 'Available chunks'}
                </span>
              </div>
              <div className={`flex ${groupByLine && hasMultipleVerseLines ? 'flex-col' : 'flex-wrap'} gap-2`}>
                {availableChunks.map((chunkIndex) => (
                  <button
                    key={`available-${chunkIndex}`}
                    onClick={() => handleChunkSelect(chunkIndex)}
                    className={`
                      px-3 md:px-4 py-2 md:py-3 rounded-lg bg-card border border-border 
                      hover:border-primary hover:bg-primary/5 font-serif text-sm md:text-base 
                      transition-all shadow-sm break-words max-w-full text-left
                    `}
                  >
                    {chunks[chunkIndex]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-auto space-y-3">
            {isCorrect === null && allPlaced && (
              <Button
                variant="default"
                size="lg"
                onClick={handleCheck}
                className="w-full"
              >
                <Check className="w-5 h-5 mr-2" />
                Check My Answer
              </Button>
            )}

            {(selectedOrder.length > 0 || isCorrect !== null) && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleReset}
                className="w-full"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Start Over
              </Button>
            )}
          </div>
        </div>
      </main>

      <PracticeNavigation onNext={handleNextReset} />
    </div>
  );
};

export default Scramble;
