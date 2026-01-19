import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, Save, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CANONICAL_SCENE_ID } from "@/config/canonicalScenes";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppBreadcrumbs from "@/components/AppBreadcrumbs";

interface ScriptSection {
  id: string;
  title: string;
  act_number: number | null;
  scene_number: number | null;
}

interface LineBlockWithTranslation {
  id: string;
  order_index: number;
  speaker_name: string;
  text_raw: string;
  section_id: string | null;
  translation?: {
    id: string;
    translation_text: string | null;
    status: string;
    review_status: string;
  };
}

const STYLES = [
  { value: "plain_english_chatgpt_v1", label: "Modern English (ChatGPT)" },
  { value: "plain_english_gpt5", label: "Modern English (GPT-5)" },
  { value: "kid_modern_english_v1", label: "Kid Modern English" },
];

const AUTO_SAVE_DELAY = 1500; // ms after typing stops

const AdminTranslationEditor = () => {
  const navigate = useNavigate();
  
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("plain_english_chatgpt_v1");
  
  const [lineBlocks, setLineBlocks] = useState<LineBlockWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Track edits: lineblock_id -> edited text
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  // Track which are currently saving
  const [saving, setSaving] = useState<Set<string>>(new Set());
  // Track save status: lineblock_id -> 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState<Map<string, 'saved' | 'error'>>(new Map());
  
  // Auto-save timers
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Session for API calls
  const sessionRef = useRef<any>(null);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to access this page');
        navigate('/admin/login');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        toast.error('Admin access required');
        navigate('/');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      sessionRef.current = session;
      setIsAdmin(true);
    };

    checkAdmin();
  }, [navigate]);

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      const { data } = await supabase
        .from('script_sections')
        .select('id, title, act_number, scene_number')
        .eq('scene_id', CANONICAL_SCENE_ID)
        .order('order_index');

      setSections(data || []);
      if (data && data.length > 0 && !selectedSectionId) {
        setSelectedSectionId(data[0].id);
      }
    };

    if (isAdmin) fetchSections();
  }, [isAdmin]);

  // Fetch line blocks with translations (without reloading the page)
  const fetchLineBlocks = useCallback(async (silent = false) => {
    if (!selectedSectionId) return;
    
    if (!silent) setLoading(true);

    const { data: blocks } = await supabase
      .from('line_blocks')
      .select('id, order_index, speaker_name, text_raw, section_id')
      .eq('scene_id', CANONICAL_SCENE_ID)
      .eq('section_id', selectedSectionId)
      .order('order_index');

    if (!blocks || blocks.length === 0) {
      setLineBlocks([]);
      setLoading(false);
      return;
    }

    const blockIds = blocks.map(b => b.id);
    
    const { data: translations } = await supabase
      .from('lineblock_translations')
      .select('id, lineblock_id, translation_text, status, review_status')
      .in('lineblock_id', blockIds)
      .eq('style', selectedStyle);

    const translationMap = new Map(
      translations?.map((t: any) => [t.lineblock_id, t]) || []
    );

    const result: LineBlockWithTranslation[] = blocks.map(block => ({
      ...block,
      translation: translationMap.get(block.id),
    }));

    setLineBlocks(result);
    // Clear edits when data reloads (but keep any pending edits)
    // Actually, don't clear - user might be in the middle of editing
    setLoading(false);
  }, [selectedSectionId, selectedStyle]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchLineBlocks();
    }
  }, [selectedSectionId, selectedStyle, fetchLineBlocks]);

  // Auto-save function
  const saveTranslation = useCallback(async (lineblockId: string, text: string) => {
    if (!sessionRef.current) return;
    
    setSaving(prev => new Set(prev).add(lineblockId));
    setSaveStatus(prev => {
      const next = new Map(prev);
      next.delete(lineblockId);
      return next;
    });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-translation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionRef.current.access_token}`,
          },
          body: JSON.stringify({
            lineblock_id: lineblockId,
            style: selectedStyle,
            translation_text: text,
            review_status: 'approved',
            source: 'manual',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      // Update local state without refetching
      setLineBlocks(prev => prev.map(lb => 
        lb.id === lineblockId 
          ? { 
              ...lb, 
              translation: { 
                ...lb.translation,
                id: lb.translation?.id || lineblockId,
                translation_text: text,
                status: 'complete',
                review_status: 'approved',
              } 
            }
          : lb
      ));
      
      // Clear edit from pending edits
      setEdits(prev => {
        const next = new Map(prev);
        next.delete(lineblockId);
        return next;
      });
      
      setSaveStatus(prev => new Map(prev).set(lineblockId, 'saved'));
      
      // Clear saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => {
          const next = new Map(prev);
          if (next.get(lineblockId) === 'saved') {
            next.delete(lineblockId);
          }
          return next;
        });
      }, 2000);
      
    } catch (error) {
      setSaveStatus(prev => new Map(prev).set(lineblockId, 'error'));
      toast.error('Failed to save translation');
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(lineblockId);
        return next;
      });
    }
  }, [selectedStyle]);

  // Handle text change with auto-save
  const handleTextChange = useCallback((lineblockId: string, text: string) => {
    setEdits(prev => new Map(prev).set(lineblockId, text));
    
    // Clear any existing timer
    const existingTimer = saveTimers.current.get(lineblockId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new auto-save timer
    const timer = setTimeout(() => {
      saveTranslation(lineblockId, text);
      saveTimers.current.delete(lineblockId);
    }, AUTO_SAVE_DELAY);
    
    saveTimers.current.set(lineblockId, timer);
  }, [saveTranslation]);

  // Manual save (for immediate save)
  const handleManualSave = useCallback((lineblockId: string) => {
    const text = edits.get(lineblockId);
    if (text !== undefined) {
      // Clear any pending auto-save
      const existingTimer = saveTimers.current.get(lineblockId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        saveTimers.current.delete(lineblockId);
      }
      saveTranslation(lineblockId, text);
    }
  }, [edits, saveTranslation]);

  // Regenerate translation
  const handleRegenerate = useCallback(async (lineblockId: string) => {
    if (!sessionRef.current) return;
    
    setSaving(prev => new Set(prev).add(lineblockId));
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lineblock-translation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionRef.current.access_token}`,
          },
          body: JSON.stringify({
            lineblock_id: lineblockId,
            style: selectedStyle,
            force: true,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success("Translation regenerated");
      
      // Refetch just this block's translation
      const { data: newTrans } = await supabase
        .from('lineblock_translations')
        .select('id, lineblock_id, translation_text, status, review_status')
        .eq('lineblock_id', lineblockId)
        .eq('style', selectedStyle)
        .maybeSingle();
      
      if (newTrans) {
        setLineBlocks(prev => prev.map(lb => 
          lb.id === lineblockId 
            ? { ...lb, translation: newTrans }
            : lb
        ));
        // Clear any pending edit
        setEdits(prev => {
          const next = new Map(prev);
          next.delete(lineblockId);
          return next;
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to regenerate");
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(lineblockId);
        return next;
      });
    }
  }, [selectedStyle]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      saveTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const getDisplayText = (lb: LineBlockWithTranslation) => {
    if (edits.has(lb.id)) {
      return edits.get(lb.id) || '';
    }
    return lb.translation?.translation_text || '';
  };

  if (loading && lineBlocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <AppBreadcrumbs className="mb-2" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">Translation Editor</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={selectedSectionId || ''} onValueChange={setSelectedSectionId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(section => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.act_number && section.scene_number 
                        ? `Act ${section.act_number}, Scene ${section.scene_number}` 
                        : section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map(style => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column editor */}
      <ScrollArea className="flex-1">
        <div className="container mx-auto px-4 py-6">
          <div className="space-y-4">
            {lineBlocks.map((lb) => {
              const isSaving = saving.has(lb.id);
              const status = saveStatus.get(lb.id);
              const hasEdit = edits.has(lb.id);
              const translationText = getDisplayText(lb);
              const isMissing = !lb.translation || lb.translation.status === 'missing';
              
              return (
                <div 
                  key={lb.id} 
                  className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-card hover:border-primary/30 transition-colors"
                >
                  {/* Left column: Original text */}
                  <div className="space-y-2 flex flex-col">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        #{lb.order_index}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {lb.speaker_name}
                      </Badge>
                    </div>
                    <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 flex-1">
                      {lb.text_raw}
                    </div>
                  </div>
                  
                  {/* Right column: Translation (editable) */}
                  <div className="space-y-2 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Translation</span>
                        {isSaving && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                        {status === 'saved' && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                        {status === 'error' && (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        {hasEdit && !isSaving && (
                          <span className="text-xs text-amber-500">unsaved</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {hasEdit && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => handleManualSave(lb.id)}
                            disabled={isSaving}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs"
                          onClick={() => handleRegenerate(lb.id)}
                          disabled={isSaving}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Regen
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={translationText}
                      onChange={(e) => handleTextChange(lb.id, e.target.value)}
                      placeholder={isMissing ? "No translation yet. Type here or click Regen..." : ""}
                      className={`flex-1 min-h-[60px] text-sm resize-none ${isMissing ? 'border-amber-500/50' : ''}`}
                    />
                  </div>
                </div>
              );
            })}
            
            {lineBlocks.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground">
                No line blocks found for this section.
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminTranslationEditor;
