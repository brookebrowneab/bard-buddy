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

      if (!selectedSection || !activeScriptId) {
        navigate('/scenes');
        return;
      }

      if (!selectedRole) {
        navigate(`/role-picker/${selectedSection.id}`);
        return;
      }

      // If we already have practice lines for this role, we're good
      if (practiceLines.length > 0) {
        setLoading(false);
        return;
      }

      // Load line blocks for this section
      setLoading(true);
      setError(null);

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
        setError('No lines found for this section');
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
