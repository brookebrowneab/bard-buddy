import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Loader2, ChevronLeft, Save, CheckCircle, AlertCircle, RefreshCw, Scissors, Combine, ChevronUp, ChevronDown } from "lucide-react";
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
  scene_id: string;
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
  
  // Track translation edits: lineblock_id -> edited text
  const [translationEdits, setTranslationEdits] = useState<Map<string, string>>(new Map());
  // Track raw text edits: lineblock_id -> edited text
  const [rawTextEdits, setRawTextEdits] = useState<Map<string, string>>(new Map());
  // Track which are currently saving
  const [saving, setSaving] = useState<Set<string>>(new Set());
  // Track save status: lineblock_id -> 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState<Map<string, 'saved' | 'error'>>(new Map());
  
  // Auto-save timers
  const translationTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const rawTextTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Session for API calls
  const sessionRef = useRef<any>(null);

  // Split dialog state
  const [selectedBlock, setSelectedBlock] = useState<LineBlockWithTranslation | null>(null);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitPosition, setSplitPosition] = useState(0);
  const [splitting, setSplitting] = useState(false);
  const [newBlockSpeaker, setNewBlockSpeaker] = useState("");

  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<'prev' | 'next' | null>(null);
  const [merging, setMerging] = useState(false);

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

  // Keep sessionRef up to date (important for token refresh)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionRef.current = session;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  // Fetch line blocks with translations
  const fetchLineBlocks = useCallback(async (silent = false) => {
    if (!selectedSectionId) return;
    
    if (!silent) setLoading(true);

    const { data: blocks } = await supabase
      .from('line_blocks')
      .select('id, order_index, speaker_name, text_raw, section_id, scene_id')
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
    setLoading(false);
  }, [selectedSectionId, selectedStyle]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchLineBlocks();
    }
  }, [selectedSectionId, selectedStyle, fetchLineBlocks]);

  const getValidAccessToken = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error("Not authenticated");

    const expiresAtMs = (session.expires_at ?? 0) * 1000;
    if (expiresAtMs && expiresAtMs < Date.now() + 30_000) {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !data.session) {
        throw refreshError ?? new Error("Session expired");
      }
      sessionRef.current = data.session;
      return data.session.access_token;
    }

    sessionRef.current = session;
    return session.access_token;
  }, []);

  // Save translation
  const saveTranslation = useCallback(async (lineblockId: string, text: string) => {
    setSaving(prev => new Set(prev).add(lineblockId));
    setSaveStatus(prev => {
      const next = new Map(prev);
      next.delete(lineblockId);
      return next;
    });

    try {
      const token = await getValidAccessToken();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-translation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
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
      
      setTranslationEdits(prev => {
        const next = new Map(prev);
        next.delete(lineblockId);
        return next;
      });
      
      setSaveStatus(prev => new Map(prev).set(lineblockId, 'saved'));
      
      setTimeout(() => {
        setSaveStatus(prev => {
          const next = new Map(prev);
          if (next.get(lineblockId) === 'saved') {
            next.delete(lineblockId);
          }
          return next;
        });
      }, 2000);
      
    } catch (error: any) {
      setSaveStatus(prev => new Map(prev).set(lineblockId, 'error'));

      const message = error?.message || "Failed to save translation";
      if (message === "Not authenticated" || message === "Session expired") {
        toast.error("Your session expired. Please sign in again.");
        await supabase.auth.signOut();
        navigate('/admin/login');
        return;
      }

      toast.error('Failed to save translation');
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(lineblockId);
        return next;
      });
    }
  }, [getValidAccessToken, navigate, selectedStyle]);

  // Save raw text
  const saveRawText = useCallback(async (lineblockId: string, text: string) => {
    const savingKey = `raw-${lineblockId}`;
    setSaving(prev => new Set(prev).add(savingKey));
    setSaveStatus(prev => {
      const next = new Map(prev);
      next.delete(savingKey);
      return next;
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const block = lineBlocks.find(lb => lb.id === lineblockId);
      const oldText = block?.text_raw || '';

      const { error } = await supabase
        .from('line_blocks')
        .update({ text_raw: text })
        .eq('id', lineblockId);

      if (error) throw error;

      // Log audit
      await supabase.from('lineblock_edit_audit').insert({
        lineblock_id: lineblockId,
        action: 'edit',
        field_name: 'text_raw',
        old_value: oldText,
        new_value: text,
        reason: 'Manual edit in translation editor',
        changed_by: user.id,
      });

      setLineBlocks(prev => prev.map(lb => 
        lb.id === lineblockId ? { ...lb, text_raw: text } : lb
      ));
      
      setRawTextEdits(prev => {
        const next = new Map(prev);
        next.delete(lineblockId);
        return next;
      });
      
      setSaveStatus(prev => new Map(prev).set(savingKey, 'saved'));
      
      setTimeout(() => {
        setSaveStatus(prev => {
          const next = new Map(prev);
          if (next.get(savingKey) === 'saved') {
            next.delete(savingKey);
          }
          return next;
        });
      }, 2000);
      
    } catch (error: any) {
      setSaveStatus(prev => new Map(prev).set(savingKey, 'error'));
      toast.error('Failed to save raw text');
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(savingKey);
        return next;
      });
    }
  }, [lineBlocks]);

  // Handle translation text change with auto-save
  const handleTranslationChange = useCallback((lineblockId: string, text: string) => {
    setTranslationEdits(prev => new Map(prev).set(lineblockId, text));
    
    const existingTimer = translationTimers.current.get(lineblockId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      saveTranslation(lineblockId, text);
      translationTimers.current.delete(lineblockId);
    }, AUTO_SAVE_DELAY);
    
    translationTimers.current.set(lineblockId, timer);
  }, [saveTranslation]);

  // Handle raw text change with auto-save
  const handleRawTextChange = useCallback((lineblockId: string, text: string) => {
    setRawTextEdits(prev => new Map(prev).set(lineblockId, text));
    
    const existingTimer = rawTextTimers.current.get(lineblockId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      saveRawText(lineblockId, text);
      rawTextTimers.current.delete(lineblockId);
    }, AUTO_SAVE_DELAY);
    
    rawTextTimers.current.set(lineblockId, timer);
  }, [saveRawText]);

  // Manual save functions
  const handleManualSaveTranslation = useCallback((lineblockId: string) => {
    const text = translationEdits.get(lineblockId);
    if (text !== undefined) {
      const existingTimer = translationTimers.current.get(lineblockId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        translationTimers.current.delete(lineblockId);
      }
      saveTranslation(lineblockId, text);
    }
  }, [translationEdits, saveTranslation]);

  const handleManualSaveRawText = useCallback((lineblockId: string) => {
    const text = rawTextEdits.get(lineblockId);
    if (text !== undefined) {
      const existingTimer = rawTextTimers.current.get(lineblockId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        rawTextTimers.current.delete(lineblockId);
      }
      saveRawText(lineblockId, text);
    }
  }, [rawTextEdits, saveRawText]);

  // Regenerate translation
  const handleRegenerate = useCallback(async (lineblockId: string) => {
    setSaving(prev => new Set(prev).add(lineblockId));

    try {
      const token = await getValidAccessToken();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lineblock-translation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
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
        setTranslationEdits(prev => {
          const next = new Map(prev);
          next.delete(lineblockId);
          return next;
        });
      }
    } catch (error: any) {
      const message = error?.message || "Failed to regenerate";
      if (message === "Not authenticated" || message === "Session expired") {
        toast.error("Your session expired. Please sign in again.");
        await supabase.auth.signOut();
        navigate('/admin/login');
        return;
      }

      toast.error(message);
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(lineblockId);
        return next;
      });
    }
  }, [getValidAccessToken, navigate, selectedStyle]);

  // Get adjacent blocks
  const getPrevBlock = useCallback(() => {
    if (!selectedBlock) return null;
    const idx = lineBlocks.findIndex(b => b.id === selectedBlock.id);
    return idx > 0 ? lineBlocks[idx - 1] : null;
  }, [selectedBlock, lineBlocks]);

  const getNextBlock = useCallback(() => {
    if (!selectedBlock) return null;
    const idx = lineBlocks.findIndex(b => b.id === selectedBlock.id);
    return idx < lineBlocks.length - 1 ? lineBlocks[idx + 1] : null;
  }, [selectedBlock, lineBlocks]);

  // SPLIT operation
  const handleSplit = async () => {
    if (!selectedBlock || splitPosition <= 0 || splitPosition >= selectedBlock.text_raw.length) {
      toast.error('Invalid split position');
      return;
    }

    setSplitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const textBefore = selectedBlock.text_raw.slice(0, splitPosition).trim();
      const textAfter = selectedBlock.text_raw.slice(splitPosition).trim();

      // Get all blocks in the same section with order_index > current
      const { data: laterBlocks } = await supabase
        .from('line_blocks')
        .select('id, order_index')
        .eq('scene_id', selectedBlock.scene_id)
        .eq('section_id', selectedBlock.section_id)
        .gt('order_index', selectedBlock.order_index)
        .order('order_index', { ascending: false });

      // Increment order_index for later blocks to make room
      for (const block of (laterBlocks || [])) {
        await supabase
          .from('line_blocks')
          .update({ order_index: block.order_index + 1 })
          .eq('id', block.id);
      }

      // Update original block with first part
      await supabase
        .from('line_blocks')
        .update({ text_raw: textBefore })
        .eq('id', selectedBlock.id);

      // Create new block with second part
      const newSpeaker = newBlockSpeaker.trim() || selectedBlock.speaker_name;
      const { data: newBlock } = await supabase
        .from('line_blocks')
        .insert({
          scene_id: selectedBlock.scene_id,
          section_id: selectedBlock.section_id,
          speaker_name: newSpeaker,
          text_raw: textAfter,
          order_index: selectedBlock.order_index + 1,
        })
        .select()
        .single();

      // Log audit for both blocks
      await supabase.from('lineblock_edit_audit').insert([
        {
          lineblock_id: selectedBlock.id,
          action: 'split',
          field_name: 'text_raw',
          old_value: selectedBlock.text_raw,
          new_value: textBefore,
          reason: 'Split operation - kept first part',
          changed_by: user.id,
        },
        {
          lineblock_id: newBlock?.id,
          action: 'split',
          field_name: 'text_raw',
          old_value: null,
          new_value: textAfter,
          reason: 'Split operation - new block with second part',
          changed_by: user.id,
        },
      ]);

      // Invalidate translations for affected blocks
      const blockIdsToInvalidate = [selectedBlock.id];
      if (newBlock) blockIdsToInvalidate.push(newBlock.id);
      
      await supabase
        .from('lineblock_translations')
        .upsert(
          blockIdsToInvalidate.map(id => ({
            lineblock_id: id,
            style: selectedStyle,
            status: 'missing',
            review_status: 'needs_review',
            translation_text: null,
            source: 'ai',
          })),
          { onConflict: 'lineblock_id,style' }
        );

      toast.success('Block split successfully');
      setShowSplitDialog(false);
      setSelectedBlock(null);
      setNewBlockSpeaker("");
      setSplitPosition(0);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to split');
    } finally {
      setSplitting(false);
    }
  };

  // MERGE operation
  const handleMerge = async () => {
    if (!selectedBlock || !mergeTarget) return;

    const targetBlock = mergeTarget === 'prev' ? getPrevBlock() : getNextBlock();
    if (!targetBlock) {
      toast.error('No adjacent block to merge with');
      return;
    }

    setMerging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine which block comes first
      const firstBlock = mergeTarget === 'prev' ? targetBlock : selectedBlock;
      const secondBlock = mergeTarget === 'prev' ? selectedBlock : targetBlock;
      
      const mergedText = `${firstBlock.text_raw}\n${secondBlock.text_raw}`;

      // Update first block with merged text
      await supabase
        .from('line_blocks')
        .update({ text_raw: mergedText })
        .eq('id', firstBlock.id);

      // Log audit before deleting second block
      await supabase.from('lineblock_edit_audit').insert({
        lineblock_id: firstBlock.id,
        action: 'merge',
        field_name: 'text_raw',
        old_value: firstBlock.text_raw,
        new_value: mergedText,
        reason: `Merged with block #${secondBlock.order_index}`,
        changed_by: user.id,
      });

      // Delete audit records for the second block before deleting the block
      // (foreign key with ON DELETE SET NULL would fail since lineblock_id is NOT NULL)
      await supabase
        .from('lineblock_edit_audit')
        .delete()
        .eq('lineblock_id', secondBlock.id);

      // Delete translations for the second block
      await supabase
        .from('lineblock_translations')
        .delete()
        .eq('lineblock_id', secondBlock.id);

      // Delete the second block
      await supabase
        .from('line_blocks')
        .delete()
        .eq('id', secondBlock.id);

      // Reindex remaining blocks in section
      const { data: remainingBlocks } = await supabase
        .from('line_blocks')
        .select('id, order_index')
        .eq('scene_id', selectedBlock.scene_id)
        .eq('section_id', selectedBlock.section_id)
        .order('order_index');

      for (let i = 0; i < (remainingBlocks || []).length; i++) {
        const block = remainingBlocks![i];
        if (block.order_index !== i) {
          await supabase
            .from('line_blocks')
            .update({ order_index: i })
            .eq('id', block.id);
        }
      }

      // Invalidate translation for merged block
      await supabase
        .from('lineblock_translations')
        .upsert({
          lineblock_id: firstBlock.id,
          style: selectedStyle,
          status: 'missing',
          review_status: 'needs_review',
          translation_text: null,
          source: 'ai',
        }, { onConflict: 'lineblock_id,style' });

      toast.success('Blocks merged successfully');
      setShowMergeDialog(false);
      setSelectedBlock(null);
      setMergeTarget(null);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to merge');
    } finally {
      setMerging(false);
    }
  };

  // Open split dialog
  const openSplitDialog = (block: LineBlockWithTranslation) => {
    setSelectedBlock(block);
    setSplitPosition(Math.floor(block.text_raw.length / 2));
    setNewBlockSpeaker("");
    setShowSplitDialog(true);
  };

  // Open merge dialog
  const openMergeDialog = (block: LineBlockWithTranslation) => {
    setSelectedBlock(block);
    setMergeTarget(null);
    setShowMergeDialog(true);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      translationTimers.current.forEach(timer => clearTimeout(timer));
      rawTextTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const getTranslationDisplayText = (lb: LineBlockWithTranslation) => {
    if (translationEdits.has(lb.id)) {
      return translationEdits.get(lb.id) || '';
    }
    return lb.translation?.translation_text || '';
  };

  const getRawTextDisplayText = (lb: LineBlockWithTranslation) => {
    if (rawTextEdits.has(lb.id)) {
      return rawTextEdits.get(lb.id) || '';
    }
    return lb.text_raw;
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
                      {section.title}
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
              const isRawSaving = saving.has(`raw-${lb.id}`);
              const status = saveStatus.get(lb.id);
              const rawStatus = saveStatus.get(`raw-${lb.id}`);
              const hasTranslationEdit = translationEdits.has(lb.id);
              const hasRawEdit = rawTextEdits.has(lb.id);
              const translationText = getTranslationDisplayText(lb);
              const rawText = getRawTextDisplayText(lb);
              const isMissing = !lb.translation || lb.translation.status === 'missing';
              
              return (
                <div 
                  key={lb.id} 
                  className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-card hover:border-primary/30 transition-colors"
                >
                  {/* Left column: Original text (editable) */}
                  <div className="space-y-2 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          #{lb.order_index}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {lb.speaker_name}
                        </Badge>
                        {isRawSaving && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                        {rawStatus === 'saved' && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                        {rawStatus === 'error' && (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        {hasRawEdit && !isRawSaving && (
                          <span className="text-xs text-amber-500">unsaved</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {hasRawEdit && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => handleManualSaveRawText(lb.id)}
                            disabled={isRawSaving}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs"
                          onClick={() => openSplitDialog(lb)}
                          title="Split line"
                        >
                          <Scissors className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs"
                          onClick={() => openMergeDialog(lb)}
                          title="Merge with adjacent"
                        >
                          <Combine className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={rawText}
                      onChange={(e) => handleRawTextChange(lb.id, e.target.value)}
                      className="flex-1 min-h-[60px] text-sm resize-none font-serif"
                    />
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
                        {hasTranslationEdit && !isSaving && (
                          <span className="text-xs text-amber-500">unsaved</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {hasTranslationEdit && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => handleManualSaveTranslation(lb.id)}
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
                      onChange={(e) => handleTranslationChange(lb.id, e.target.value)}
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

      {/* Split Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5" />
              Split Line Block
            </DialogTitle>
            <DialogDescription>
              Split this line block at the cursor position
            </DialogDescription>
          </DialogHeader>
          
          {selectedBlock && (
            <div className="space-y-4">
              {/* Visual text with split indicator */}
              <div>
                <Label className="mb-2 block">Click or drag to set split point</Label>
                <div className="p-3 border rounded bg-muted text-sm font-serif whitespace-pre-wrap select-none">
                  <span className="text-primary font-medium">
                    {selectedBlock.text_raw.slice(0, splitPosition)}
                  </span>
                  <span className="inline-block w-0.5 h-5 bg-destructive mx-0.5 animate-pulse align-middle" />
                  <span className="text-muted-foreground">
                    {selectedBlock.text_raw.slice(splitPosition)}
                  </span>
                </div>
              </div>

              {/* Slider for split position */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Split Position</Label>
                  <span className="text-xs text-muted-foreground">
                    Character {splitPosition} of {selectedBlock.text_raw.length}
                  </span>
                </div>
                <Slider
                  value={[splitPosition]}
                  onValueChange={([value]) => setSplitPosition(value)}
                  min={1}
                  max={selectedBlock.text_raw.length - 1}
                  step={1}
                  className="w-full"
                />
              </div>
              
              {/* Preview of resulting blocks */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">First Part → #{selectedBlock.order_index}</Label>
                  <div className="p-2 border rounded bg-card text-xs font-serif mt-1 min-h-[40px]">
                    {selectedBlock.text_raw.slice(0, splitPosition) || <span className="text-muted-foreground italic">empty</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Second Part → #{selectedBlock.order_index + 1}</Label>
                  <div className="p-2 border rounded bg-card text-xs font-serif mt-1 min-h-[40px]">
                    {selectedBlock.text_raw.slice(splitPosition) || <span className="text-muted-foreground italic">empty</span>}
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Speaker for New Block (leave empty to keep same)</Label>
                <Input
                  value={newBlockSpeaker}
                  onChange={(e) => setNewBlockSpeaker(e.target.value)}
                  placeholder={selectedBlock.speaker_name}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSplit} disabled={splitting}>
              {splitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Split Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Combine className="w-5 h-5" />
              Merge Line Blocks
            </DialogTitle>
            <DialogDescription>
              Choose which adjacent block to merge with
            </DialogDescription>
          </DialogHeader>
          
          {selectedBlock && (
            <div className="space-y-4">
              <div>
                <Label>Current Block (#{selectedBlock.order_index})</Label>
                <div className="p-3 border rounded bg-muted text-sm font-serif">
                  <span className="font-bold">{selectedBlock.speaker_name}:</span> {selectedBlock.text_raw}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {getPrevBlock() && (
                  <Button
                    variant={mergeTarget === 'prev' ? 'default' : 'outline'}
                    onClick={() => setMergeTarget('prev')}
                    className="h-auto py-3 flex flex-col items-start text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ChevronUp className="w-4 h-4" />
                      <span>Merge with Previous</span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      #{getPrevBlock()!.order_index}: {getPrevBlock()!.text_raw.slice(0, 50)}...
                    </span>
                  </Button>
                )}
                
                {getNextBlock() && (
                  <Button
                    variant={mergeTarget === 'next' ? 'default' : 'outline'}
                    onClick={() => setMergeTarget('next')}
                    className="h-auto py-3 flex flex-col items-start text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ChevronDown className="w-4 h-4" />
                      <span>Merge with Next</span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      #{getNextBlock()!.order_index}: {getNextBlock()!.text_raw.slice(0, 50)}...
                    </span>
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={merging || !mergeTarget}>
              {merging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Merge Blocks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTranslationEditor;
