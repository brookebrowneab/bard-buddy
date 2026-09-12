import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Brain, Drama, Eye, EyeOff, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMonologue } from "@/data/monologues";
import { gameModes } from "./MonologueMenu";

const FullMonologue = () => {
  const { monologueId } = useParams();
  const navigate = useNavigate();
  const monologue = getMonologue(monologueId);
  const [showBeatNotes, setShowBeatNotes] = useState(true);

  if (!monologue) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="px-4 pt-4 pb-3 border-b border-border bg-card/40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/monologue/${monologue.id}`)}
              aria-label="Back to games"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="text-center flex-1 px-3">
              <div className="inline-flex items-center gap-2 text-primary">
                <Drama className="w-5 h-5" />
                <span className="font-serif text-xs uppercase tracking-wide">Full monologue</span>
              </div>
              <h1 className="font-serif text-lg md:text-xl font-bold leading-snug mt-1">
                {monologue.title}
              </h1>
            </div>
            <div className="w-10" aria-hidden="true" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 md:px-6 py-6 md:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs text-primary uppercase tracking-wide font-semibold">{monologue.character}</p>
              <p className="text-sm text-muted-foreground">by {monologue.author}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBeatNotes((visible) => !visible)}
              aria-pressed={showBeatNotes}
            >
              {showBeatNotes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showBeatNotes ? "Hide beat notes" : "Show beat notes"}
            </Button>
          </div>

          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 mb-5">
            <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-1">Opening cue</p>
            <p className="font-serif italic leading-relaxed">{monologue.startCue}</p>
          </div>

          <article className="bg-card rounded-xl border border-border shadow-sm px-5 py-2 md:px-8 md:py-4">
            {monologue.beats.map((beat, beatIndex) => (
              <section
                key={beat.title}
                className={`${beatIndex > 0 ? "border-t border-border" : ""} py-6`}
              >
                {showBeatNotes && (
                  <div className="mb-4 pl-3 border-l-2 border-primary animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <Brain className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wide font-semibold">Thought beat {beatIndex + 1}</p>
                    </div>
                    <h2 className="font-semibold text-base">{beat.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">{beat.meaning}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {beat.lines.map((line, lineIndex) => (
                    <p key={lineIndex} className="font-serif text-lg md:text-xl leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </article>

          <div className="sticky bottom-0 pt-4 pb-5 bg-gradient-to-t from-background via-background to-transparent">
            <Button
              size="lg"
              className="w-full shadow-lg"
              onClick={() => navigate(`/practice/${monologue.id}/${gameModes[0].id}`)}
            >
              <Play className="w-5 h-5" /> Start practicing
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FullMonologue;

