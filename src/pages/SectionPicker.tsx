import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useScene } from '@/context/SceneContext';
import { useSceneData } from '@/hooks/useSceneData';
import { Layers, Loader2, Check } from 'lucide-react';
import AppBreadcrumbs from '@/components/AppBreadcrumbs';
import type { ScriptSection } from '@/types/scene';

const SectionPicker = () => {
  const { sceneId: paramSceneId } = useParams<{ sceneId?: string }>();
  const navigate = useNavigate();
  const { 
    selectedRole, 
    selectedMode,
    setSceneId, 
    setSceneTitle, 
    loadFromLineBlocks,
    sceneId: contextSceneId
  } = useScene();
  const { 
    fetchScene, 
    fetchLineBlocks, 
    getSectionsForCharacter, 
    lineBlocks, 
    loading 
  } = useSceneData();
  
  const [availableSections, setAvailableSections] = useState<ScriptSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [loadingSections, setLoadingSections] = useState(true);

  const activeSceneId = paramSceneId || contextSceneId;

  // Load sections where the selected role appears
  useEffect(() => {
    const loadSections = async () => {
      if (!activeSceneId || !selectedRole) {
        navigate('/role-picker');
        return;
      }

      setLoadingSections(true);
      
      // Fetch scene info
      const scene = await fetchScene(activeSceneId);
      if (scene) {
        setSceneId(activeSceneId);
        setSceneTitle(scene.title);
      }

      // Get sections where this character appears
      const sections = await getSectionsForCharacter(activeSceneId, selectedRole);
      setAvailableSections(sections);
      setLoadingSections(false);
    };

    loadSections();
  }, [activeSceneId, selectedRole, fetchScene, getSectionsForCharacter, setSceneId, setSceneTitle, navigate]);

  const handleSectionSelect = async (section: ScriptSection) => {
    setSelectedSectionId(section.id);
    
    // Fetch line blocks for this section
    const blocks = await fetchLineBlocks(activeSceneId!, section.id);
    
    if (blocks && selectedRole) {
      loadFromLineBlocks(blocks, selectedRole);
      // Navigate to the selected practice mode
      navigate(selectedMode || '/practice/cue-say-it');
    }
  };

  const handlePracticeAll = async () => {
    // Fetch all lines for this character across all sections
    const allBlocks = await fetchLineBlocks(activeSceneId!);
    if (allBlocks && selectedRole) {
      loadFromLineBlocks(allBlocks, selectedRole);
      navigate(selectedMode || '/practice/cue-say-it');
    }
  };

  if (loadingSections || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please select a role first</p>
          <Button onClick={() => navigate('/role-picker')}>Choose Role</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <AppBreadcrumbs className="mb-4" />
        <h1 className="font-serif text-xl md:text-2xl font-bold text-foreground text-center">
          Choose Scene
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          Scenes where <span className="font-semibold text-foreground break-words">{selectedRole}</span> appears
        </p>
      </header>

      {/* Section List */}
      <main className="flex-1 px-4 md:px-6 py-4 overflow-x-hidden">
        <div className="max-w-sm mx-auto space-y-3 w-full">
          {availableSections.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No scenes found for {selectedRole}
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/role-picker')}
              >
                Choose Different Role
              </Button>
            </div>
          ) : (
            availableSections.map((section) => {
              const isSelected = selectedSectionId === section.id;
              
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionSelect(section)}
                  disabled={loading}
                  className={`
                    w-full p-4 md:p-5 rounded-lg border-2 text-left transition-all duration-200
                    flex items-center justify-between gap-2
                    ${isSelected 
                      ? "border-primary bg-primary/5 shadow-md" 
                      : "border-border bg-card hover:border-primary/50 hover:shadow-sm"
                    }
                  `}
                >
                  <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                    <div className={`
                      w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0
                      ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                    `}>
                      <Layers className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-serif text-lg md:text-xl font-semibold text-foreground break-words">
                        {section.title}
                      </h2>
                      {section.act_number && section.scene_number && (
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Act {section.act_number}, Scene {section.scene_number}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-6 h-6 text-primary" />
                  )}
                </button>
              );
            })
          )}

          {/* Practice All option */}
          {availableSections.length > 1 && (
            <button
              onClick={handlePracticeAll}
              className="w-full p-5 rounded-lg border-2 border-dashed border-primary/30 text-center transition-all duration-200 hover:border-primary hover:bg-primary/5"
            >
              <p className="font-serif text-lg font-semibold text-primary">
                Practice All Scenes
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {availableSections.length} scenes total
              </p>
            </button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          Choose your scene and take the stage
        </p>
      </footer>
    </div>
  );
};

export default SectionPicker;
