import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff, ChevronLeft, Languages, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScene } from "@/context/SceneContext";
import { CANONICAL_SCENE_ID } from "@/config/canonicalScenes";

interface LineBlockWithTranslation {
  id: string;
  order_index: number;
  speaker_name: string;
  text_raw: string;
  section_id: string | null;
  translation?: {
    translation_text: string | null;
    status: string;
    review_status: string;
  };
}

interface ScriptSection {
  id: string;
  title: string;
  act_number: number | null;
  scene_number: number | null;
  order_index: number;
}

interface Character {
  name: string;
}

// Available translation styles
const TRANSLATION_STYLES = [
  { value: "plain_english_chatgpt_v1", label: "Modern English (ChatGPT)" },
  { value: "plain_english", label: "Modern English (GPT-4o-mini)" },
  { value: "plain_english_gpt52_v1", label: "Modern English (GPT-5.2)" },
] as const;

const DEFAULT_STYLE = "plain_english_chatgpt_v1";

// localStorage keys for persisting toggles
const STORAGE_KEYS = {
  VISIBLE_MODE: 'modernEnglish_visibleMode',
  SELECTED_SECTION: 'modernEnglish_selectedSection',
  SELECTED_CHARACTER: 'modernEnglish_selectedCharacter',
  TRANSLATION_STYLE: 'modernEnglish_translationStyle',
};

type VisibleMode = 'none' | 'mine' | 'all';

