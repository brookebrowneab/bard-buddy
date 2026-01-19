import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ChevronLeft, Languages, Play, CheckCircle, AlertCircle, RefreshCw, Square, TriangleAlert, Sparkles, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CANONICAL_SCENE_ID, isCanonicalScene, getSceneLabel, DUPLICATE_SCENE_WARNING } from "@/config/canonicalScenes";

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

interface Gpt5Stats {
  completed: number;
  pending: number;
  error: number;
  tooLong: number;
}

const AdminTranslations = () => {
  const navigate = useNavigate();
  
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [stats, setStats] = useState<TranslationStats>({ total: 0, completed: 0, pending: 0, error: 0 });
  const [gpt5Stats, setGpt5Stats] = useState<Gpt5Stats>({ completed: 0, pending: 0, error: 0, tooLong: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingGpt52, setGeneratingGpt52] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const cancelRef = useRef(false);
  const cancelGpt52Ref = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Block diagnostic interface matching edge function response
  interface BlockDiagnostic {
    lineblock_id: string;
    text_char_len: number;
    prompt_char_len: number;
    max_output_tokens: number;
    model: string;
    success: boolean;
    skipped_too_long?: boolean;
    retried_without_sampling?: boolean;
    retried_with_more_tokens?: boolean;
    finish_reason?: string;
    extracted_text_length?: number;
    extracted_text_preview?: string;
    raw_debug?: {
      raw_keys: string[];
      has_output_text: boolean;
      has_choices: boolean;
      has_output_array: boolean;
      preview_output_text?: string;
      preview_extracted_text?: string;
      preview_choices_content?: string;
      preview_output_content?: string;
    };
    error?: {
      http_status?: number;
      type?: string;
      code?: string;
      message: string;
    };
  }

  // Diagnostics state
  const [gpt5Diagnostics, setGpt5Diagnostics] = useState<{
    lastBatchProcessed: number;
    lastBatchErrors: number;
    lastSkippedTooLong: number;
    lastResponse: any;
    lastError: string | null;
    lastRunTime: string | null;
    maxOutputTokens: number;
    maxCharLengthThreshold: number;
    blockDiagnostics: BlockDiagnostic[];
  }>({
    lastBatchProcessed: 0,
    lastBatchErrors: 0,
    lastSkippedTooLong: 0,
    lastResponse: null,
    lastError: null,
    lastRunTime: null,
    maxOutputTokens: 200,
    maxCharLengthThreshold: 1200,
    blockDiagnostics: [],
  });

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
      // Default to canonical scene if available, otherwise first scene
      if (data && data.length > 0) {
        const canonicalScene = data.find(s => s.id === CANONICAL_SCENE_ID);
        setSelectedSceneId(canonicalScene?.id || data[0].id);
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

    // 1) Total line count (fast, uses COUNT)
    let countQuery = supabase
      .from("line_blocks")
      .select("id", { count: "exact", head: true })
      .eq("scene_id", selectedSceneId);

    if (selectedSectionId) {
      countQuery = countQuery.eq("section_id", selectedSectionId);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error("Error fetching block count:", countError);
      return;
    }

    const total = totalCount ?? 0;

    if (total === 0) {
      setStats({ total: 0, completed: 0, pending: 0, error: 0 });
      setGpt5Stats({ completed: 0, pending: 0, error: 0, tooLong: 0 });
      return;
    }

    // 2) Translation counts by joining to line_blocks (avoids huge IN(...) lists)
    const makeTranslationCountQuery = (style: string) => {
      let q = supabase
        .from("lineblock_translations")
        .select("id, line_blocks!inner(scene_id, section_id)", { count: "exact", head: true })
        .eq("style", style)
        .eq("line_blocks.scene_id", selectedSceneId);

      if (selectedSectionId) {
        q = q.eq("line_blocks.section_id", selectedSectionId);
      }

      return q;
    };

    // Standard translations (plain_english)
    const { count: completedCount, error: completedError } = await makeTranslationCountQuery("plain_english").eq(
      "status",
      "complete"
    );
    if (completedError) console.error("Error fetching completed translations:", completedError);

    const { count: errorCount, error: errorStatusError } = await makeTranslationCountQuery("plain_english").eq(
      "status",
      "failed"
    );
    if (errorStatusError) console.error("Error fetching error translations:", errorStatusError);

    // Treat anything not completed as pending/remaining (including missing rows)
    const completed = completedCount ?? 0;
    const error = errorCount ?? 0;
    const pending = Math.max(0, total - completed - error);

    setStats({ total, completed, pending, error });

    // GPT-5 translations (plain_english_gpt5)
    const { count: gpt5CompletedCount } = await makeTranslationCountQuery("plain_english_gpt5").eq(
      "status",
      "complete"
    );
    const { count: gpt5ErrorCount } = await makeTranslationCountQuery("plain_english_gpt5").eq(
      "status",
      "failed"
    );

    // Count "too long" blocks that need split (error contains "too long" or "split required")
    const { count: gpt5TooLongCount } = await makeTranslationCountQuery("plain_english_gpt5")
      .eq("status", "failed")
      .ilike("error", "%split required%");

    const gpt5Completed = gpt5CompletedCount ?? 0;
    const gpt5Error = gpt5ErrorCount ?? 0;
    const gpt5TooLong = gpt5TooLongCount ?? 0;
    const gpt5Pending = Math.max(0, total - gpt5Completed - gpt5Error);

    setGpt5Stats({ completed: gpt5Completed, pending: gpt5Pending, error: gpt5Error, tooLong: gpt5TooLong });
  };

  useEffect(() => {
    fetchStats();
  }, [selectedSceneId, selectedSectionId, refreshKey]);

  // Auto-refresh stats every 5 seconds while generating
  useEffect(() => {
    if (!generating && !generatingGpt52) return;

    const interval = setInterval(() => {
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [generating, selectedSceneId, selectedSectionId]);

  const handleGenerateTranslations = async () => {
    if (!selectedSceneId) return;

    setGenerating(true);
    cancelRef.current = false;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        return;
      }

      let hasMore = true;
      let totalProcessed = 0;
      let totalErrors = 0;

      // Keep calling the function until all translations are done or cancelled
      while (hasMore && !cancelRef.current) {
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

        totalProcessed += result.processed || 0;
        totalErrors += result.errors || 0;
        hasMore = result.has_more === true;

        // Refresh stats after each batch to show progress
        setRefreshKey(prev => prev + 1);
      }

      if (cancelRef.current) {
        toast.info(`Cancelled after generating ${totalProcessed} translations.`);
      } else {
        toast.success(
          `Generated ${totalProcessed} translations${totalErrors > 0 ? ` (${totalErrors} errors)` : ''}.`
        );
      }
    } catch (error: any) {
      console.error('Error generating translations:', error);
      toast.error(error.message || 'Failed to generate translations');
    } finally {
      setGenerating(false);
      cancelRef.current = false;
    }
  };

  const handleCancelGeneration = () => {
    cancelRef.current = true;
  };

  const handleGenerateGpt52 = async () => {
    if (!selectedSceneId) return;

    setGeneratingGpt52(true);
    cancelGpt52Ref.current = false;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        return;
      }

      let hasMore = true;
      let totalProcessed = 0;
      let totalErrors = 0;

      while (hasMore && !cancelGpt52Ref.current) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-translations-gpt52`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              scene_id: selectedSceneId,
              section_id: selectedSectionId,
            }),
          }
        );

        const result = await response.json();
        
        // Update diagnostics with latest response
        setGpt5Diagnostics({
          lastBatchProcessed: result.processed || 0,
          lastBatchErrors: result.errors || 0,
          lastSkippedTooLong: result.skipped_too_long || 0,
          lastResponse: result,
          lastError: response.ok ? null : (result.error || `HTTP ${response.status}`),
          lastRunTime: new Date().toISOString(),
          maxOutputTokens: result.max_output_tokens || 200,
          maxCharLengthThreshold: result.max_char_length_threshold || 1200,
          blockDiagnostics: result.block_diagnostics || [],
        });
        
        if (!response.ok) throw new Error(result.error);

        totalProcessed += result.processed || 0;
        totalErrors += result.errors || 0;
        hasMore = result.has_more === true;
        
        toast.info(`GPT-5: Processed ${result.processed} (${result.remaining} remaining, ${result.errors || 0} errors)`);
        setRefreshKey(prev => prev + 1);
      }

      if (cancelGpt52Ref.current) {
        toast.info(`Cancelled GPT-5 after ${totalProcessed} translations.`);
      } else {
        toast.success(`GPT-5 generated ${totalProcessed} translations (${totalErrors} errors).`);
      }
    } catch (error: any) {
      setGpt5Diagnostics(prev => ({
        ...prev,
        lastError: error.message || 'Unknown error',
        lastRunTime: new Date().toISOString(),
        blockDiagnostics: [],
      }));
      toast.error(error.message || 'Failed to generate GPT-5 translations');
    } finally {
      setGeneratingGpt52(false);
      cancelGpt52Ref.current = false;
    }
  };

  const handleRetryFailedGpt5 = async () => {
    if (!selectedSceneId || gpt5Stats.error === 0) return;

    try {
      // Delete failed GPT-5 translations so they can be retried
      let deleteQuery = supabase
        .from('lineblock_translations')
        .delete()
        .eq('style', 'plain_english_gpt5')
        .eq('status', 'failed');

      // If section is selected, we need to filter by lineblock's section
      if (selectedSectionId) {
        // Get lineblock IDs for this section first
        const { data: lineBlocks } = await supabase
          .from('line_blocks')
          .select('id')
          .eq('scene_id', selectedSceneId)
          .eq('section_id', selectedSectionId);

        if (lineBlocks && lineBlocks.length > 0) {
          const ids = lineBlocks.map(lb => lb.id);
          deleteQuery = deleteQuery.in('lineblock_id', ids);
        }
      } else {
        // Get all lineblock IDs for this scene
        const { data: lineBlocks } = await supabase
          .from('line_blocks')
          .select('id')
          .eq('scene_id', selectedSceneId);

        if (lineBlocks && lineBlocks.length > 0) {
          const ids = lineBlocks.map(lb => lb.id);
          deleteQuery = deleteQuery.in('lineblock_id', ids);
        }
      }

      const { error } = await deleteQuery;
      if (error) throw error;

      toast.success(`Cleared ${gpt5Stats.error} failed translations. Starting regeneration...`);
      setRefreshKey(prev => prev + 1);
      
      // Auto-start generation
      handleGenerateGpt52();
    } catch (error: any) {
      console.error('Error retrying failed:', error);
      toast.error('Failed to clear failed translations');
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        return;
      }

      const csvContent = await file.text();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-translations-csv`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ csv_content: csvContent }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import translations');
      }

      toast.success(`Imported ${result.processed} translations from ${result.total_rows} rows`);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      toast.error(error.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
                        {getSceneLabel(scene.id, scene.title)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSceneId && !isCanonicalScene(selectedSceneId) && (
                  <Alert variant="destructive" className="mt-3">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>{DUPLICATE_SCENE_WARNING}</AlertDescription>
                  </Alert>
                )}

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

            {/* Import CSV */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import Translations CSV
                </CardTitle>
                <CardDescription>
                  Upload a CSV file to import translations. Must have columns: lineblock_id, style, translation_text, model, prompt_version, status, review_status, source
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="hidden"
                  id="csv-import"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  variant="outline"
                  className="w-full"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose CSV File
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            {selectedSceneId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2">
                    Translation Progress
                    {generating && (
                      <Badge variant="secondary" className="gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Standard
                      </Badge>
                    )}
                    {generatingGpt52 && (
                      <Badge className="gap-1 animate-pulse bg-purple-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        GPT-5.2
                      </Badge>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRefreshKey(prev => prev + 1)}
                    title="Refresh stats"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
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
                      {(generating || generatingGpt52) && ' — Generating...'}
                    </p>
                  </div>

                  {generating ? (
                    <Button
                      onClick={handleCancelGeneration}
                      variant="destructive"
                      className="w-full"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Cancel Generation
                    </Button>
                  ) : (
                    <Button
                      onClick={handleGenerateTranslations}
                      disabled={stats.total === 0}
                      className="w-full"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Generate Missing Translations
                    </Button>
                  )}

                  {stats.total - stats.completed > 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      {stats.total - stats.completed} standard translations remaining
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* GPT-5 Stats Card */}
            {selectedSceneId && (
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Sparkles className="w-5 h-5" />
                    GPT-5 Progress
                    {generatingGpt52 && (
                      <Badge className="gap-1 animate-pulse bg-purple-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Running
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <Badge variant="secondary" className="gap-1">
                      Total: {stats.total}
                    </Badge>
                    <Badge className="gap-1 bg-purple-600">
                      <CheckCircle className="w-3 h-3" />
                      Complete: {gpt5Stats.completed}
                    </Badge>
                    {gpt5Stats.pending > 0 && (
                      <Badge variant="outline" className="gap-1 border-purple-300">
                        <RefreshCw className="w-3 h-3" />
                        Pending: {gpt5Stats.pending}
                      </Badge>
                    )}
                    {gpt5Stats.error > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Errors: {gpt5Stats.error}
                      </Badge>
                    )}
                    {gpt5Stats.tooLong > 0 && (
                      <Badge variant="outline" className="gap-1 border-orange-500 text-orange-600">
                        <TriangleAlert className="w-3 h-3" />
                        Too Long: {gpt5Stats.tooLong}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Progress 
                      value={stats.total > 0 ? (gpt5Stats.completed / stats.total) * 100 : 0} 
                      className="h-3 [&>div]:bg-purple-600" 
                    />
                    <p className="text-sm text-muted-foreground text-center">
                      {stats.total > 0 ? Math.round((gpt5Stats.completed / stats.total) * 100) : 0}% complete
                      {generatingGpt52 && ' — Generating...'}
                    </p>
                  </div>

                  {generatingGpt52 ? (
                    <Button
                      onClick={() => { cancelGpt52Ref.current = true; }}
                      variant="destructive"
                      className="w-full"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Cancel GPT-5 Generation
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleGenerateGpt52}
                        disabled={stats.total === 0 || generating}
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate GPT-5
                      </Button>
                      {gpt5Stats.error > 0 && (
                        <Button
                          onClick={handleRetryFailedGpt5}
                          disabled={generating || generatingGpt52}
                          variant="outline"
                          className="border-orange-500 text-orange-600 hover:bg-orange-50"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Retry {gpt5Stats.error} Failed
                        </Button>
                      )}
                    </div>
                  )}

                  {gpt5Stats.pending > 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      {gpt5Stats.pending} GPT-5 translations remaining
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* GPT-5 Diagnostics Panel */}
            {selectedSceneId && gpt5Diagnostics.lastRunTime && (
              <Card className="border-slate-300 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="w-4 h-4" />
                    GPT-5 Diagnostics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Last Run:</span>
                      <p className="font-mono text-xs">{new Date(gpt5Diagnostics.lastRunTime).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Batch:</span>
                      <p className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{gpt5Diagnostics.lastBatchProcessed} processed</Badge>
                        {gpt5Diagnostics.lastBatchErrors > 0 && (
                          <Badge variant="destructive">{gpt5Diagnostics.lastBatchErrors} errors</Badge>
                        )}
                        {gpt5Diagnostics.lastSkippedTooLong > 0 && (
                          <Badge variant="outline" className="border-orange-500 text-orange-600">
                            {gpt5Diagnostics.lastSkippedTooLong} too long
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {/* Config info */}
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <span className="mr-4">Max output tokens: <strong>{gpt5Diagnostics.maxOutputTokens}</strong></span>
                    <span>Max char length: <strong>{gpt5Diagnostics.maxCharLengthThreshold}</strong></span>
                  </div>

                  {/* Global error */}
                  {gpt5Diagnostics.lastError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="font-mono text-xs break-all">
                        {gpt5Diagnostics.lastError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Per-block error rows */}
                  {gpt5Diagnostics.blockDiagnostics.filter(b => !b.success).length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-muted px-3 py-2 text-xs font-medium">
                        Per-Block Error Details
                      </div>
                      <div className="divide-y max-h-60 overflow-auto">
                        {gpt5Diagnostics.blockDiagnostics.filter(b => !b.success).map((block, i) => (
                          <div key={i} className="px-3 py-2 text-xs space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="bg-muted px-1 rounded text-[10px]">{block.lineblock_id.slice(0, 8)}...</code>
                              <span className="text-muted-foreground">
                                text: {block.text_char_len} chars | prompt: {block.prompt_char_len} chars | max_tokens: {block.max_output_tokens}
                              </span>
                              {block.skipped_too_long && (
                                <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-600">TOO LONG</Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {typeof block.extracted_text_length === "number" && (
                                <Badge variant="secondary" className="text-[10px]">
                                  extracted_len: {block.extracted_text_length}
                                </Badge>
                              )}
                              {block.finish_reason && (
                                <Badge variant="secondary" className="text-[10px]">
                                  finish: {block.finish_reason}
                                </Badge>
                              )}
                              {block.retried_without_sampling && (
                                <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                                  no-sampling
                                </Badge>
                              )}
                              {block.retried_with_more_tokens && (
                                <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600">
                                  more-tokens
                                </Badge>
                              )}
                            </div>

                            {block.error && (
                              <div className="text-destructive font-mono pl-2 border-l-2 border-destructive/30">
                                {block.error.http_status && <span className="mr-2">HTTP {block.error.http_status}</span>}
                                {block.error.type && <span className="mr-2">[{block.error.type}]</span>}
                                {block.error.code && <span className="mr-2">({block.error.code})</span>}
                                <span>{block.error.message}</span>
                              </div>
                            )}

                            {block.raw_debug && (
                              <details className="text-[10px]">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  raw response debug
                                </summary>
                                <pre className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
{JSON.stringify(block.raw_debug, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Success blocks summary */}
                  {gpt5Diagnostics.blockDiagnostics.filter(b => b.success).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View {gpt5Diagnostics.blockDiagnostics.filter(b => b.success).length} successful block(s)
                      </summary>
                      <div className="mt-2 divide-y border rounded-md max-h-40 overflow-auto">
                        {gpt5Diagnostics.blockDiagnostics.filter(b => b.success).map((block, i) => (
                          <div key={i} className="px-3 py-2 flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              <code className="bg-muted px-1 rounded text-[10px]">{block.lineblock_id.slice(0, 8)}...</code>
                              <span className="text-muted-foreground">
                                {block.text_char_len} → {block.extracted_text_length || '?'} chars
                              </span>
                              {block.finish_reason && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {block.finish_reason}
                                </Badge>
                              )}
                              {block.retried_without_sampling && (
                                <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                                  no-sampling
                                </Badge>
                              )}
                              {block.retried_with_more_tokens && (
                                <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600">
                                  more-tokens
                                </Badge>
                              )}
                            </div>
                            {block.extracted_text_preview && (
                              <div className="text-[10px] text-muted-foreground pl-5 italic truncate">
                                "{block.extracted_text_preview}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  
                  {gpt5Diagnostics.lastResponse && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View Last Response JSON
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(gpt5Diagnostics.lastResponse, null, 2)}
                      </pre>
                    </details>
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
