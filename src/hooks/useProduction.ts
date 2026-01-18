import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ScriptSection } from '@/types/scene';

export interface Production {
  id: string;
  name: string;
  description: string | null;
  active_scene_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProduction() {
  const [production, setProduction] = useState<Production | null>(null);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the active production
  const fetchActiveProduction = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('productions')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return null;
    }

    setProduction(data);
    setLoading(false);
    return data;
  }, []);

  // Fetch sections for the active production's script
  const fetchProductionSections = useCallback(async (sceneId: string) => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('script_sections')
      .select('*')
      .eq('scene_id', sceneId)
      .order('order_index', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return [];
    }

    setSections(data || []);
    setLoading(false);
    return data || [];
  }, []);

  // Get characters that appear in a specific section
  const getCharactersInSection = useCallback(async (sceneId: string, sectionId: string) => {
    const { data, error: fetchError } = await supabase
      .from('line_blocks')
      .select('speaker_name')
      .eq('scene_id', sceneId)
      .eq('section_id', sectionId);

    if (fetchError || !data) return [];

    // Get unique speaker names, sorted alphabetically
    const uniqueNames = [...new Set(data.map(d => d.speaker_name))].sort();
    return uniqueNames;
  }, []);

  return {
    production,
    sections,
    loading,
    error,
    fetchActiveProduction,
    fetchProductionSections,
    getCharactersInSection,
  };
}
