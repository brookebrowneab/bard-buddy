import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSceneData } from '@/hooks/useSceneData';
import { ArrowLeft, Save, RefreshCw, Loader2, Check, ChevronDown, ChevronUp, Trash2, ArrowRightLeft } from 'lucide-react';
import type { LineBlock } from '@/types/scene';

const ParseReview = () => {
  const { sceneId } = useParams<{ sceneId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    currentScene, 
    lineBlocks, 
    fetchScene, 
    fetchLineBlocks, 
    updateLineBlock,
    deleteLineBlock,
    convertToStageDirection,
    refreshCharacters,
    saveLineBlocks,
    loading 
  } = useSceneData();
  
  const [editedBlocks, setEditedBlocks] = useState<LineBlock[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);

  useEffect(() => {
    if (sceneId) {
      fetchScene(sceneId);
      fetchLineBlocks(sceneId);
    }
  }, [sceneId, fetchScene, fetchLineBlocks]);

  useEffect(() => {
    setEditedBlocks(lineBlocks);
  }, [lineBlocks]);

  const handleBlockChange = (blockId: string, field: keyof LineBlock, value: string) => {
    setEditedBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, [field]: value } : block
    ));
  };

  const handleRecomputeCues = () => {
    setIsRecomputing(true);
    
    const recomputed = editedBlocks.map((block, index) => {
      // Find the most recent prior block with a different speaker
      let precedingCue: string | null = null;
      
      for (let i = index - 1; i >= 0; i--) {
        if (editedBlocks[i].speaker_name.toLowerCase() !== block.speaker_name.toLowerCase()) {
          precedingCue = editedBlocks[i].text_raw;
          break;
        }
      }
      
      return { ...block, preceding_cue_raw: precedingCue };
    });
    
    setEditedBlocks(recomputed);
    setIsRecomputing(false);
    
    toast({
      title: 'Cues recomputed',
      description: 'Preceding cues have been recalculated based on speaker order',
    });
  };

  const handleSave = async () => {
    if (!sceneId) return;
    
    setIsSaving(true);
    
    try {
      // Update each block individually
      for (const block of editedBlocks) {
        await updateLineBlock(block.id, {
          speaker_name: block.speaker_name,
          text_raw: block.text_raw,
          preceding_cue_raw: block.preceding_cue_raw,
        });
      }
      
      // Auto-refresh characters to remove orphaned entries
      await refreshCharacters(sceneId);
      
      toast({
        title: 'Changes saved',
        description: 'All line blocks and characters have been updated',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Failed to save changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (blockId: string) => {
    setExpandedBlock(prev => prev === blockId ? null : blockId);
  };

  const handleDeleteBlock = async (blockId: string) => {
    const success = await deleteLineBlock(blockId);
    if (success) {
      setEditedBlocks(prev => prev.filter(block => block.id !== blockId));
      setExpandedBlock(null);
      toast({
        title: 'Line deleted',
        description: 'The line block has been removed',
      });
    } else {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete line block',
        variant: 'destructive',
      });
    }
  };

  const handleConvertToStageDirection = async (block: LineBlock) => {
    const success = await convertToStageDirection(block);
    if (success) {
      setEditedBlocks(prev => prev.filter(b => b.id !== block.id));
      setExpandedBlock(null);
      toast({
        title: 'Converted to stage direction',
        description: 'The line has been moved to stage directions',
      });
    } else {
      toast({
        title: 'Conversion failed',
        description: 'Failed to convert to stage direction',
        variant: 'destructive',
      });
    }
  };

  if (loading && editedBlocks.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 sticky top-0 bg-background z-10 border-b border-border">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/admin')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          Review Parse
        </h1>
        <p className="text-center text-muted-foreground mt-1 text-sm">
          {currentScene?.title || 'Scene'}
        </p>
        <p className="text-center text-muted-foreground text-xs">
          {editedBlocks.length} lines
        </p>
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleRecomputeCues}
            disabled={isRecomputing}
          >
            {isRecomputing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Recompute Cues
          </Button>
          
          <Button
            variant="stage"
            size="sm"
            className="flex-1"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/* Line Blocks List */}
      <main className="flex-1 px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {editedBlocks.map((block, index) => {
            const isExpanded = expandedBlock === block.id;
            
            return (
              <Card 
                key={block.id}
                className={`transition-all ${isExpanded ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader 
                  className="py-3 px-4 cursor-pointer"
                  onClick={() => toggleExpand(block.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono">
                        #{index + 1}
                      </span>
                      <CardTitle className="text-base font-semibold text-foreground">
                        {block.speaker_name}
                      </CardTitle>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  {!isExpanded && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {block.text_raw}
                    </p>
                  )}
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4 space-y-4">
                    {/* Speaker Name */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Speaker Name
                      </label>
                      <Input
                        value={block.speaker_name}
                        onChange={(e) => handleBlockChange(block.id, 'speaker_name', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    
                    {/* Line Text */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Line Text
                      </label>
                      <Textarea
                        value={block.text_raw}
                        onChange={(e) => handleBlockChange(block.id, 'text_raw', e.target.value)}
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                    
                    {/* Preceding Cue */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Preceding Cue (from other character)
                      </label>
                      <Textarea
                        value={block.preceding_cue_raw || ''}
                        onChange={(e) => handleBlockChange(block.id, 'preceding_cue_raw', e.target.value)}
                        className="mt-1 min-h-[80px]"
                        placeholder="No preceding cue (first line)"
                      />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConvertToStageDirection(block)}
                        className="flex-1"
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Convert to Stage Direction
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteBlock(block.id)}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>

      {/* Fixed bottom bar */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="default"
            className="w-full"
            onClick={() => navigate(`/role-picker/${sceneId}`)}
          >
            <Check className="w-4 h-4 mr-2" />
            Done - Choose Role
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ParseReview;
