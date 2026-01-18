import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useScene } from '@/context/SceneContext';
import { useSceneData } from '@/hooks/useSceneData';
import { ArrowLeft, Layers, Loader2, Play } from 'lucide-react';
import type { ScriptSection } from '@/types/scene';

const SceneList = () => {
  const navigate = useNavigate();
  const { 
    selectedMode, 
    selectedRole,
    activeScriptId,
    productionName,
    setSelectedSection,
  } = useScene();
  const { getSectionsForCharacter, loading } = useSceneData();

  const [sections, setSections] = React.useState<ScriptSection[]>([]);
  const [loadingSections, setLoadingSections] = React.useState(true);

  // Load sections where this character appears
  useEffect(() => {
    const loadSections = async () => {
      if (!activeScriptId || !selectedRole) {
        return;
      }

      setLoadingSections(true);
      const charSections = await getSectionsForCharacter(activeScriptId, selectedRole);
      setSections(charSections);
      setLoadingSections(false);
    };

    loadSections();
  }, [activeScriptId, selectedRole, getSectionsForCharacter]);

  // Redirect if no mode or role selected
  useEffect(() => {
    if (!selectedMode) {
      navigate('/');
      return;
    }
    if (!selectedRole) {
      navigate('/role-picker');
    }
  }, [selectedMode, selectedRole, navigate]);

  const handleSelectSection = (section: ScriptSection) => {
    setSelectedSection(section);
    // Go directly to practice mode
    navigate(selectedMode || '/practice/cue-say-it');
  };

  const handlePracticeAll = () => {
    // Set section to null to indicate "all sections"
    setSelectedSection(null);
    navigate(selectedMode || '/practice/cue-say-it');
  };

  const isLoading = loading || loadingSections;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/role-picker')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Characters
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          Choose a Scene
        </h1>
        {selectedRole && (
          <p className="text-center text-primary font-medium mt-1">
            Scenes with {selectedRole}
          </p>
        )}
        <p className="text-center text-muted-foreground mt-2 text-sm">
          {sections.length} scene{sections.length !== 1 ? 's' : ''} available
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-4 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-3">
          {/* Loading */}
          {isLoading && sections.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && sections.length === 0 && (
            <Card className="border-dashed">
              <CardHeader className="py-12 text-center">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No scenes found for {selectedRole}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/role-picker')}
                >
                  Choose Different Character
                </Button>
              </CardHeader>
            </Card>
          )}

          {/* Practice All option at the top */}
          {sections.length > 1 && (
            <button
              onClick={handlePracticeAll}
              className="w-full p-5 rounded-lg border-2 border-dashed border-primary/30 text-center transition-all duration-200 hover:border-primary hover:bg-primary/5"
            >
              <p className="font-serif text-lg font-semibold text-primary">
                Practice All Scenes
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                All {sections.length} scenes with {selectedRole}
              </p>
            </button>
          )}

          {/* Flat list of Act/Scenes */}
          {sections.map((section) => (
            <Card 
              key={section.id} 
              className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleSelectSection(section)}
            >
              <CardHeader className="py-4 px-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {section.title}
                      </CardTitle>
                    </div>
                    <Play className="w-5 h-5 text-primary flex-shrink-0" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          Each scene brings you closer to the stage
        </p>
      </footer>
    </div>
  );
};

import React from 'react';
export default SceneList;
