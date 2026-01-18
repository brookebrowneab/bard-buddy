import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScene } from "@/context/SceneContext";
import { useProduction } from "@/hooks/useProduction";
import { ArrowLeft, User, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const RolePicker = () => {
  const navigate = useNavigate();
  const { 
    selectedRole, 
    setSelectedRole, 
    characters, 
    setCharacters, 
    setActiveScriptId,
    setProductionName,
    selectedMode,
  } = useScene();
  const { fetchActiveProduction } = useProduction();
  
  const [loading, setLoading] = useState(true);
  const [productionTitle, setProductionTitle] = useState('');

  // Load all characters from the active production's script
  useEffect(() => {
    const loadCharacters = async () => {
      setLoading(true);
      
      // Get the active production
      const prod = await fetchActiveProduction();
      if (!prod || !prod.active_scene_id) {
        setLoading(false);
        return;
      }

      setProductionTitle(prod.name);
      setProductionName(prod.name);
      setActiveScriptId(prod.active_scene_id);

      // Get all unique characters from this script
      const { data: chars, error } = await supabase
        .from('characters')
        .select('name')
        .eq('scene_id', prod.active_scene_id)
        .order('name', { ascending: true });

      if (!error && chars) {
        setCharacters(chars.map(c => c.name));
      }
      
      setLoading(false);
    };

    loadCharacters();
  }, [fetchActiveProduction, setActiveScriptId, setProductionName, setCharacters]);

  // Redirect if no mode selected
  useEffect(() => {
    if (!selectedMode) {
      navigate('/');
    }
  }, [selectedMode, navigate]);

  const handleRoleSelect = (character: string) => {
    setSelectedRole(character);
    // Go to scene picker to choose which scene to practice
    navigate('/scenes');
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
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Games
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          Who Are You Playing?
        </h1>
        {productionTitle && (
          <p className="text-center text-primary font-medium mt-1">
            {productionTitle}
          </p>
        )}
        <p className="text-center text-muted-foreground mt-2 text-sm">
          {characters.length} character{characters.length !== 1 ? 's' : ''} in this production
        </p>
      </header>

      {/* Character List */}
      <main className="flex-1 px-6 py-4 overflow-y-auto">
        <div className="max-w-sm mx-auto space-y-3">
          {characters.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No characters found
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/')}
              >
                Back to Games
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
