import { useEffect, useState } from 'react';
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
  } = useScene();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      // If we already have practice lines for this role, we're good
      if (practiceLines.length > 0) {
        setLoading(false);
        return;
      }

      // Load line blocks
      setLoading(true);
      setError(null);

      let query = supabase
        .from('line_blocks')
        .select('*')
        .eq('scene_id', activeScriptId)
        .order('order_index', { ascending: true });

      // If a specific section is selected, filter by it
      // If selectedSection is null, we get all sections (Practice All)
      if (selectedSection) {
        query = query.eq('section_id', selectedSection.id);
      }

      const { data: blocks, error: fetchError } = await query;

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

      // Load lines for the selected role
      loadFromLineBlocks(blocks as LineBlock[], selectedRole);
      setLoading(false);
    };

    loadData();
  }, [activeScriptId, selectedSection, selectedRole, selectedMode, loadFromLineBlocks, practiceLines.length, navigate]);

  return {
    loading,
    error,
    isReady: !loading && !error && practiceLines.length > 0,
  };
}
