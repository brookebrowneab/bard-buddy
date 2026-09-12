import { useNavigate } from "react-router-dom";
import { Drama, BookOpen, NotebookPen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monologues } from "@/data/monologues";
import { getProgress } from "@/lib/progress";

const MonologueHome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="px-4 md:px-6 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-primary mb-2">
          <Drama className="w-6 h-6" />
          <span className="font-serif text-sm uppercase tracking-wide">Monologue Buddy</span>
        </div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
          What are we practicing today?
        </h1>
        <p className="font-serif text-base md:text-lg text-muted-foreground mt-3">
          A few minutes at a time. No pressure.
        </p>
      </header>

      <main className="flex-1 px-4 md:px-6 py-6 md:py-8">
        <div className="max-w-md mx-auto space-y-4">
          {monologues.map((monologue, index) => {
            const completed = getProgress(monologue.id);
            const completeCount = completed.filter(Boolean).length;
            const Icon = index === 0 ? BookOpen : NotebookPen;

            return (
              <Button
                key={monologue.id}
                variant="practice"
                className="w-full h-auto py-5 px-4"
                onClick={() => navigate(`/monologue/${monologue.id}`)}
              >
                <div className="flex items-start gap-4 w-full">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-1">
                      {monologue.character}
                    </p>
                    <h2 className="font-semibold text-foreground text-lg md:text-xl leading-snug whitespace-normal">
                      {monologue.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-normal">
                      {monologue.label}
                    </p>
                    <div className="flex items-center gap-1.5 mt-3" aria-label={`${completeCount} of 5 games completed`}>
                      {[0, 1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={`w-6 h-1.5 rounded-full ${completed[step] ? "bg-primary" : "bg-muted"}`}
                        />
                      ))}
                      {completeCount === 5 && <Check className="w-4 h-4 text-primary ml-1" />}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}

          <p className="text-center text-xs text-muted-foreground pt-4">
            Nothing is recorded. Progress stays on this device.
          </p>
        </div>
      </main>

      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          “Learn the thought. Then learn the line.”
        </p>
      </footer>
    </div>
  );
};

export default MonologueHome;

