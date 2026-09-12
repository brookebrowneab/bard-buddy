import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, ChevronRight, Drama, Eye, Lightbulb, PartyPopper, Quote, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLines, getMonologue, Monologue } from "@/data/monologues";
import { completeGame } from "@/lib/progress";
import { normalize, seededShuffle, similarity, splitIntoPhrases, tokenize } from "@/lib/practice";
import { gameModes } from "./MonologueMenu";

type GameId = typeof gameModes[number]["id"];

type GameShellProps = {
  monologue: Monologue;
  gameId: GameId;
  current: number;
  total: number;
  children: ReactNode;
};

const GameShell = ({ monologue, gameId, current, total, children }: GameShellProps) => {
  const navigate = useNavigate();
  const mode = gameModes.find((item) => item.id === gameId)!;
  const progress = total ? ((current + 1) / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="px-4 pt-4 pb-2">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/monologue/${monologue.id}`)} aria-label="Back to games">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{mode.title}</p>
              <p className="text-sm font-medium">{monologue.character} • {current + 1} of {total}</p>
            </div>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/monologue/${monologue.id}/script`)}
                aria-label="Read full monologue"
              >
                <BookOpen className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Exit practice">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col px-4 md:px-6 py-6 overflow-y-auto overflow-x-hidden">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">{children}</div>
      </main>
    </div>
  );
};

const CueCard = ({ label, text }: { label: string; text: string }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 text-muted-foreground mb-2">
      <Quote className="w-4 h-4" />
      <span className="text-sm uppercase tracking-wide">{label}</span>
    </div>
    <div className="p-4 md:p-5 bg-muted/50 rounded-lg border border-border">
      <p className="font-serif text-base md:text-lg italic leading-relaxed break-words">“{text}”</p>
    </div>
  </div>
);

const HelpCard = ({ kind, children, onUse }: { kind: "hint" | "answer"; children: ReactNode; onUse?: () => void }) => (
  <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5 animate-in fade-in duration-300">
    <div className="flex items-center gap-2 text-primary mb-2">
      {kind === "hint" ? <Lightbulb className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      <p className="text-xs uppercase tracking-wide font-semibold">{kind === "hint" ? "Hint" : "Answer"}</p>
    </div>
    <div className="font-serif leading-relaxed">{children}</div>
    {onUse && <Button variant="outline" size="sm" className="w-full mt-3" onClick={onUse}>Put the answer in place</Button>}
  </div>
);

const OptionalHelp = ({ attempts, hint, answer, onUse }: { attempts: number; hint: ReactNode; answer: ReactNode; onUse?: () => void }) => {
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  if (attempts < 1) return null;

  return (
    <div className="mb-4 space-y-3">
      {!showHint && !showAnswer && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => setShowHint(true)}>
          <Lightbulb className="w-5 h-5" /> Show a hint
        </Button>
      )}
      {showHint && !showAnswer && <HelpCard kind="hint">{hint}</HelpCard>}
      {attempts >= 2 && !showAnswer && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => setShowAnswer(true)}>
          <Eye className="w-5 h-5" /> Show the answer
        </Button>
      )}
      {showAnswer && <HelpCard kind="answer" onUse={onUse}>{answer}</HelpCard>}
    </div>
  );
};

const Done = ({ monologue, gameIndex }: { monologue: Monologue; gameIndex: number }) => {
  const navigate = useNavigate();
  useEffect(() => completeGame(monologue.id, gameIndex), [gameIndex, monologue.id]);
  const nextMode = gameModes[gameIndex + 1];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
          <PartyPopper className="w-9 h-9" />
        </div>
        <p className="text-sm text-primary uppercase tracking-wide font-semibold mb-2">Step {gameIndex + 1} complete</p>
        <h1 className="font-serif text-3xl font-bold mb-3">Nice work.</h1>
        <p className="font-serif text-lg text-muted-foreground mb-8">That counts as rehearsal.</p>
        <div className="space-y-3">
          {nextMode ? (
            <Button size="xl" className="w-full" onClick={() => navigate(`/practice/${monologue.id}/${nextMode.id}`)}>
              Next: {nextMode.title}<ChevronRight className="w-5 h-5" />
            </Button>
          ) : (
            <Button size="xl" className="w-full" onClick={() => navigate("/")}>
              <Drama className="w-5 h-5" /> Take a bow
            </Button>
          )}
          <Button variant="outline" size="lg" className="w-full" onClick={() => navigate(`/monologue/${monologue.id}`)}>Back to all games</Button>
        </div>
      </div>
    </div>
  );
};

