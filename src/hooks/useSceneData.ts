import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Scene, LineBlock, Character } from '@/types/scene';

export function useSceneData() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [lineBlocks, setLineBlocks] = useState<LineBlock[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
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

  const fetchLineBlocks = useCallback(async (sceneId: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('line_blocks')
      .select('*')
      .eq('scene_id', sceneId)
      .order('order_index', { ascending: true });
    
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

  const saveLineBlocks = useCallback(async (
    sceneId: string,
    blocks: Array<{ order_index: number; speaker_name: string; text_raw: string; preceding_cue_raw: string | null }>
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
        ...block
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
    loading,
    error,
    fetchScenes,
    fetchScene,
    fetchLineBlocks,
    fetchCharacters,
    createScene,
    updateScene,
    saveLineBlocks,
    saveCharacters,
    saveStageDirections,
    updateLineBlock,
    deleteScene,
    setCurrentScene,
    setLineBlocks,
  };
}