const ModernEnglishSceneViewer = () => {
  const navigate = useNavigate();
  const { selectedRole } = useScene();
  
  // Always use canonical scene for kid-facing viewer
  const sceneId = CANONICAL_SCENE_ID;
  
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_STYLE);
  const [lineBlocks, setLineBlocks] = useState<LineBlockWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleMode, setVisibleMode] = useState<VisibleMode>('none');
  const [visibleTranslations, setVisibleTranslations] = useState<Set<string>>(new Set());

  // Load persisted settings on mount
  useEffect(() => {
    const savedMode = localStorage.getItem(STORAGE_KEYS.VISIBLE_MODE) as VisibleMode | null;
    const savedSection = localStorage.getItem(STORAGE_KEYS.SELECTED_SECTION);
    const savedCharacter = localStorage.getItem(STORAGE_KEYS.SELECTED_CHARACTER);

    if (savedMode) setVisibleMode(savedMode);
    if (savedSection) setSelectedSectionId(savedSection);
    if (savedCharacter) setSelectedCharacter(savedCharacter);

    // Force ChatGPT style to avoid stale cached styles causing "No translation available yet"
    setSelectedStyle(DEFAULT_STYLE);
    localStorage.setItem(STORAGE_KEYS.TRANSLATION_STYLE, DEFAULT_STYLE);
  }, []);

  // Set character from context
  useEffect(() => {
    if (selectedRole && !selectedCharacter) {
      setSelectedCharacter(selectedRole);
      localStorage.setItem(STORAGE_KEYS.SELECTED_CHARACTER, selectedRole);
    }
  }, [selectedRole, selectedCharacter]);

  // Persist settings changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VISIBLE_MODE, visibleMode);
  }, [visibleMode]);

  useEffect(() => {
    if (selectedSectionId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_SECTION, selectedSectionId);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    if (selectedCharacter) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_CHARACTER, selectedCharacter);
    }
  }, [selectedCharacter]);

  // Persist style changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSLATION_STYLE, selectedStyle);
  }, [selectedStyle]);

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      const { data } = await supabase
        .from('script_sections')
        .select('*')
        .eq('scene_id', sceneId)
        .order('order_index');

      setSections(data || []);
      
      // Set initial section from localStorage or first section
      if (data && data.length > 0) {
        const savedSection = localStorage.getItem(STORAGE_KEYS.SELECTED_SECTION);
        const validSection = data.find(s => s.id === savedSection);
        setSelectedSectionId(validSection?.id || data[0].id);
      }
    };

    fetchSections();
  }, [sceneId]);

  // Fetch characters
  useEffect(() => {
    const fetchCharacters = async () => {
      const { data } = await supabase
        .from('characters')
        .select('name')
        .eq('scene_id', sceneId)
        .order('name');

      setCharacters(data || []);
    };

    fetchCharacters();
  }, [sceneId]);

  // Fetch line blocks with translations - READ ONLY, no AI calls
  useEffect(() => {
    let isActive = true;

    const fetchLines = async () => {
      // Avoid a "fetch everything" call before we know the active section.
      if (!selectedSectionId) {
        if (!isActive) return;
        setLineBlocks([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      let query = supabase
        .from('line_blocks')
        .select('id, order_index, speaker_name, text_raw, section_id')
        .eq('scene_id', sceneId)
        .eq('section_id', selectedSectionId)
        .order('order_index');

      const { data: blocks, error: blocksError } = await query;

      if (!isActive) return;

      if (blocksError) {
        console.error('Error fetching line blocks:', blocksError);
        setLineBlocks([]);
        setLoading(false);
        return;
      }

      if (!blocks || blocks.length === 0) {
        setLineBlocks([]);
        setLoading(false);
        return;
      }

      // Fetch translations for these blocks using selected style
      const blockIds = blocks.map(b => b.id);
      const { data: translations, error: translationsError } = await supabase
        .from('lineblock_translations_public')
        .select('lineblock_id, translation_text, status, review_status')
        .in('lineblock_id', blockIds)
        .eq('style', selectedStyle);

      if (!isActive) return;

      if (translationsError) {
        console.error('Error fetching translations:', translationsError);
      }

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

    return () => {
      isActive = false;
    };
  }, [sceneId, selectedSectionId, selectedStyle]);

  // Update visible translations when mode or data changes
  useEffect(() => {
    if (visibleMode === 'none') {
      setVisibleTranslations(new Set());
    } else if (visibleMode === 'all') {
      setVisibleTranslations(new Set(lineBlocks.map(lb => lb.id)));
    } else if (visibleMode === 'mine' && selectedCharacter) {
      const myLineIds = lineBlocks
        .filter(lb => lb.speaker_name.toLowerCase() === selectedCharacter.toLowerCase())
        .map(lb => lb.id);
      setVisibleTranslations(new Set(myLineIds));
    }
  }, [visibleMode, lineBlocks, selectedCharacter]);

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
    // When manually toggling, we're in a custom state
    setVisibleMode('none');
  };

  const showMyTranslations = () => {
    setVisibleMode('mine');
  };

  const showAllTranslations = () => {
    setVisibleMode('all');
  };

  const hideAllTranslations = () => {
    setVisibleMode('none');
  };

  const isMyLine = (speakerName: string) => {
    return selectedCharacter && speakerName.toLowerCase() === selectedCharacter.toLowerCase();
  };

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
              Modern English
              <Badge variant="outline" className="text-xs ml-2">Viewer v2 (canonical)</Badge>
            </h1>
            {selectedCharacter && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                Playing as {selectedCharacter}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Section & Character Selection */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-3">
        {/* Section Picker */}
        {sections.length > 0 && (
          <div className="overflow-x-auto">
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

        {/* Character Picker */}
        <div className="flex flex-wrap gap-3">
          {characters.length > 0 && (
            <Select value={selectedCharacter || "all"} onValueChange={v => setSelectedCharacter(v === "all" ? null : v)}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Select your character" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Characters</SelectItem>
                {characters.map(c => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Translation Style Picker */}
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Translation style" />
            </SelectTrigger>
            <SelectContent>
              {TRANSLATION_STYLES.map(style => (
                <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Toggle Controls */}
      <div className="px-4 py-3 border-b border-border bg-card/30 flex flex-wrap gap-2">
        <Button 
          variant={visibleMode === 'mine' ? "default" : "outline"} 
          size="sm" 
          onClick={showMyTranslations} 
          disabled={!selectedCharacter}
        >
          <Eye className="w-4 h-4 mr-1" />
          Show My Lines
        </Button>
        <Button 
          variant={visibleMode === 'all' ? "default" : "outline"} 
          size="sm" 
          onClick={showAllTranslations}
        >
          <Eye className="w-4 h-4 mr-1" />
          Show All
        </Button>
        <Button 
          variant={visibleMode === 'none' ? "default" : "outline"} 
          size="sm" 
          onClick={hideAllTranslations}
        >
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
              const hasTranslation = line.translation?.status === 'complete' && line.translation.translation_text;

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

                        {!hasTranslation && line.translation?.status === 'failed' && (
                          <p className="mt-2 text-sm text-destructive">
                            Translation not available
                          </p>
                        )}

                        {!line.translation && (
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            No translation available yet
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

export default ModernEnglishSceneViewer;