const BeatGame = ({ monologue }: { monologue: Monologue }) => {
  const [beatIndex, setBeatIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [answer, setAnswer] = useState<number[]>([]);
  const [available, setAvailable] = useState(() => seededShuffle(monologue.beats.map((_, index) => index), 47));
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);
  const beat = monologue.beats[beatIndex];

  if (done) return <Done monologue={monologue} gameIndex={0} />;

  const moveToAnswer = (index: number) => {
    setAnswer((items) => [...items, index]);
    setAvailable((items) => items.filter((item) => item !== index));
  };

  const moveBack = (index: number) => {
    setAnswer((items) => items.filter((item) => item !== index));
    setAvailable((items) => [...items, index]);
  };

  const checkOrder = () => {
    if (answer.every((item, index) => item === index)) setDone(true);
    else {
      setAttempts((value) => value + 1);
      setAvailable(seededShuffle(monologue.beats.map((_, index) => index), 83));
      setAnswer([]);
    }
  };

  return (
    <GameShell monologue={monologue} gameId="beats" current={quiz ? monologue.beats.length : beatIndex} total={monologue.beats.length + 1}>
      {!quiz ? (
        <>
          <div className="text-center mb-5">
            <p className="text-sm text-primary uppercase tracking-wide font-semibold">Thought beat {beatIndex + 1}</p>
            <h1 className="font-serif text-2xl md:text-3xl font-bold mt-1">{beat.title}</h1>
          </div>
          <div className="p-5 bg-card rounded-lg border border-border shadow-sm mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">What it means</p>
            <p className="text-lg leading-relaxed">{beat.meaning}</p>
            <div className="mt-4 inline-flex rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm font-semibold">Play it: {beat.action}</div>
          </div>
          {revealed ? (
            <div className="p-5 bg-primary/5 rounded-lg border-2 border-primary animate-in fade-in duration-300">
              <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-2">The words</p>
              <p className="font-serif text-lg md:text-xl leading-relaxed">{beat.lines.join(" ")}</p>
            </div>
          ) : (
            <Button variant="reveal" size="xl" className="w-full" onClick={() => setRevealed(true)}><Eye className="w-5 h-5" /> Reveal the words</Button>
          )}
          <div className="mt-auto pt-6">
            <Button size="lg" className="w-full" onClick={() => {
              if (beatIndex === monologue.beats.length - 1) setQuiz(true);
              else { setBeatIndex((index) => index + 1); setRevealed(false); }
            }}>{beatIndex === monologue.beats.length - 1 ? "Test the beat order" : "Next thought beat"}<ChevronRight className="w-5 h-5" /></Button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-5">
            <p className="text-sm text-primary uppercase tracking-wide font-semibold">Final check</p>
            <h1 className="font-serif text-2xl md:text-3xl font-bold mt-1">Put the thoughts in order</h1>
            <p className="text-sm text-muted-foreground mt-2">Tap each beat in the order the story happens.</p>
          </div>
          <div className="min-h-28 p-3 rounded-lg border-2 border-dashed border-border bg-card/50 mb-4 space-y-2">
            {answer.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-7">Your story path will appear here</p>}
            {answer.map((index, position) => (
              <button key={index} onClick={() => moveBack(index)} className="w-full p-3 rounded-lg border border-primary/30 bg-primary/10 text-left flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{position + 1}</span>
                <span><strong className="block">{monologue.beats[index].title}</strong><span className="text-xs text-muted-foreground">{monologue.beats[index].action}</span></span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {available.map((index) => (
              <button key={index} onClick={() => moveToAnswer(index)} className="w-full p-4 rounded-lg bg-card border border-border hover:border-primary text-left transition-colors">
                <strong className="block">{monologue.beats[index].title}</strong>
                <span className="text-sm text-muted-foreground">{monologue.beats[index].meaning}</span>
              </button>
            ))}
          </div>
          <OptionalHelp
            attempts={attempts}
            hint={<>Begin with <strong>{monologue.beats[0].title}</strong>. Think about what she knows first, then what changes.</>}
            answer={
              <ol className="list-decimal pl-5 space-y-1">
                {monologue.beats.map((item) => <li key={item.title}>{item.title}</li>)}
              </ol>
            }
            onUse={() => { setAnswer(monologue.beats.map((_, index) => index)); setAvailable([]); }}
          />
          <div className="mt-auto pt-6">
            <Button size="lg" className="w-full" disabled={available.length > 0} onClick={checkOrder}><Check className="w-5 h-5" /> Check my order</Button>
          </div>
        </>
      )}
    </GameShell>
  );
};

const OrderGame = ({ monologue }: { monologue: Monologue }) => {
  const lines = getLines(monologue);
  const phraseLines = useMemo(() => lines.filter((line) => splitIntoPhrases(line.text).length > 1), [lines]);
  const wordLines = useMemo(() => lines.filter((line) => tokenize(line.text).length > 1), [lines]);
  const [stageIndex, setStageIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [available, setAvailable] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);
  const stage = ["lines", "phrases", "words"][stageIndex] as "lines" | "phrases" | "words";
  const stageLines = stage === "phrases" ? phraseLines : wordLines;
  const activeLine = stage === "lines" ? undefined : stageLines[round];
  const items = useMemo(() => {
    if (stage === "lines") return lines.map((line) => line.text);
    if (!activeLine) return [];
    return stage === "phrases" ? splitIntoPhrases(activeLine.text) : tokenize(activeLine.text);
  }, [activeLine, lines, stage]);

  const stageDetails = {
    lines: {
      eyebrow: "Level 1 of 3 · Lines",
      instruction: "First, put the whole monologue in order",
      cueLabel: "Your task",
      cueText: "Build the story from beginning to end.",
      error: "A couple of lines wandered. Think through the story, then try again.",
    },
    phrases: {
      eyebrow: "Level 2 of 3 · Phrases",
      instruction: "Now build the line from short phrases",
      cueLabel: "Thought beat",
      cueText: activeLine?.beatTitle ?? "",
      error: "A couple of phrases wandered. Say the line slowly, then try again.",
    },
    words: {
      eyebrow: "Level 3 of 3 · Words",
      instruction: "Last, put each word in its exact place",
      cueLabel: "Thought beat",
      cueText: activeLine?.beatTitle ?? "",
      error: "A few words wandered. Try the thought again from the beginning.",
    },
  }[stage];

  const phraseStepCount = phraseLines.length;
  const totalSteps = 1 + phraseStepCount + wordLines.length;
  const currentStep = stage === "lines" ? 0 : stage === "phrases" ? 1 + round : 1 + phraseStepCount + round;

  useEffect(() => {
    setSelected([]);
    setAvailable(seededShuffle(items.map((_, index) => index), 101 + stageIndex * 1000 + round * 17));
    setAttempts(0);
  }, [items.length, round, stageIndex]);

  if (done) return <Done monologue={monologue} gameIndex={1} />;
  const correct = selected.length === items.length && selected.every((value, index) => value === index);
  const next = () => {
    if (stage === "lines") {
      setStageIndex(1);
      setRound(0);
      return;
    }

    if (round < stageLines.length - 1) {
      setRound((value) => value + 1);
      return;
    }

    if (stage === "phrases") {
      setStageIndex(2);
      setRound(0);
      return;
    }

    setDone(true);
  };

  const nextLabel = stage === "lines"
    ? "Great — now order phrases"
    : stage === "phrases" && round === stageLines.length - 1
      ? "Great — now order words"
      : stage === "words" && round === stageLines.length - 1
        ? "Perfect — finish"
        : stage === "phrases"
          ? "Perfect — next phrase puzzle"
          : "Perfect — next word puzzle";

  const restart = () => {
    setSelected([]);
    setAvailable(seededShuffle(items.map((_, index) => index), 509 + stageIndex * 1000 + round * 23));
  };

  const selectItem = (index: number) => {
    setSelected((chosen) => [...chosen, index]);
    setAvailable((choices) => choices.filter((item) => item !== index));
  };

  const returnItem = (index: number, position: number) => {
    setSelected((chosen) => chosen.filter((_, itemPosition) => itemPosition !== position));
    setAvailable((choices) => [...choices, index]);
  };

  const lineLayout = stage === "lines";

  return (
    <GameShell monologue={monologue} gameId="order" current={currentStep} total={totalSteps}>
      <div className="text-center mb-4">
        <p className="text-xs text-primary uppercase tracking-wide font-semibold">{stageDetails.eyebrow}</p>
        <p className="text-sm text-muted-foreground mt-1">{stageDetails.instruction}</p>
      </div>
      <CueCard label={stageDetails.cueLabel} text={stageDetails.cueText} />
      <div className={`min-h-28 p-3 rounded-lg border-2 border-dashed mb-4 ${attempts ? "border-primary/40 bg-primary/5" : "border-border bg-card/50"}`}>
        {selected.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-7">Tap the first {lineLayout ? "line" : stage === "phrases" ? "phrase" : "word"} below</p>}
        <div className={lineLayout ? "space-y-2" : "flex flex-wrap gap-2"}>
          {selected.map((index, position) => (
            <button
              key={`${index}-${position}`}
              onClick={() => returnItem(index, position)}
              className={`${lineLayout ? "w-full text-left flex items-start gap-3" : ""} px-3 py-2 rounded-md font-serif text-sm bg-primary/10 border border-primary/30`}
            >
              {lineLayout && <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-sans text-xs font-bold flex-shrink-0">{position + 1}</span>}
              <span>{items[index]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={`${lineLayout ? "space-y-2" : "flex flex-wrap gap-2"} mb-5`}>
        {available.map((index) => (
          <button key={index} onClick={() => selectItem(index)} className={`${lineLayout ? "w-full text-left leading-relaxed" : ""} px-3 py-2.5 rounded-lg bg-card border border-border hover:border-primary font-serif text-sm shadow-sm`}>{items[index]}</button>
        ))}
      </div>
      <OptionalHelp
        key={`${stage}-${round}`}
        attempts={attempts}
        hint={<>Start with <strong>{items[0]}</strong></>}
        answer={
          lineLayout ? (
            <ol className="list-decimal pl-5 space-y-2">{items.map((item) => <li key={item}>{item}</li>)}</ol>
          ) : (
            <p>{items.join(" → ")}</p>
          )
        }
        onUse={() => { setSelected(items.map((_, index) => index)); setAvailable([]); }}
      />
      <div className="mt-auto space-y-3">
        {correct ? (
          <Button size="lg" className="w-full" onClick={next}><Check className="w-5 h-5" /> {nextLabel}</Button>
        ) : (
          <Button size="lg" className="w-full" disabled={available.length > 0} onClick={() => setAttempts((value) => value + 1)}><Check className="w-5 h-5" /> Check my answer</Button>
        )}
        {selected.length > 0 && <Button variant="outline" size="lg" className="w-full" onClick={restart}><RotateCcw className="w-5 h-5" /> Start over</Button>}
      </div>
    </GameShell>
  );
};

const SmallBlanksGame = ({ monologue }: { monologue: Monologue }) => {
  const lines = getLines(monologue).filter((line) => tokenize(line.text).length > 3);
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);
  const words = tokenize(lines[round].text);
  const blankIndices = useMemo(() => {
    const candidates = words.map((word, index) => ({ word, index })).filter(({ word }) => normalize(word).length > 3);
    return seededShuffle(candidates, 311 + round * 19).slice(0, Math.max(1, Math.round(candidates.length * 0.24))).map(({ index }) => index).sort((a, b) => a - b);
  }, [round, lines[round].text]);

  if (done) return <Done monologue={monologue} gameIndex={2} />;
  const allCorrect = blankIndices.every((index) => normalize(answers[index] || "") === normalize(words[index]));
  const next = () => {
    if (round === lines.length - 1) setDone(true);
    else { setRound((value) => value + 1); setAnswers({}); setChecked(false); setAttempts(0); }
  };
  const checkAnswers = () => {
    setChecked(true);
    if (!allCorrect) setAttempts((value) => value + 1);
  };

  return (
    <GameShell monologue={monologue} gameId="small-blanks" current={round} total={lines.length}>
      <CueCard label="Thought beat" text={lines[round].beatTitle} />
      <p className="text-center text-sm text-muted-foreground mb-4">Type the words that stepped offstage</p>
      <div className="p-5 bg-card rounded-lg border border-border font-serif text-lg md:text-xl leading-[2.4] mb-5">
        {words.map((word, index) => blankIndices.includes(index) ? (
          <input
            key={index}
            aria-label={`Missing word ${blankIndices.indexOf(index) + 1}`}
            value={answers[index] || ""}
            onChange={(event) => { setAnswers((value) => ({ ...value, [index]: event.target.value })); setChecked(false); }}
            className={`inline-block w-28 h-9 mx-1 px-2 text-center font-sans text-base rounded-md border-2 outline-none ${checked ? (normalize(answers[index] || "") === normalize(word) ? "border-primary bg-primary/5" : "border-destructive bg-destructive/5") : "border-border bg-background focus:border-primary"}`}
          />
        ) : <span key={index}>{word}{" "}</span>)}
      </div>
      {checked && !allCorrect && <p className="text-center text-destructive text-sm mb-4">Almost. Check the boxes outlined in red.</p>}
      {!allCorrect && (
        <OptionalHelp
          key={round}
          attempts={attempts}
          hint={<>The missing words begin with {blankIndices.map((index) => <strong key={index} className="mr-2">{words[index].charAt(0).toUpperCase()}</strong>)}</>}
          answer={blankIndices.map((index) => words[index]).join(" · ")}
          onUse={() => { setAnswers(Object.fromEntries(blankIndices.map((index) => [index, words[index]]))); setChecked(true); }}
        />
      )}
      <div className="mt-auto space-y-3">
        {checked && allCorrect ? (
          <Button size="lg" className="w-full" onClick={next}><Check className="w-5 h-5" /> Every word is back</Button>
        ) : (
          <Button size="lg" className="w-full" onClick={checkAnswers}><Check className="w-5 h-5" /> Check my words</Button>
        )}
        <Button variant="outline" size="lg" className="w-full" onClick={() => {
          const firstMissing = blankIndices.find((index) => !answers[index]);
          if (firstMissing !== undefined) setAnswers((value) => ({ ...value, [firstMissing]: words[firstMissing] }));
        }}><Lightbulb className="w-5 h-5" /> Reveal one word</Button>
      </div>
    </GameShell>
  );
};

const BigBlanksGame = ({ monologue }: { monologue: Monologue }) => {
  const lines = getLines(monologue).filter((line) => tokenize(line.text).length > 5);
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);
  const words = tokenize(lines[round].text);
  const blankLength = Math.max(3, Math.min(10, Math.round(words.length * 0.45)));
  const blankStart = 1 + ((round * 5 + 2) % Math.max(1, words.length - blankLength - 1));
  const expected = words.slice(blankStart, blankStart + blankLength).join(" ");
  const before = words.slice(0, blankStart).join(" ");
  const after = words.slice(blankStart + blankLength).join(" ");
  const isCorrect = normalize(answer) === normalize(expected);

  if (done) return <Done monologue={monologue} gameIndex={3} />;
  const next = () => {
    if (round === lines.length - 1) setDone(true);
    else { setRound((value) => value + 1); setAnswer(""); setChecked(false); setAttempts(0); }
  };
  const checkPhrase = () => {
    setChecked(true);
    if (!isCorrect) setAttempts((value) => value + 1);
  };

  return (
    <GameShell monologue={monologue} gameId="big-blanks" current={round} total={lines.length}>
      <CueCard label="Thought beat" text={lines[round].beatTitle} />
      <p className="text-center text-sm text-muted-foreground mb-4">Hold the whole thought, then restore the missing phrase</p>
      <div className="p-5 bg-card rounded-lg border border-border font-serif text-lg md:text-xl leading-relaxed mb-4">
        <p>{before}</p>
        <textarea
          value={answer}
          onChange={(event) => { setAnswer(event.target.value); setChecked(false); }}
          aria-label="Missing phrase"
          placeholder="Type the missing phrase…"
          className={`w-full min-h-28 my-4 p-3 rounded-lg border-2 bg-background font-sans text-base resize-y outline-none ${checked ? (isCorrect ? "border-primary" : "border-destructive") : "border-border focus:border-primary"}`}
        />
        <p>{after}</p>
      </div>
      {!isCorrect && (
        <OptionalHelp
          key={round}
          attempts={attempts}
          hint={<>The missing phrase has {tokenize(expected).length} words and begins with <strong>{tokenize(expected)[0]}</strong>.</>}
          answer={expected}
          onUse={() => { setAnswer(expected); setChecked(true); }}
        />
      )}
      <div className="mt-auto space-y-3">
        {checked && isCorrect ? (
          <Button size="lg" className="w-full" onClick={next}><Check className="w-5 h-5" /> You held the thought</Button>
        ) : <Button size="lg" className="w-full" onClick={checkPhrase}><Check className="w-5 h-5" /> Check the phrase</Button>}
        <Button variant="outline" size="lg" className="w-full" onClick={() => setAnswer(tokenize(expected)[0] + " ")}><Lightbulb className="w-5 h-5" /> Give me the first word</Button>
      </div>
    </GameShell>
  );
};

const CueTypeGame = ({ monologue }: { monologue: Monologue }) => {
  const lines = getLines(monologue);
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState(false);
  const cue = round === 0 ? monologue.startCue : lines[round - 1].text;
  const score = similarity(lines[round].text, answer);

  if (done) return <Done monologue={monologue} gameIndex={4} />;
  const next = () => {
    if (round === lines.length - 1) setDone(true);
    else { setRound((value) => value + 1); setAnswer(""); setChecked(false); setAccepted(false); setAttempts(0); }
  };
  const checkLine = () => {
    setChecked(true);
    if (score < 0.96) setAttempts((value) => value + 1);
  };

  return (
    <GameShell monologue={monologue} gameId="cue" current={round} total={lines.length}>
      <CueCard label="Your cue" text={cue} />
      <p className="text-center text-sm text-muted-foreground mb-4">Hear the next line in your head, then type it</p>
      <textarea
        value={answer}
        onChange={(event) => { setAnswer(event.target.value); setChecked(false); setAccepted(false); }}
        aria-label="Your next line"
        placeholder="Type the next line from memory…"
        className="w-full min-h-40 p-4 rounded-lg border-2 border-border bg-card font-serif text-lg leading-relaxed resize-y outline-none focus:border-primary"
      />
      {score < 0.96 && !accepted && (
        <OptionalHelp
          key={round}
          attempts={attempts}
          hint={<>You have {Math.round(score * 100)}% of it. The line begins: <strong>{tokenize(lines[round].text).slice(0, 3).join(" ")}</strong></>}
          answer={lines[round].text}
          onUse={() => { setAnswer(lines[round].text); setChecked(true); }}
        />
      )}
      <div className="mt-auto pt-5 space-y-3">
        {(checked && score >= 0.96) || accepted ? (
          <Button size="lg" className="w-full" onClick={next}><Check className="w-5 h-5" /> Beautiful — next cue</Button>
        ) : (
          <Button size="lg" className="w-full" disabled={!answer.trim()} onClick={checkLine}><Check className="w-5 h-5" /> Check the line</Button>
        )}
        {attempts >= 2 && score < 0.96 && !accepted && <Button variant="outline" size="lg" className="w-full" onClick={() => setAccepted(true)}>Count it and continue</Button>}
        {attempts === 0 && !checked && <Button variant="outline" size="lg" className="w-full" onClick={() => setAnswer(tokenize(lines[round].text).slice(0, 3).join(" ") + " ")}><Lightbulb className="w-5 h-5" /> Show the first 3 words</Button>}
      </div>
    </GameShell>
  );
};

const PracticeGame = () => {
  const { monologueId, gameId } = useParams();
  const navigate = useNavigate();
  const monologue = getMonologue(monologueId);
  const validGame = gameModes.some((mode) => mode.id === gameId);

  useEffect(() => {
    if (!monologue || !validGame) navigate("/", { replace: true });
  }, [monologue, navigate, validGame]);

  if (!monologue || !validGame) return null;
  if (gameId === "beats") return <BeatGame monologue={monologue} />;
  if (gameId === "order") return <OrderGame monologue={monologue} />;
  if (gameId === "small-blanks") return <SmallBlanksGame monologue={monologue} />;
  if (gameId === "big-blanks") return <BigBlanksGame monologue={monologue} />;
  return <CueTypeGame monologue={monologue} />;
};

export default PracticeGame;
