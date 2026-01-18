import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useScene } from '@/context/SceneContext';
import { useProduction } from '@/hooks/useProduction';
import { ArrowLeft, Layers, Loader2, Play } from 'lucide-react';
import type { ScriptSection } from '@/types/scene';

const SceneList = () => {
  const navigate = useNavigate();
  const { 
    selectedMode, 
    setActiveScriptId, 
    setProductionName,
    setSelectedSection,
  } = useScene();
  const { 
    production, 
    sections, 
    loading, 
    fetchActiveProduction, 
    fetchProductionSections 
  } = useProduction();

  useEffect(() => {
    const loadProduction = async () => {
      const prod = await fetchActiveProduction();
      if (prod) {
        setProductionName(prod.name);
        setActiveScriptId(prod.active_scene_id);
        if (prod.active_scene_id) {
          await fetchProductionSections(prod.active_scene_id);
        }
      }
    };
    loadProduction();
  }, [fetchActiveProduction, fetchProductionSections, setActiveScriptId, setProductionName]);

  // Redirect if no mode selected
  useEffect(() => {
    if (!selectedMode) {
      navigate('/');
    }
  }, [selectedMode, navigate]);

  const handleSelectSection = (section: ScriptSection) => {
    setSelectedSection(section);
    navigate(`/role-picker/${section.id}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Games
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          {production?.name || 'Choose a Scene'}
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          {sections.length} scene{sections.length !== 1 ? 's' : ''} available
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-4">
        <div className="max-w-md mx-auto space-y-3">
          {/* Loading */}
          {loading && sections.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Empty State */}
          {!loading && sections.length === 0 && (
            <Card className="border-dashed">
              <CardHeader className="py-12 text-center">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No scenes available yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask an admin to upload a script
                </p>
              </CardHeader>
            </Card>
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
                      {section.act_number && section.scene_number && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Act {section.act_number}, Scene {section.scene_number}
                        </p>
                      )}
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

export default SceneList;
