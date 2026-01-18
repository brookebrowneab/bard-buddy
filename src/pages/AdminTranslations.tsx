import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, Languages, Play, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Scene {
  id: string;
  title: string;
}

interface ScriptSection {
  id: string;
  title: string;
  act_number: number | null;
  scene_number: number | null;
}

interface TranslationStats {
  total: number;
  completed: number;
  pending: number;
  error: number;
}

const AdminTranslations = () => {
  const navigate = useNavigate();
  
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [stats, setStats] = useState<TranslationStats>({ total: 0, completed: 0, pending: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to access this page');
        navigate('/');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

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
      const { data, error } = await supabase
        .from('scenes')
        .select('id, title')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching scenes:', error);
        return;
      }

      setScenes(data || []);
      if (data && data.length > 0) {
        setSelectedSceneId(data[0].id);
      }
      setLoading(false);
    };

    if (isAdmin) {
      fetchScenes();
    }
  }, [isAdmin]);

  // Fetch sections when scene changes
  useEffect(() => {
    const fetchSections = async () => {
      if (!selectedSceneId) return;

      const { data, error } = await supabase
        .from('script_sections')
        .select('id, title, act_number, scene_number')
        .eq('scene_id', selectedSceneId)
        .order('order_index');

      if (error) {
        console.error('Error fetching sections:', error);
        return;
      }

      setSections(data || []);
      setSelectedSectionId(null);
    };

    fetchSections();
  }, [selectedSceneId]);

  // Fetch translation stats
  const fetchStats = async () => {
    if (!selectedSceneId) return;

    let blockQuery = supabase
      .from('line_blocks')
      .select('id')
      .eq('scene_id', selectedSceneId);

    if (selectedSectionId) {
      blockQuery = blockQuery.eq('section_id', selectedSectionId);
    }

    const { data: blocks, error: blocksError } = await blockQuery;

    if (blocksError || !blocks) {
      console.error('Error fetching blocks:', blocksError);
      return;
    }

    const blockIds = blocks.map(b => b.id);
    
    if (blockIds.length === 0) {
      setStats({ total: 0, completed: 0, pending: 0, error: 0 });
      return;
    }

    const { data: translations } = await supabase
      .from('lineblock_translations')
      .select('status')
      .in('lineblock_id', blockIds)
      .eq('style', 'plain_english');

    const completed = (translations || []).filter(t => t.status === 'completed').length;
    const pending = (translations || []).filter(t => t.status === 'pending' || t.status === 'processing').length;
    const errorCount = (translations || []).filter(t => t.status === 'error').length;

    setStats({
      total: blockIds.length,
      completed,
      pending,
      error: errorCount,
    });
  };

  useEffect(() => {
    fetchStats();
  }, [selectedSceneId, selectedSectionId, refreshKey]);

  const handleGenerateTranslations = async () => {
    if (!selectedSceneId) return;

    setGenerating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        return;
      }

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
            style: 'plain_english',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate translations');
      }

      toast.success(
        `Generated ${result.processed} translations. ${result.already_complete} were already complete.`
      );

      // Refresh stats
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error generating translations:', error);
      toast.error(error.message || 'Failed to generate translations');
    } finally {
      setGenerating(false);
    }
  };

  const progressPercent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              Admin: Translations
            </h1>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scene Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Script</CardTitle>
                <CardDescription>Choose a script to manage translations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedSceneId || undefined} onValueChange={setSelectedSceneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a scene" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenes.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        {scene.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {sections.length > 0 && (
                  <Select 
                    value={selectedSectionId || "all"} 
                    onValueChange={(v) => setSelectedSectionId(v === "all" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.act_number && section.scene_number
                            ? `Act ${section.act_number}, Scene ${section.scene_number}`
                            : section.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            {selectedSceneId && (
              <Card>
                <CardHeader>
                  <CardTitle>Translation Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <Badge variant="secondary" className="gap-1">
                      Total: {stats.total}
                    </Badge>
                    <Badge variant="default" className="gap-1 bg-green-600">
                      <CheckCircle className="w-3 h-3" />
                      Complete: {stats.completed}
                    </Badge>
                    {stats.pending > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Pending: {stats.pending}
                      </Badge>
                    )}
                    {stats.error > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Errors: {stats.error}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Progress value={progressPercent} className="h-3" />
                    <p className="text-sm text-muted-foreground text-center">
                      {Math.round(progressPercent)}% complete
                    </p>
                  </div>

                  <Button
                    onClick={handleGenerateTranslations}
                    disabled={generating || stats.total === 0}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Generate Missing Translations
                      </>
                    )}
                  </Button>

                  {stats.total - stats.completed > 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      {stats.total - stats.completed} translations remaining
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminTranslations;
