import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useScene } from "@/context/SceneContext";
import { usePracticeData } from "@/hooks/usePracticeData";
import PracticeHeader from "@/components/PracticeHeader";
import PracticeNavigation from "@/components/PracticeNavigation";
import { Quote, RotateCcw, Check, Shuffle, Loader2 } from "lucide-react";

const Scramble = () => {
  const { getCurrentLine, selectedRole, currentLineIndex, totalLines } = useScene();
  const { loading, error } = usePracticeData();
  const navigate = useNavigate();

  // Default to ordering whole lines (true)
  const [orderWholeLines, setOrderWholeLines] = useState(true);
  const [wordsPerChunk, setWordsPerChunk] = useState(3);
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

  // Create chunks based on orderWholeLines setting
  // When ordering whole lines: each verse line is a chunk
  // When ordering word chunks: split into chunks of wordsPerChunk words, grouped visually by line
  const chunks = useMemo(() => {
    if (!line) return [];
    
    if (orderWholeLines && hasMultipleVerseLines) {
      // Each verse line becomes a chunk
      return verseLines.map((verseLine, lineIdx) => ({
        text: verseLine,
        lineIdx,
      }));
    } else {
      // Split each verse line into word chunks, keeping track of which line they belong to
      const result: { text: string; lineIdx: number }[] = [];
      
      verseLines.forEach((verseLine, lineIdx) => {
        const words = verseLine.split(/\s+/).filter(w => w);
        for (let i = 0; i < words.length; i += wordsPerChunk) {
          result.push({
            text: words.slice(i, i + wordsPerChunk).join(" "),
            lineIdx,
          });
        }
      });
      
      return result;
    }
  }, [line, orderWholeLines, hasMultipleVerseLines, verseLines, wordsPerChunk]);

  // Scrambled order (randomized on mount and line change)
  const scrambledOrder = useMemo(() => {
    const indices = chunks.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [chunks.length, currentLineIndex, orderWholeLines, wordsPerChunk]);

  // Group available chunks by line for visual grouping when not ordering whole lines
  const groupedAvailableChunks = useMemo(() => {
    if (orderWholeLines || !hasMultipleVerseLines) {
      return [{ lineIdx: 0, chunkIndices: availableChunks }];
    }
    
    // Group by line index
    const groups: { lineIdx: number; chunkIndices: number[] }[] = [];
    const lineMap = new Map<number, number[]>();
    
    availableChunks.forEach(idx => {
      const lineIdx = chunks[idx]?.lineIdx ?? 0;
      if (!lineMap.has(lineIdx)) {
        lineMap.set(lineIdx, []);
      }
      lineMap.get(lineIdx)!.push(idx);
    });
    
    // Sort by line index
    Array.from(lineMap.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([lineIdx, chunkIndices]) => {
        groups.push({ lineIdx, chunkIndices });
      });
    
    return groups;
  }, [availableChunks, chunks, orderWholeLines, hasMultipleVerseLines]);

  // Reset state when line changes or settings change
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

  // Get line color for visual grouping
  const getLineColor = (lineIdx: number) => {
    const colors = [
      "border-l-primary",
      "border-l-blue-500",
      "border-l-green-500",
      "border-l-amber-500",
      "border-l-purple-500",
    ];
    return colors[lineIdx % colors.length];
  };

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

          {/* Settings Panel - only show if multiple verse lines */}
          {hasMultipleVerseLines && (
            <div className="mb-4 p-3 bg-muted/30 rounded-lg space-y-3">
              {/* Order whole lines toggle */}
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="order-whole-lines" className="text-sm text-muted-foreground cursor-pointer">
                  Order whole lines
                </Label>
                <Switch
                  id="order-whole-lines"
                  checked={orderWholeLines}
                  onCheckedChange={setOrderWholeLines}
                  disabled={isCorrect !== null}
                />
              </div>
              
              {/* Words per chunk slider - only show when not ordering whole lines */}
              {!orderWholeLines && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">
                      Words per chunk
                    </Label>
                    <span className="text-sm font-medium text-foreground">{wordsPerChunk}</span>
                  </div>
                  <Slider
                    value={[wordsPerChunk]}
                    onValueChange={(v) => setWordsPerChunk(v[0])}
                    min={1}
                    max={6}
                    step={1}
                    disabled={isCorrect !== null}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {/* Selected Order (Drop Zone) */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2 text-center">
              {isCorrect === true 
                ? "Perfect! You got it right! 🎭" 
                : isCorrect === false 
                  ? "Not quite—try again!" 
                  : orderWholeLines && hasMultipleVerseLines
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
                  Your arranged {orderWholeLines && hasMultipleVerseLines ? 'lines' : 'passage'} will appear here
                </p>
              ) : (
                <div className={`flex ${orderWholeLines && hasMultipleVerseLines ? 'flex-col' : 'flex-wrap'} gap-2`}>
                  {selectedOrder.map((chunkIndex, position) => (
                    <button
                      key={`selected-${position}`}
                      onClick={() => handleChunkDeselect(position)}
                      disabled={isCorrect !== null}
                      className={`
                        px-2 md:px-3 py-2 rounded-md font-serif text-xs md:text-sm transition-all break-words max-w-full text-left
                        ${!orderWholeLines && hasMultipleVerseLines ? `border-l-4 ${getLineColor(chunks[chunkIndex]?.lineIdx ?? 0)}` : ''}
                        ${isCorrect !== null 
                          ? "bg-card border border-border cursor-default" 
                          : "bg-primary/10 border border-primary/30 hover:bg-primary/20 cursor-pointer"
                        }
                      `}
                    >
                      {chunks[chunkIndex]?.text}
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
                  {orderWholeLines && hasMultipleVerseLines ? 'Available lines' : 'Available chunks'}
                </span>
              </div>
              
              {/* Grouped display for word chunks */}
              <div className="space-y-3">
                {groupedAvailableChunks.map((group, gIdx) => (
                  <div 
                    key={gIdx} 
                    className={`
                      flex flex-wrap gap-2
                      ${!orderWholeLines && hasMultipleVerseLines && groupedAvailableChunks.length > 1
                        ? `p-2 rounded-lg bg-muted/20 border-l-4 ${getLineColor(group.lineIdx)}`
                        : ''
                      }
                    `}
                  >
                    {group.chunkIndices.map((chunkIndex) => (
                      <button
                        key={`available-${chunkIndex}`}
                        onClick={() => handleChunkSelect(chunkIndex)}
                        className={`
                          px-3 md:px-4 py-2 md:py-3 rounded-lg bg-card border border-border 
                          hover:border-primary hover:bg-primary/5 font-serif text-sm md:text-base 
                          transition-all shadow-sm break-words max-w-full text-left
                          ${orderWholeLines && hasMultipleVerseLines ? 'w-full' : ''}
                        `}
                      >
                        {chunks[chunkIndex]?.text}
                      </button>
                    ))}
                  </div>
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
