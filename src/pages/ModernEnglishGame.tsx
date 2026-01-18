import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, ChevronLeft, Languages, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScene } from "@/context/SceneContext";

interface LineBlockWithTranslation {
  id: string;
  order_index: number;
  speaker_name: string;
  text_raw: string;
  section_id: string | null;
  translation?: {
    translation_text: string | null;
    status: string;
  };
}

interface ScriptSection {
  id: string;
  title: string;
  act_number: number | null;
  scene_number: number | null;
  order_index: number;
}

const ModernEnglishGame = () => {
  const navigate = useNavigate();
  const { activeScriptId, selectedRole } = useScene();
  
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [lineBlocks, setLineBlocks] = useState<LineBlockWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleTranslations, setVisibleTranslations] = useState<Set<string>>(new Set());

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      if (!activeScriptId) return;

      const { data, error } = await supabase
        .from('script_sections')
        .select('*')
        .eq('scene_id', activeScriptId)
        .order('order_index');

      if (error) {
        console.error('Error fetching sections:', error);
        return;
      }

      setSections(data || []);
      if (data && data.length > 0) {
        setSelectedSectionId(data[0].id);
      }
    };

    fetchSections();
  }, [activeScriptId]);

  // Fetch line blocks with translations
  useEffect(() => {
    const fetchLines = async () => {
      if (!activeScriptId) return;
      
      setLoading(true);

      let query = supabase
        .from('line_blocks')
        .select('id, order_index, speaker_name, text_raw, section_id')
        .eq('scene_id', activeScriptId)
        .order('order_index');

      if (selectedSectionId) {
        query = query.eq('section_id', selectedSectionId);
      }

      const { data: blocks, error } = await query;

      if (error) {
        console.error('Error fetching line blocks:', error);
        setLoading(false);
        return;
      }

      if (!blocks || blocks.length === 0) {
        setLineBlocks([]);
        setLoading(false);
        return;
      }

      // Fetch translations for these blocks
      const blockIds = blocks.map(b => b.id);
      const { data: translations } = await supabase
        .from('lineblock_translations')
        .select('lineblock_id, translation_text, status')
        .in('lineblock_id', blockIds)
        .eq('style', 'plain_english');

      const translationMap = new Map(
        (translations || []).map(t => [t.lineblock_id, t])
      );

      const blocksWithTranslations: LineBlockWithTranslation[] = blocks.map(block => ({
        ...block,
        translation: translationMap.get(block.id),
      }));

      setLineBlocks(blocksWithTranslations);
      setLoading(false);
    };

    fetchLines();
  }, [activeScriptId, selectedSectionId]);

  const toggleTranslation = (lineId: string) => {
    setVisibleTranslations(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const showMyTranslations = () => {
    if (!selectedRole) return;
    const myLineIds = lineBlocks
      .filter(lb => lb.speaker_name.toLowerCase() === selectedRole.toLowerCase())
      .map(lb => lb.id);
    setVisibleTranslations(new Set(myLineIds));
  };

  const showAllTranslations = () => {
    setVisibleTranslations(new Set(lineBlocks.map(lb => lb.id)));
  };

  const hideAllTranslations = () => {
    setVisibleTranslations(new Set());
  };

  const isMyLine = (speakerName: string) => {
    return selectedRole && speakerName.toLowerCase() === selectedRole.toLowerCase();
  };

  if (!activeScriptId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-muted-foreground mb-4">No script selected</p>
          <Button onClick={() => navigate('/practice-modes')}>
            Choose a Game
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/practice-modes')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              Plain English
            </h1>
            {selectedRole && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                Playing as {selectedRole}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Section Picker */}
      {sections.length > 0 && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 overflow-x-auto">
          <div className="flex gap-2">
            {sections.map((section) => (
              <Button
                key={section.id}
                variant={selectedSectionId === section.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSectionId(section.id)}
                className="whitespace-nowrap"
              >
                {section.act_number && section.scene_number
                  ? `Act ${section.act_number}, Scene ${section.scene_number}`
                  : section.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Toggle Controls */}
      <div className="px-4 py-3 border-b border-border bg-card/30 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={showMyTranslations} disabled={!selectedRole}>
          <Eye className="w-4 h-4 mr-1" />
          Show My Lines
        </Button>
        <Button variant="outline" size="sm" onClick={showAllTranslations}>
          <Eye className="w-4 h-4 mr-1" />
          Show All
        </Button>
        <Button variant="outline" size="sm" onClick={hideAllTranslations}>
          <EyeOff className="w-4 h-4 mr-1" />
          Hide All
        </Button>
      </div>

      {/* Lines */}
      <main className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : lineBlocks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No lines found in this section</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {lineBlocks.map((line) => {
              const isMine = isMyLine(line.speaker_name);
              const isVisible = visibleTranslations.has(line.id);
              const hasTranslation = line.translation?.status === 'completed' && line.translation.translation_text;

              return (
                <Card 
                  key={line.id} 
                  className={`transition-all ${isMine ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Badge 
                        variant={isMine ? "default" : "secondary"}
                        className="shrink-0 mt-1"
                      >
                        {line.speaker_name}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-foreground leading-relaxed">
                          {line.text_raw}
                        </p>
                        
                        {hasTranslation && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleTranslation(line.id)}
                              className="mt-2 text-muted-foreground hover:text-foreground"
                            >
                              {isVisible ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-1" />
                                  Hide Translation
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-1" />
                                  Show Translation
                                </>
                              )}
                            </Button>
                            
                            {isVisible && (
                              <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border">
                                <p className="text-sm text-muted-foreground italic">
                                  {line.translation?.translation_text}
                                </p>
                              </div>
                            )}
                          </>
                        )}

                        {!hasTranslation && line.translation?.status === 'error' && (
                          <p className="mt-2 text-sm text-destructive">
                            Translation failed
                          </p>
                        )}

                        {!line.translation && (
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            No translation available
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default ModernEnglishGame;
