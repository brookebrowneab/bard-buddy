import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, Scissors, Combine, AlertTriangle, Save, RefreshCw, 
  ChevronUp, ChevronDown, TriangleAlert, Trash2, Plus
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CANONICAL_SCENE_ID, isCanonicalScene, getSceneLabel, DUPLICATE_SCENE_WARNING } from "@/config/canonicalScenes";
import AppBreadcrumbs from "@/components/AppBreadcrumbs";

interface ScriptSection {
  id: string;
  title: string;
  act_number: number | null;
  scene_number: number | null;
  order_index: number;
}

interface LineBlock {
  id: string;
  order_index: number;
  speaker_name: string;
  text_raw: string;
  section_id: string | null;
  scene_id: string;
}

interface Scene {
  id: string;
  title: string;
}

const STYLE = "plain_english";

const AdminScriptFix = () => {
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [lineBlocks, setLineBlocks] = useState<LineBlock[]>([]);
  
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<LineBlock | null>(null);
  
  // Split dialog state
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitPosition, setSplitPosition] = useState(0);
  const [splitting, setSplitting] = useState(false);
  const [newBlockSpeaker, setNewBlockSpeaker] = useState("");
  
  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<'prev' | 'next' | null>(null);
  const [merging, setMerging] = useState(false);
  
  // Edit speaker state
  const [editingSpeaker, setEditingSpeaker] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [savingSpeaker, setSavingSpeaker] = useState(false);
  
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Add section dialog state
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  
  // All unique speakers for quick selection
  const [allSpeakers, setAllSpeakers] = useState<string[]>([]);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in');
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

      setIsAdmin(true);
    };
    checkAdmin();
  }, [navigate]);

  // Fetch scenes
  useEffect(() => {
    const fetchScenes = async () => {
      const { data } = await supabase
        .from('scenes')
        .select('id, title')
        .order('created_at', { ascending: false });

      setScenes(data || []);
      if (data && data.length > 0) {
        const canonical = data.find(s => s.id === CANONICAL_SCENE_ID);
        setSelectedSceneId(canonical?.id || data[0].id);
      }
      setLoading(false);
    };

    if (isAdmin) fetchScenes();
  }, [isAdmin]);

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      if (!selectedSceneId) return;

      const { data } = await supabase
        .from('script_sections')
        .select('*')
        .eq('scene_id', selectedSceneId)
        .order('order_index');

      setSections(data || []);
      if (data && data.length > 0) {
        setSelectedSectionId(data[0].id);
      }
    };
    fetchSections();
  }, [selectedSceneId]);

  // Fetch line blocks
  const fetchLineBlocks = async () => {
    if (!selectedSceneId) return;
    
    setLoading(true);
    let query = supabase
      .from('line_blocks')
      .select('*')
      .eq('scene_id', selectedSceneId)
      .order('order_index');

    if (selectedSectionId) {
      query = query.eq('section_id', selectedSectionId);
    }

    const { data } = await query;
    setLineBlocks(data || []);
    
    // Extract unique speakers for the dropdown
    if (data) {
      const uniqueSpeakers = [...new Set(data.map(b => b.speaker_name))].sort();
      setAllSpeakers(uniqueSpeakers);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchLineBlocks();
  }, [selectedSceneId, selectedSectionId]);

  // Get adjacent blocks
  const getPrevBlock = () => {
    if (!selectedBlock) return null;
    const idx = lineBlocks.findIndex(b => b.id === selectedBlock.id);
    return idx > 0 ? lineBlocks[idx - 1] : null;
  };

  const getNextBlock = () => {
    if (!selectedBlock) return null;
    const idx = lineBlocks.findIndex(b => b.id === selectedBlock.id);
    return idx < lineBlocks.length - 1 ? lineBlocks[idx + 1] : null;
  };

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

      // Create new block with second part (use new speaker if specified)
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
            style: STYLE,
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

      // Delete the second block (this will also cascade delete its translations)
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
          style: STYLE,
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

  // Save speaker name
  const handleSaveSpeaker = async () => {
    if (!selectedBlock || !newSpeakerName.trim()) return;

    setSavingSpeaker(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const oldSpeaker = selectedBlock.speaker_name;

      await supabase
        .from('line_blocks')
        .update({ speaker_name: newSpeakerName.trim() })
        .eq('id', selectedBlock.id);

      await supabase.from('lineblock_edit_audit').insert({
        lineblock_id: selectedBlock.id,
        action: 'edit',
        field_name: 'speaker_name',
        old_value: oldSpeaker,
        new_value: newSpeakerName.trim(),
        reason: 'Manual speaker name correction',
        changed_by: user.id,
      });

      toast.success('Speaker name updated');
      setEditingSpeaker(false);
      setSelectedBlock({ ...selectedBlock, speaker_name: newSpeakerName.trim() });
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update speaker');
    } finally {
      setSavingSpeaker(false);
    }
  };

  // DELETE operation
  const handleDelete = async () => {
    if (!selectedBlock) return;

    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Log audit before deletion
      await supabase.from('lineblock_edit_audit').insert({
        lineblock_id: selectedBlock.id,
        action: 'delete',
        field_name: 'text_raw',
        old_value: selectedBlock.text_raw,
        new_value: null,
        reason: `Deleted block #${selectedBlock.order_index} (${selectedBlock.speaker_name})`,
        changed_by: user.id,
      });

      // Delete the block (cascades to translations)
      await supabase
        .from('line_blocks')
        .delete()
        .eq('id', selectedBlock.id);

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

      toast.success('Block deleted');
      setShowDeleteDialog(false);
      setSelectedBlock(null);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // ADD SECTION operation
  // State for insert position - "start", "end", or section ID to insert after
  const [insertAfterSectionId, setInsertAfterSectionId] = useState<string>("end");

  const handleAddSection = async () => {
    if (!selectedSceneId || !newSectionTitle.trim()) {
      toast.error('Please enter a section title');
      return;
    }

    setAddingSection(true);
    try {
      let newOrderIndex: number;

      if (insertAfterSectionId === "start") {
        // Insert at the beginning - shift all existing sections up
        await supabase
          .from('script_sections')
          .update({ order_index: supabase.rpc ? undefined : undefined }) // Placeholder for shift logic
          .eq('scene_id', selectedSceneId);
        
        // Shift all sections' order_index up by 1
        const { data: allSections } = await supabase
          .from('script_sections')
          .select('id, order_index')
          .eq('scene_id', selectedSceneId)
          .order('order_index', { ascending: false });
        
        if (allSections) {
          for (const section of allSections) {
            await supabase
              .from('script_sections')
              .update({ order_index: section.order_index + 1 })
              .eq('id', section.id);
          }
        }
        newOrderIndex = 0;
      } else if (insertAfterSectionId === "end") {
        // Insert at the end
        const { data: existingSections } = await supabase
          .from('script_sections')
          .select('order_index')
          .eq('scene_id', selectedSceneId)
          .order('order_index', { ascending: false })
          .limit(1);

        newOrderIndex = existingSections && existingSections.length > 0 
          ? existingSections[0].order_index + 1 
          : 0;
      } else {
        // Insert after a specific section
        const { data: afterSection } = await supabase
          .from('script_sections')
          .select('order_index')
          .eq('id', insertAfterSectionId)
          .single();

        if (!afterSection) throw new Error('Reference section not found');
        
        const insertPosition = afterSection.order_index + 1;
        
        // Shift all sections after the insert position up by 1
        const { data: sectionsToShift } = await supabase
          .from('script_sections')
          .select('id, order_index')
          .eq('scene_id', selectedSceneId)
          .gte('order_index', insertPosition)
          .order('order_index', { ascending: false });
        
        if (sectionsToShift) {
          for (const section of sectionsToShift) {
            await supabase
              .from('script_sections')
              .update({ order_index: section.order_index + 1 })
              .eq('id', section.id);
          }
        }
        newOrderIndex = insertPosition;
      }

      const { data: newSection, error } = await supabase
        .from('script_sections')
        .insert({
          scene_id: selectedSceneId,
          title: newSectionTitle.trim(),
          order_index: newOrderIndex,
          act_number: null,
          scene_number: null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Section "${newSectionTitle}" created`);
      setShowAddSectionDialog(false);
      setNewSectionTitle("");
      setInsertAfterSectionId("end");
      
      // Refresh sections and select the new one
      const { data: updatedSections } = await supabase
        .from('script_sections')
        .select('*')
        .eq('scene_id', selectedSceneId)
        .order('order_index');
      
      setSections(updatedSections || []);
      if (newSection) {
        setSelectedSectionId(newSection.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add section');
    } finally {
      setAddingSection(false);
    }
  };

  // Regenerate translations for affected blocks
  const handleRegenerateTranslations = async () => {
    if (!selectedSceneId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-translations-bulk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            scene_id: selectedSceneId,
            section_id: selectedSectionId,
            style: STYLE,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success(`Generated ${result.processed || 0} translations`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3">
          <AppBreadcrumbs className="mb-2" />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h1 className="font-semibold text-foreground flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary" />
                Script Fix Tools
              </h1>
              <p className="text-sm text-muted-foreground">Split, merge, and fix line blocks</p>
            </div>
            <Button size="sm" onClick={handleRegenerateTranslations}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Missing
            </Button>
          </div>
        </div>
      </header>

      {/* Non-canonical warning */}
      {selectedSceneId && !isCanonicalScene(selectedSceneId) && (
        <div className="border-b border-destructive/50 bg-destructive/10 p-3">
          <Alert variant="destructive" className="py-2">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>{DUPLICATE_SCENE_WARNING}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Filters */}
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select value={selectedSceneId || undefined} onValueChange={setSelectedSceneId}>
            <SelectTrigger><SelectValue placeholder="Scene" /></SelectTrigger>
            <SelectContent>
              {scenes.map(s => (
                <SelectItem key={s.id} value={s.id}>{getSceneLabel(s.id, s.title)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Select value={selectedSectionId || "all"} onValueChange={v => setSelectedSectionId(v === "all" ? null : v)}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.act_number && s.scene_number ? `Act ${s.act_number}, Scene ${s.scene_number}` : s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setShowAddSectionDialog(true)}
              title="Add new section"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : lineBlocks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No line blocks found</div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-3">
            {lineBlocks.map((block, idx) => (
              <Card 
                key={block.id} 
                className={`cursor-pointer transition-all ${selectedBlock?.id === block.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                onClick={() => {
                  setSelectedBlock(block);
                  setNewSpeakerName(block.speaker_name);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-xs text-muted-foreground w-8">
                      #{block.order_index}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {block.speaker_name}
                    </Badge>
                    <p className="flex-1 text-sm font-serif line-clamp-2">
                      {block.text_raw}
                    </p>
                    {block.text_raw.length > 400 && (
                      <Badge variant="destructive" className="opacity-70">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Long
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Selected block panel */}
      {selectedBlock && (
        <div className="border-t border-border bg-card p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">#{selectedBlock.order_index}</Badge>
              
              {editingSpeaker ? (
                <div className="flex items-center gap-2">
                  <Select value={newSpeakerName} onValueChange={setNewSpeakerName}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select speaker" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSpeakers.map(speaker => (
                        <SelectItem key={speaker} value={speaker}>{speaker}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    value={newSpeakerName}
                    onChange={(e) => setNewSpeakerName(e.target.value)}
                    placeholder="Or type new name"
                    className="w-36"
                  />
                  <Button size="sm" onClick={handleSaveSpeaker} disabled={savingSpeaker}>
                    {savingSpeaker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSpeaker(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditingSpeaker(true)}>
                  {selectedBlock.speaker_name}
                </Button>
              )}
              
              <div className="flex-1" />
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowSplitDialog(true);
                  setNewBlockSpeaker("");
                  setSplitPosition(Math.floor(selectedBlock.text_raw.length / 2));
                }}
              >
                <Scissors className="w-4 h-4 mr-1" />
                Split
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowMergeDialog(true);
                  setMergeTarget(null);
                }}
                disabled={!getPrevBlock() && !getNextBlock()}
              >
                <Combine className="w-4 h-4 mr-1" />
                Merge
              </Button>
              
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
            
            <div className="p-4 bg-muted rounded-lg font-serif text-sm whitespace-pre-wrap">
              {selectedBlock.text_raw}
            </div>
          </div>
        </div>
      )}

      {/* Split Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Split Line Block</DialogTitle>
            <DialogDescription>
              Choose where to split this text. Click in the text or use the slider.
            </DialogDescription>
          </DialogHeader>
          
          {selectedBlock && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Split position (character {splitPosition})</Label>
                <input
                  type="range"
                  min={1}
                  max={selectedBlock.text_raw.length - 1}
                  value={splitPosition}
                  onChange={(e) => setSplitPosition(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">First part (keeps speaker: {selectedBlock.speaker_name})</Label>
                  <div className="p-3 bg-muted rounded-lg font-serif text-sm mt-1 min-h-24">
                    {selectedBlock.text_raw.slice(0, splitPosition)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="text-xs text-muted-foreground">Second part - Speaker:</Label>
                    <Input 
                      value={newBlockSpeaker}
                      onChange={(e) => setNewBlockSpeaker(e.target.value)}
                      placeholder={selectedBlock.speaker_name}
                      className="h-7 text-xs w-40"
                    />
                  </div>
                  <div className="p-3 bg-muted rounded-lg font-serif text-sm mt-1 min-h-24">
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {newBlockSpeaker.trim() || selectedBlock.speaker_name}
                    </Badge>
                    <p>{selectedBlock.text_raw.slice(splitPosition)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitDialog(false)}>Cancel</Button>
            <Button onClick={handleSplit} disabled={splitting}>
              {splitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scissors className="w-4 h-4 mr-2" />}
              Split
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Line Blocks</DialogTitle>
            <DialogDescription>
              Choose which adjacent block to merge with.
            </DialogDescription>
          </DialogHeader>
          
          {selectedBlock && (
            <div className="space-y-4">
              {getPrevBlock() && (
                <Card 
                  className={`cursor-pointer transition-all ${mergeTarget === 'prev' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setMergeTarget('prev')}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ChevronUp className="w-4 h-4" />
                      <Badge variant="outline">Previous: #{getPrevBlock()!.order_index}</Badge>
                      <Badge variant="secondary">{getPrevBlock()!.speaker_name}</Badge>
                    </div>
                    <p className="text-sm font-serif line-clamp-2">{getPrevBlock()!.text_raw}</p>
                  </CardContent>
                </Card>
              )}
              
              <Card className="bg-primary/5 border-primary/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>Current: #{selectedBlock.order_index}</Badge>
                    <Badge variant="secondary">{selectedBlock.speaker_name}</Badge>
                  </div>
                  <p className="text-sm font-serif line-clamp-2">{selectedBlock.text_raw}</p>
                </CardContent>
              </Card>
              
              {getNextBlock() && (
                <Card 
                  className={`cursor-pointer transition-all ${mergeTarget === 'next' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setMergeTarget('next')}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ChevronDown className="w-4 h-4" />
                      <Badge variant="outline">Next: #{getNextBlock()!.order_index}</Badge>
                      <Badge variant="secondary">{getNextBlock()!.speaker_name}</Badge>
                    </div>
                    <p className="text-sm font-serif line-clamp-2">{getNextBlock()!.text_raw}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>Cancel</Button>
            <Button onClick={handleMerge} disabled={merging || !mergeTarget}>
              {merging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Combine className="w-4 h-4 mr-2" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Line Block?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete block #{selectedBlock?.order_index} by {selectedBlock?.speaker_name}. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedBlock && (
            <div className="p-3 bg-muted rounded-lg font-serif text-sm line-clamp-3">
              {selectedBlock.text_raw}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
            <DialogDescription>
              Create a new section (e.g., "Monologues", "Act 6", etc.) for this script.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Section Title</Label>
              <Input 
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., Monologues, Act 6 Scene 1"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label>Insert Position</Label>
              <Select value={insertAfterSectionId} onValueChange={setInsertAfterSectionId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Choose position..." />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="start">At the beginning</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      After: {section.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="end">At the end</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddSection} disabled={addingSection || !newSectionTitle.trim()}>
              {addingSection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminScriptFix;
