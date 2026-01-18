import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";

interface PracticeNavigationProps {
  onNext?: () => void;
}

const PracticeNavigation = ({ onNext }: PracticeNavigationProps) => {
  const { hasNextLine, hasPrevLine, nextLine, prevLine, currentLineIndex, totalLines } = useScene();
  const navigate = useNavigate();

  const isLastLine = currentLineIndex === totalLines - 1;

  const handleNext = () => {
    if (onNext) {
      onNext();
    }
    if (hasNextLine) {
      nextLine();
    }
  };

  const handleFinish = () => {
    navigate("/");
  };

  return (
    <footer className="px-4 py-4 border-t border-border bg-card/50">
      <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
        <Button
          variant="outline"
          size="lg"
          onClick={prevLine}
          disabled={!hasPrevLine}
          className="flex-1"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Previous
        </Button>

        {isLastLine ? (
          <Button
            variant="default"
            size="lg"
            onClick={handleFinish}
            className="flex-1"
          >
            <PartyPopper className="w-5 h-5 mr-1" />
            Finish!
          </Button>
        ) : (
          <Button
            variant="default"
            size="lg"
            onClick={handleNext}
            className="flex-1"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        )}
      </div>
    </footer>
  );
};

export default PracticeNavigation;
