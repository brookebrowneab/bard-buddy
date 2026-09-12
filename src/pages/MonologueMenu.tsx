import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Brain, Check, Drama, ListOrdered, Pilcrow, Quote, ScrollText, TextCursorInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMonologue } from "@/data/monologues";
import { getProgress } from "@/lib/progress";

export const gameModes = [
  { id: "beats", title: "Thought Beats", description: "Learn the story and what each part means", icon: Brain },
  { id: "order", title: "Put It in Order", description: "Start with lines, then phrases, then words", icon: ListOrdered },
  { id: "small-blanks", title: "Fill Small Blanks", description: "Bring back a few missing words", icon: Pilcrow },
  { id: "big-blanks", title: "Fill Longer Blanks", description: "Hold a whole phrase in your memory", icon: TextCursorInput },
  { id: "cue", title: "Cue → Type It", description: "See the cue and call the next line", icon: Quote },
] as const;

const MonologueMenu = () => {
  const { monologueId } = useParams();
  const navigate = useNavigate();
  const monologue = getMonologue(monologueId);

  if (!monologue) return null;
  const completed = getProgress(monologue.id);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="px-4 pt-4 pb-3">
        <div className="max-w-md mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to monologues">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center -mt-8 px-10">
            <div className="inline-flex items-center gap-2 text-primary mb-2">
              <Drama className="w-5 h-5" />
              <span className="font-serif text-xs uppercase tracking-wide">{monologue.character}</span>
            </div>
            <h1 className="font-serif text-xl md:text-2xl font-bold leading-snug">{monologue.title}</h1>
            <p className="text-sm text-muted-foreground mt-2">Start at the top and build your way down.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 md:px-6 py-6">
        <div className="max-w-md mx-auto space-y-4">
          <Button
            variant="stage"
            size="xl"
            className="w-full h-auto py-4 px-4 mb-6"
            onClick={() => navigate(`/monologue/${monologue.id}/script`)}
          >
            <div className="flex items-center gap-4 w-full">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <ScrollText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg">Read the Full Monologue</p>
                <p className="text-sm text-muted-foreground font-normal">Your complete rehearsal copy</p>
              </div>
            </div>
          </Button>

          {gameModes.map((mode, index) => {
            const Icon = mode.icon;
            return (
              <Button
                key={mode.id}
                variant="practice"
                className="w-full h-auto py-4 px-4"
                onClick={() => navigate(`/practice/${monologue.id}/${mode.id}`)}
              >
                <div className="flex items-center gap-4 w-full">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${completed[index] ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    {completed[index] ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-0.5">Step {index + 1}</p>
                    <h2 className="font-semibold text-foreground text-lg">{mode.title}</h2>
                    <p className="text-sm text-muted-foreground whitespace-normal leading-relaxed">{mode.description}</p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </main>

      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">You don’t have to finish—just try a little.</p>
      </footer>
    </div>
  );
};

export default MonologueMenu;
