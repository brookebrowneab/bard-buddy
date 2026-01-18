import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Scene, LineBlock, Character, ScriptSection, ParsedSection } from '@/types/scene';

export function useSceneData() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [lineBlocks, setLineBlocks] = useState<LineBlock[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScenes = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('scenes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setScenes(data || []);
    }
    
    setLoading(false);
    return data;
  }, []);

  const fetchScene = useCallback(async (sceneId: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .maybeSingle();
    
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCurrentScene(data);
    }
    
    setLoading(false);
    return data;
  }, []);

  const fetchSections = useCallback(async (sceneId: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('script_sections')
      .select('*')
      .eq('scene_id', sceneId)
      .order('order_index', { ascending: true });
    
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSections(data || []);
    }
    
    setLoading(false);
    return data;
  }, []);

  const fetchLineBlocks = useCallback(async (sceneId: string, sectionId?: string) => {
    setLoading(true);
    setError(null);
    
    let query = supabase
      .from('line_blocks')
      .select('*')
      .eq('scene_id', sceneId)
      .order('order_index', { ascending: true });
    
    if (sectionId) {
      query = query.eq('section_id', sectionId);
    }
    
    const { data, error: fetchError } = await query;
    
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setLineBlocks(data || []);
    }
    
    setLoading(false);
    return data;
  }, []);

  const fetchCharacters = useCallback(async (sceneId: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('characters')
      .select('*')
      .eq('scene_id', sceneId)
      .order('name', { ascending: true });
    
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCharacters(data || []);
    }
    
    setLoading(false);
    return data;
  }, []);

  // Get characters that appear in a specific section
  const getCharactersInSection = useCallback(async (sceneId: string, sectionId: string) => {
    const { data, error: fetchError } = await supabase
      .from('line_blocks')
      .select('speaker_name')
      .eq('scene_id', sceneId)
      .eq('section_id', sectionId);
    
    if (fetchError || !data) return [];
    
    // Get unique speaker names
    const uniqueNames = [...new Set(data.map(d => d.speaker_name))];
    return uniqueNames;
  }, []);

  // Get sections that a specific character appears in
  const getSectionsForCharacter = useCallback(async (sceneId: string, characterName: string) => {
    // First get all section IDs where this character speaks
    const { data: lineData, error: lineError } = await supabase
      .from('line_blocks')
      .select('section_id')
      .eq('scene_id', sceneId)
      .ilike('speaker_name', characterName);
    
    if (lineError || !lineData) return [];
    
    // Get unique section IDs
    const sectionIds = [...new Set(lineData.map(d => d.section_id).filter(Boolean))] as string[];
    
    if (sectionIds.length === 0) return [];
    
    // Fetch the actual sections
    const { data: sectionsData } = await supabase
      .from('script_sections')
      .select('*')
      .in('id', sectionIds)
      .order('order_index', { ascending: true });
    
    return sectionsData || [];
  }, []);

  const createScene = useCallback(async (title: string, pdfTextRaw: string, sourcePdf?: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: insertError } = await supabase
      .from('scenes')
      .insert({
        title,
        pdf_text_raw: pdfTextRaw,
        source_pdf: sourcePdf || null,
      })
      .select()
      .single();
    
    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return null;
    }
    
    setLoading(false);
    return data;
  }, []);

  const updateScene = useCallback(async (sceneId: string, updates: Partial<Scene>) => {
    setLoading(true);
    setError(null);
    
    const { data, error: updateError } = await supabase
      .from('scenes')
      .update(updates)
      .eq('id', sceneId)
      .select()
      .single();
    
    if (updateError) {
      setError(updateError.message);
    } else {
      setCurrentScene(data);
    }
    
    setLoading(false);
    return data;
  }, []);

  const saveSections = useCallback(async (
    sceneId: string,
    parsedSections: ParsedSection[]
  ) => {
    // Delete existing sections for this scene
    await supabase
      .from('script_sections')
      .delete()
      .eq('scene_id', sceneId);
    
    if (parsedSections.length === 0) return [];
    
    // Insert new sections
    const { data, error: insertError } = await supabase
      .from('script_sections')
      .insert(parsedSections.map(section => ({
        scene_id: sceneId,
        title: section.title,
        act_number: section.act_number,
        scene_number: section.scene_number,
        order_index: section.order_index
      })))
      .select();
    
    if (insertError) {
      setError(insertError.message);
      return [];
    }
    
    setSections(data || []);
    return data || [];
  }, []);

  const saveLineBlocks = useCallback(async (
    sceneId: string,
    blocks: Array<{ order_index: number; speaker_name: string; text_raw: string; preceding_cue_raw: string | null; section_index?: number }>,
    sectionIdMap?: Record<number, string> // Maps section_index to section_id
  ) => {
    setLoading(true);
    setError(null);
    
    // Delete existing line blocks for this scene
    await supabase
      .from('line_blocks')
      .delete()
      .eq('scene_id', sceneId);
    
    // Insert new line blocks
    const { data, error: insertError } = await supabase
      .from('line_blocks')
      .insert(blocks.map(block => ({
        scene_id: sceneId,
        order_index: block.order_index,
        speaker_name: block.speaker_name,
        text_raw: block.text_raw,
        preceding_cue_raw: block.preceding_cue_raw,
        section_id: block.section_index !== undefined && sectionIdMap 
          ? sectionIdMap[block.section_index] 
          : null
      })))
      .select();
    
    if (insertError) {
      setError(insertError.message);
    } else {
      setLineBlocks(data || []);
    }
    
    setLoading(false);
    return data;
  }, []);

  const saveCharacters = useCallback(async (sceneId: string, characterNames: string[]) => {
    setLoading(true);
    setError(null);
    
    // Delete existing characters for this scene
    await supabase
      .from('characters')
      .delete()
      .eq('scene_id', sceneId);
    
    // Insert new characters
    const { data, error: insertError } = await supabase
      .from('characters')
      .insert(characterNames.map(name => ({
        scene_id: sceneId,
        name
      })))
      .select();
    
    if (insertError) {
      setError(insertError.message);
    } else {
      setCharacters(data || []);
    }
    
    setLoading(false);
    return data;
  }, []);

  // Refresh characters by syncing with unique speaker names from line_blocks
  const refreshCharacters = useCallback(async (sceneId: string) => {
    // Get unique speaker names from current line blocks
    const { data: blocks, error: fetchError } = await supabase
      .from('line_blocks')
      .select('speaker_name')
      .eq('scene_id', sceneId);
    
    if (fetchError) {
      setError(fetchError.message);
      return false;
    }

    const uniqueSpeakers = [...new Set(blocks?.map(b => b.speaker_name) || [])];

    // Delete all existing characters for this scene
    const { error: deleteError } = await supabase
      .from('characters')
      .delete()
      .eq('scene_id', sceneId);
    
    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    // Insert only the characters that have lines
    if (uniqueSpeakers.length > 0) {
      const { data: newChars, error: insertError } = await supabase
        .from('characters')
        .insert(uniqueSpeakers.map(name => ({ scene_id: sceneId, name })))
        .select();
      
      if (insertError) {
        setError(insertError.message);
        return false;
      }
      
      setCharacters(newChars || []);
    } else {
      setCharacters([]);
    }

    return true;
  }, []);

  const saveStageDirections = useCallback(async (
    sceneId: string,
    directions: Array<{ order_index: number; text_raw: string }>
  ) => {
    // Delete existing stage directions for this scene
    await supabase
      .from('stage_directions')
      .delete()
      .eq('scene_id', sceneId);
    
    // Insert new stage directions
    const { error: insertError } = await supabase
      .from('stage_directions')
      .insert(directions.map(dir => ({
        scene_id: sceneId,
        ...dir
      })));
    
    if (insertError) {
      setError(insertError.message);
    }
  }, []);

  const updateLineBlock = useCallback(async (blockId: string, updates: Partial<LineBlock>) => {
    const { data, error: updateError } = await supabase
      .from('line_blocks')
      .update(updates)
      .eq('id', blockId)
      .select()
      .single();
    
    if (updateError) {
      setError(updateError.message);
      return null;
    }
    
    // Update local state
    setLineBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
    
    return data;
  }, []);

  const deleteLineBlock = useCallback(async (blockId: string) => {
    const { error: deleteError } = await supabase
      .from('line_blocks')
      .delete()
      .eq('id', blockId);
    
    if (deleteError) {
      setError(deleteError.message);
      return false;
    }
    
    // Update local state
    setLineBlocks(prev => prev.filter(block => block.id !== blockId));
    
    return true;
  }, []);

  const convertToStageDirection = useCallback(async (block: LineBlock) => {
    // Get the highest order_index from existing stage directions
    const { data: existingDirections } = await supabase
      .from('stage_directions')
      .select('order_index')
      .eq('scene_id', block.scene_id)
      .order('order_index', { ascending: false })
      .limit(1);
    
    const nextOrderIndex = existingDirections && existingDirections.length > 0 
      ? existingDirections[0].order_index + 1 
      : block.order_index;

    // Insert as stage direction
    const { error: insertError } = await supabase
      .from('stage_directions')
      .insert({
        scene_id: block.scene_id,
        order_index: nextOrderIndex,
        text_raw: block.text_raw
      });
    
    if (insertError) {
      setError(insertError.message);
      return false;
    }

    // Delete the line block
    const { error: deleteError } = await supabase
      .from('line_blocks')
      .delete()
      .eq('id', block.id);
    
    if (deleteError) {
      setError(deleteError.message);
      return false;
    }
    
    // Update local state
    setLineBlocks(prev => prev.filter(b => b.id !== block.id));
    
    return true;
  }, []);

  const deleteScene = useCallback(async (sceneId: string) => {
    const { error: deleteError } = await supabase
      .from('scenes')
      .delete()
      .eq('id', sceneId);
    
    if (deleteError) {
      setError(deleteError.message);
      return false;
    }
    
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    return true;
  }, []);

  return {
    scenes,
    currentScene,
    lineBlocks,
    characters,
    sections,
    loading,
    error,
    fetchScenes,
    fetchScene,
    fetchSections,
    fetchLineBlocks,
    fetchCharacters,
    getCharactersInSection,
    getSectionsForCharacter,
    createScene,
    updateScene,
    saveSections,
    saveLineBlocks,
    saveCharacters,
    saveStageDirections,
    updateLineBlock,
    deleteLineBlock,
    convertToStageDirection,
    refreshCharacters,
    deleteScene,
    setCurrentScene,
    setLineBlocks,
    setSections,
  };
}
