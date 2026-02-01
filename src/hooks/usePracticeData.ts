import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useScene } from '@/context/SceneContext';
import type { LineBlock } from '@/types/scene';

/**
 * Hook to load line blocks for practice modes.
 * Ensures we have the right data before starting practice.
 */
export function usePracticeData() {
  const navigate = useNavigate();
  const {
    activeScriptId,
    selectedSection,
    selectedRole,
    selectedMode,
    loadFromLineBlocks,
    practiceLines,
    setPracticeLines,
  } = useScene();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track what we loaded to avoid duplicate loads but allow reloads on changes
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Validate we have required data
      if (!selectedMode) {
        navigate('/');
        return;
      }

      if (!activeScriptId) {
        navigate('/role-picker');
        return;
      }

      if (!selectedRole) {
        navigate('/role-picker');
        return;
      }

      // Create a key to track what we've loaded
      const loadKey = `${activeScriptId}-${selectedSection?.id || 'all'}-${selectedRole}`;
      
      // If we already loaded this exact combination, we're good
      if (loadedRef.current === loadKey && practiceLines.length > 0) {
        setLoading(false);
        return;
      }

      // Load line blocks
      setLoading(true);
      setError(null);

      // If a specific section is selected, simple query with order_index
      if (selectedSection) {
        const { data: blocks, error: fetchError } = await supabase
          .from('line_blocks')
          .select('*')
          .eq('scene_id', activeScriptId)
          .eq('section_id', selectedSection.id)
          .order('order_index', { ascending: true });

        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        if (!blocks || blocks.length === 0) {
          setError('No lines found');
          setLoading(false);
          return;
        }

        loadFromLineBlocks(blocks as LineBlock[], selectedRole);
        loadedRef.current = loadKey;
        setLoading(false);
        return;
      }

      // Practice All: need to fetch sections for proper ordering
      const [blocksResult, sectionsResult] = await Promise.all([
        supabase
          .from('line_blocks')
          .select('*')
          .eq('scene_id', activeScriptId)
          .order('order_index', { ascending: true }),
        supabase
          .from('script_sections')
          .select('id, order_index')
          .eq('scene_id', activeScriptId)
          .order('order_index', { ascending: true })
      ]);

      if (blocksResult.error) {
        setError(blocksResult.error.message);
        setLoading(false);
        return;
      }

      if (!blocksResult.data || blocksResult.data.length === 0) {
        setError('No lines found');
        setLoading(false);
        return;
      }

      // Create a map of section_id to order_index for sorting
      const sectionOrderMap = new Map<string, number>();
      if (sectionsResult.data) {
        sectionsResult.data.forEach((section) => {
          sectionOrderMap.set(section.id, section.order_index);
        });
      }

      // Sort blocks: first by section order_index, then by line order_index
      // Lines with null section_id go at the end
      const sortedBlocks = [...blocksResult.data].sort((a, b) => {
        const aSectionOrder = a.section_id ? (sectionOrderMap.get(a.section_id) ?? Infinity) : Infinity;
        const bSectionOrder = b.section_id ? (sectionOrderMap.get(b.section_id) ?? Infinity) : Infinity;
        
        if (aSectionOrder !== bSectionOrder) {
          return aSectionOrder - bSectionOrder;
        }
        return a.order_index - b.order_index;
      });

      loadFromLineBlocks(sortedBlocks as LineBlock[], selectedRole);
      loadedRef.current = loadKey;
      setLoading(false);
    };

    loadData();
  }, [activeScriptId, selectedSection, selectedRole, selectedMode, loadFromLineBlocks, practiceLines.length, setPracticeLines, navigate]);

  return {
    loading,
    error,
    isReady: !loading && !error && practiceLines.length > 0,
  };
}
