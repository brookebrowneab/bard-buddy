import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { useProduction } from "@/hooks/useProduction";
import { ArrowLeft, User, Check, Loader2 } from "lucide-react";

const RolePicker = () => {
  const { sectionId } = useParams<{ sectionId?: string }>();
  const navigate = useNavigate();
  const { 
    selectedRole, 
    setSelectedRole, 
    characters, 
    setCharacters, 
    activeScriptId,
    selectedSection,
    setSelectedSection,
    selectedMode,
  } = useScene();
  const { getCharactersInSection, fetchProductionSections, sections } = useProduction();
  
  const [loading, setLoading] = useState(true);

  // Load characters for this section
  useEffect(() => {
    const loadCharacters = async () => {
      // If we have a sectionId param but no selectedSection, we need to find it
      if (sectionId && activeScriptId) {
        setLoading(true);
        
        // Fetch sections if we don't have them
        let sectionsList = sections;
        if (sections.length === 0) {
          sectionsList = await fetchProductionSections(activeScriptId);
        }
        
        // Find the section from the list
        const section = sectionsList.find(s => s.id === sectionId);
        if (section) {
          setSelectedSection(section);
        }
        
        // Get characters in this section
        const chars = await getCharactersInSection(activeScriptId, sectionId);
        setCharacters(chars);
        setLoading(false);
      } else if (selectedSection && activeScriptId) {
        setLoading(true);
        const chars = await getCharactersInSection(activeScriptId, selectedSection.id);
        setCharacters(chars);
        setLoading(false);
      }
    };

    loadCharacters();
  }, [sectionId, activeScriptId, selectedSection, getCharactersInSection, setCharacters, sections, fetchProductionSections, setSelectedSection]);

  // Redirect if no section selected
  useEffect(() => {
    if (!selectedMode) {
      navigate('/');
    }
  }, [selectedMode, navigate]);

  const handleRoleSelect = (character: string) => {
    setSelectedRole(character);
    // Go directly to practice mode since we already have section selected
    navigate(selectedMode || '/practice/cue-say-it');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/scenes")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Scenes
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          Choose Your Role
        </h1>
        {selectedSection && (
          <p className="text-center text-primary font-medium mt-1">
            {selectedSection.title}
          </p>
        )}
        <p className="text-center text-muted-foreground mt-2 text-sm">
          {characters.length} character{characters.length !== 1 ? 's' : ''} in this scene
        </p>
      </header>

      {/* Character List */}
      <main className="flex-1 px-6 py-4">
        <div className="max-w-sm mx-auto space-y-3">
          {characters.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No characters found in this scene
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/scenes')}
              >
                Choose Different Scene
              </Button>
            </div>
          ) : (
            characters.map((character) => {
              const isSelected = selectedRole === character;
              
              return (
                <button
                  key={character}
                  onClick={() => handleRoleSelect(character)}
                  className={`
                    w-full p-5 rounded-lg border-2 text-left transition-all duration-200
                    flex items-center justify-between
                    ${isSelected 
                      ? "border-primary bg-primary/5 shadow-md" 
                      : "border-border bg-card hover:border-primary/50 hover:shadow-sm"
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center
                      ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                    `}>
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-serif text-xl font-semibold text-foreground">
                        {character}
                      </h2>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-6 h-6 text-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          Take your place upon the stage
        </p>
      </footer>
    </div>
  );
};

export default RolePicker;
