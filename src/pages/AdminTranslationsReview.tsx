import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, ChevronLeft, Languages, CheckCircle, AlertCircle, Edit, 
  RefreshCw, Save, Eye, XCircle, Plus, Play, Square, TriangleAlert,
  Flag, Scissors, AlertTriangle, Database
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  CANONICAL_SCENE_ID, isCanonicalScene, getSceneLabel, DUPLICATE_SCENE_WARNING,
  getSuspiciousReasons, SUSPICIOUS_HEURISTICS
} from "@/config/canonicalScenes";

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

interface Character {
  name: string;
}

interface ScriptIssue {
  id: string;
  issue_type: string;
  status: string;
  note: string | null;
}

interface LineBlockWithTranslation {
  id: string;
  order_index: number;
  speaker_name: string;
  text_raw: string;
  section_id: string | null;
  section?: ScriptSection;
  translation?: {
    id: string;
    translation_text: string | null;
    status: string;
    review_status: string;
    source: string;
    error: string | null;
    style: string;
  };
  script_issues?: ScriptIssue[];
  suspicious_reasons?: string[];
}

interface DataHealthStats {
  canonical_count: number;
  non_canonical_count: number;
  translations_count: number;
}

const STYLES = [
  { value: "plain_english", label: "Plain English" },
  { value: "plain_english_chatgpt_v1", label: "Modern English (ChatGPT)" },
  { value: "plain_english_gpt5", label: "Modern English (GPT-5)" },
  { value: "kid_modern_english_v1", label: "Kid Modern English" },
];

const ISSUE_TYPES = [
  { value: 'wrong_speaker', label: 'Wrong Speaker' },
  { value: 'needs_split', label: 'Needs Split' },
  { value: 'needs_merge', label: 'Needs Merge' },
  { value: 'wrong_order', label: 'Wrong Order' },
  { value: 'stage_direction_misparsed', label: 'Stage Direction Misparsed' },
  { value: 'duplicate_text', label: 'Duplicate Text' },
  { value: 'other', label: 'Other' },
];

const AdminTranslationsReview = () => {
  const navigate = useNavigate();
  
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showSuspicious, setShowSuspicious] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("plain_english_chatgpt_v1");
  
  const [lineBlocks, setLineBlocks] = useState<LineBlockWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [selectedLine, setSelectedLine] = useState<LineBlockWithTranslation | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  const [generating, setGenerating] = useState(false);
  const [generatingGpt52, setGeneratingGpt52] = useState(false);
  const cancelRef = useRef(false);
  const cancelGpt52Ref = useRef(false);
  
  // Flag issue dialog
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagIssueType, setFlagIssueType] = useState("other");
  const [flagNote, setFlagNote] = useState("");
  const [flagging, setFlagging] = useState(false);
  
  // Data health stats
  const [healthStats, setHealthStats] = useState<DataHealthStats | null>(null);
  
  // Bulk actions
  const [bulkActioning, setBulkActioning] = useState(false);

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

  // Fetch data health stats
  useEffect(() => {
    const fetchHealthStats = async () => {
      const [canonical, nonCanonical] = await Promise.all([
        supabase
          .from('line_blocks')
          .select('id', { count: 'exact', head: true })
          .eq('scene_id', CANONICAL_SCENE_ID),
        supabase
          .from('line_blocks')
          .select('id', { count: 'exact', head: true })
          .neq('scene_id', CANONICAL_SCENE_ID),
      ]);

      // For translations, get block IDs first then count
      const { data: transData } = await supabase
        .from('line_blocks')
        .select('id')
        .eq('scene_id', CANONICAL_SCENE_ID);
      
      const blockIds = transData?.map(b => b.id) || [];
      const { count: transCount } = await supabase
        .from('lineblock_translations')
        .select('id', { count: 'exact', head: true })
        .eq('style', selectedStyle)
        .eq('status', 'complete')
        .in('lineblock_id', blockIds.length > 0 ? blockIds : ['none']);

      setHealthStats({
        canonical_count: canonical.count || 0,
        non_canonical_count: nonCanonical.count || 0,
        translations_count: transCount || 0,
      });
    };

    if (isAdmin) fetchHealthStats();
  }, [isAdmin]);

  // Fetch scenes
  useEffect(() => {
    const fetchScenes = async () => {
      const { data } = await supabase
        .from('scenes')
        .select('id, title')
        .order('created_at', { ascending: false });

      // Filter to only canonical by default unless showDuplicates is on
      const filtered = showDuplicates ? data : data?.filter(s => isCanonicalScene(s.id));
      setScenes(filtered || []);
      
      if (filtered && filtered.length > 0) {
        const canonicalScene = filtered.find(s => s.id === CANONICAL_SCENE_ID);
        setSelectedSceneId(canonicalScene?.id || filtered[0].id);
      }
      setLoading(false);
    };

    if (isAdmin) fetchScenes();
  }, [isAdmin, showDuplicates]);

  // Fetch sections when scene changes
  useEffect(() => {
    const fetchSections = async () => {
      if (!selectedSceneId) return;

      const { data } = await supabase
        .from('script_sections')
        .select('id, title, act_number, scene_number')
        .eq('scene_id', selectedSceneId)
        .order('order_index');

      setSections(data || []);
    };

    fetchSections();
  }, [selectedSceneId]);

  // Fetch characters when scene changes
  useEffect(() => {
    const fetchCharacters = async () => {
      if (!selectedSceneId) return;

      const { data } = await supabase
        .from('characters')
        .select('name')
        .eq('scene_id', selectedSceneId)
        .order('name');

      setCharacters(data || []);
    };

    fetchCharacters();
  }, [selectedSceneId]);

  // Fetch line blocks with translations
  const fetchLineBlocks = async () => {
    if (!selectedSceneId) return;
    
    setLoading(true);

    let query = supabase
      .from('line_blocks')
      .select('id, order_index, speaker_name, text_raw, section_id')
      .eq('scene_id', selectedSceneId)
      .order('order_index');

    if (selectedSectionId) {
      query = query.eq('section_id', selectedSectionId);
    }

    if (selectedCharacter) {
      query = query.ilike('speaker_name', selectedCharacter);
    }

    const { data: blocks } = await query;

    if (!blocks || blocks.length === 0) {
      setLineBlocks([]);
      setLoading(false);
      return;
    }

    // Fetch translations in batches to avoid URL length limits
    const blockIds = blocks.map(b => b.id);
    const BATCH_SIZE = 50;
    const allTranslations: any[] = [];
    const allIssues: any[] = [];

    for (let i = 0; i < blockIds.length; i += BATCH_SIZE) {
      const batchIds = blockIds.slice(i, i + BATCH_SIZE);
      
      const [translationsRes, issuesRes] = await Promise.all([
        supabase
          .from('lineblock_translations')
          .select('id, lineblock_id, translation_text, status, review_status, source, error, style')
          .in('lineblock_id', batchIds)
          .eq('style', selectedStyle),
        supabase
          .from('script_issues')
          .select('id, lineblock_id, issue_type, status, note')
          .in('lineblock_id', batchIds)
          .eq('status', 'open')
      ]);

      if (translationsRes.data) allTranslations.push(...translationsRes.data);
      if (issuesRes.data) allIssues.push(...issuesRes.data);
    }

    const translationMap = new Map(
      allTranslations.map((t: any) => [t.lineblock_id, t])
    );

    const issuesMap = new Map<string, ScriptIssue[]>();
    allIssues.forEach((issue: any) => {
      const existing = issuesMap.get(issue.lineblock_id) || [];
      existing.push(issue);
      issuesMap.set(issue.lineblock_id, existing);
    });

    // Map sections
    const sectionMap = new Map(sections.map(s => [s.id, s]));

    let result: LineBlockWithTranslation[] = blocks.map(block => {
      const translation = translationMap.get(block.id);
      const blockIssues = issuesMap.get(block.id);
      const suspiciousReasons = getSuspiciousReasons({
        text_raw: block.text_raw,
        speaker_name: block.speaker_name,
        translation: translation ? { 
          status: translation.status, 
          translation_text: translation.translation_text 
        } : undefined,
      });
      
      return {
        ...block,
        section: block.section_id ? sectionMap.get(block.section_id) : undefined,
        translation: translation ? { ...translation, style: translation.style } : undefined,
        script_issues: blockIssues,
        suspicious_reasons: suspiciousReasons,
      };
    });

    // Apply filters
    if (statusFilter !== "all") {
      if (statusFilter === "missing") {
        result = result.filter(lb => !lb.translation || lb.translation.status === "missing");
      } else {
        result = result.filter(lb => lb.translation?.status === statusFilter);
      }
    }

    if (reviewFilter !== "all") {
      result = result.filter(lb => lb.translation?.review_status === reviewFilter);
    }

    if (sourceFilter !== "all") {
      result = result.filter(lb => lb.translation?.source === sourceFilter);
    }

    if (showSuspicious) {
      result = result.filter(lb => (lb.suspicious_reasons?.length || 0) > 0);
    }

    setLineBlocks(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchLineBlocks();
  }, [selectedSceneId, selectedSectionId, selectedCharacter, statusFilter, reviewFilter, sourceFilter, showSuspicious, sections, selectedStyle]);

  const openDetail = (line: LineBlockWithTranslation) => {
    setSelectedLine(line);
    setEditText(line.translation?.translation_text || "");
  };

  const handleSave = async (reviewStatus?: string, source?: string) => {
    if (!selectedLine) return;
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-save-translation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            lineblock_id: selectedLine.id,
            style: selectedStyle,
            translation_text: editText,
            review_status: reviewStatus || selectedLine.translation?.review_status || "needs_review",
            source: source || (selectedLine.translation?.source === 'ai' ? 'ai_edited' : selectedLine.translation?.source || 'manual'),
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success("Translation saved");
      setSelectedLine(null);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async (force = false) => {
    if (!selectedLine) return;
    
    setRegenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lineblock-translation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            lineblock_id: selectedLine.id,
            style: selectedStyle,
            force,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success("Translation regenerated");
      setSelectedLine(null);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  const handleMarkFailed = async () => {
    if (!selectedLine) return;
    
    setSaving(true);
    try {
      await supabase
        .from('lineblock_translations')
        .upsert({
          lineblock_id: selectedLine.id,
          style: selectedStyle,
          status: 'failed',
          error: 'Manually marked as failed',
          source: 'manual',
        }, { onConflict: 'lineblock_id,style' });

      toast.success("Marked as failed");
      setSelectedLine(null);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleFlagIssue = async () => {
    if (!selectedLine) return;
    
    setFlagging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from('script_issues').insert({
        lineblock_id: selectedLine.id,
        issue_type: flagIssueType,
        note: flagNote || null,
        created_by: user.id,
      });

      toast.success("Issue flagged");
      setShowFlagDialog(false);
      setFlagNote("");
      setFlagIssueType("other");
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || "Failed to flag issue");
    } finally {
      setFlagging(false);
    }
  };

  const handleBulkGenerate = async () => {
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
              style: selectedStyle,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        totalProcessed += result.processed || 0;
        hasMore = result.has_more === true;
        
        fetchLineBlocks();
      }

      if (cancelRef.current) {
        toast.info(`Cancelled after ${totalProcessed} translations.`);
      } else {
        toast.success(`Generated ${totalProcessed} translations.`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate');
    } finally {
      setGenerating(false);
      cancelRef.current = false;
    }
  };

  // GPT-5.2 bulk generation
  const handleBulkGenerateGpt52 = async () => {
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
        if (!response.ok) throw new Error(result.error);

        totalProcessed += result.processed || 0;
        hasMore = result.has_more === true;
        
        toast.info(`GPT-5.2: Processed ${totalProcessed} (${result.remaining} remaining)`);
      }

      if (cancelGpt52Ref.current) {
        toast.info(`Cancelled GPT-5.2 after ${totalProcessed} translations.`);
      } else {
        toast.success(`GPT-5.2 generated ${totalProcessed} translations.`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate GPT-5.2 translations');
    } finally {
      setGeneratingGpt52(false);
      cancelGpt52Ref.current = false;
    }
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    const toApprove = lineBlocks.filter(lb => 
      lb.translation?.status === 'complete' && 
      lb.translation?.review_status !== 'approved'
    );
    
    if (toApprove.length === 0) {
      toast.info('No blocks to approve in current view');
      return;
    }

    setBulkActioning(true);
    try {
      const updates = toApprove.map(lb => ({
        lineblock_id: lb.id,
        style: selectedStyle,
        review_status: 'approved',
        translation_text: lb.translation!.translation_text,
        status: 'complete',
        source: lb.translation!.source,
      }));

      await supabase
        .from('lineblock_translations')
        .upsert(updates, { onConflict: 'lineblock_id,style' });

      toast.success(`Approved ${toApprove.length} translations`);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to bulk approve');
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkMarkNeedsReview = async () => {
    const toMark = lineBlocks.filter(lb => 
      lb.translation?.status === 'complete' && 
      lb.translation?.review_status === 'approved'
    );
    
    if (toMark.length === 0) {
      toast.info('No approved blocks in current view');
      return;
    }

    setBulkActioning(true);
    try {
      const updates = toMark.map(lb => ({
        lineblock_id: lb.id,
        style: selectedStyle,
        review_status: 'needs_review',
        translation_text: lb.translation!.translation_text,
        status: 'complete',
        source: lb.translation!.source,
      }));

      await supabase
        .from('lineblock_translations')
        .upsert(updates, { onConflict: 'lineblock_id,style' });

      toast.success(`Marked ${toMark.length} as needs review`);
      fetchLineBlocks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to bulk mark');
    } finally {
      setBulkActioning(false);
    }
  };

  const getStatusBadge = (translation?: LineBlockWithTranslation['translation']) => {
    if (!translation || translation.status === 'missing') {
      return <Badge variant="outline">Missing</Badge>;
    }
    switch (translation.status) {
      case 'complete':
        return <Badge className="bg-green-600">Complete</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{translation.status}</Badge>;
    }
  };

  const getReviewBadge = (translation?: LineBlockWithTranslation['translation']) => {
    if (!translation || !translation.translation_text) return null;
    
    if (translation.review_status === 'approved') {
      return <Badge className="bg-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
    }
    return <Badge variant="outline"><Eye className="w-3 h-3 mr-1" />Needs Review</Badge>;
  };

  const getSourceBadge = (source?: string) => {
    if (!source) return null;
    switch (source) {
      case 'ai':
        return <Badge variant="secondary">AI</Badge>;
      case 'ai_edited':
        return <Badge className="bg-purple-600">AI Edited</Badge>;
      case 'manual':
        return <Badge className="bg-orange-600">Manual</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
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
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              Translation Review
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/script-fix')}>
            <Scissors className="w-4 h-4 mr-2" />
            Script Fix
          </Button>
          {generating ? (
            <Button variant="destructive" size="sm" onClick={() => { cancelRef.current = true; }}>
              <Square className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          ) : (
            <Button size="sm" onClick={handleBulkGenerate}>
              <Play className="w-4 h-4 mr-2" />
              Generate Missing
            </Button>
          )}
          {generatingGpt52 ? (
            <Button variant="destructive" size="sm" onClick={() => { cancelGpt52Ref.current = true; }}>
              <Square className="w-4 h-4 mr-2" />
              Cancel GPT-5.2
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleBulkGenerateGpt52} className="text-purple-600 border-purple-600 hover:bg-purple-50">
              <Play className="w-4 h-4 mr-2" />
              Generate GPT-5.2
            </Button>
          )}
        </div>
      </header>

      {/* Data Health Card */}
      {healthStats && (
        <div className="border-b border-border bg-muted/20 p-4">
          <div className="max-w-7xl mx-auto">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Data Health
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Canonical Blocks:</span>
                    <span className="ml-2 font-medium">{healthStats.canonical_count}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Non-Canonical:</span>
                    <span className="ml-2 font-medium text-orange-600">{healthStats.non_canonical_count}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Translations ({selectedStyle}):</span>
                    <span className="ml-2 font-medium text-green-600">{healthStats.translations_count}</span>
                  </div>
                </div>
                <Progress 
                  value={(healthStats.translations_count / healthStats.canonical_count) * 100} 
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Warning for non-canonical scenes */}
      {selectedSceneId && !isCanonicalScene(selectedSceneId) && (
        <div className="border-b border-destructive/50 bg-destructive/10 p-3">
          <div className="max-w-7xl mx-auto">
            <Alert variant="destructive" className="py-2">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>{DUPLICATE_SCENE_WARNING}</AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger><SelectValue placeholder="Style" /></SelectTrigger>
              <SelectContent>
                {STYLES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSceneId || undefined} onValueChange={setSelectedSceneId}>
              <SelectTrigger><SelectValue placeholder="Scene" /></SelectTrigger>
              <SelectContent>
                {scenes.map(s => (
                  <SelectItem key={s.id} value={s.id}>{getSceneLabel(s.id, s.title)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSectionId || "all"} onValueChange={v => setSelectedSectionId(v === "all" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.act_number && s.scene_number ? `Act ${s.act_number}, Sc ${s.scene_number}` : s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCharacter || "all"} onValueChange={v => setSelectedCharacter(v === "all" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Character" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Characters</SelectItem>
                {characters.map(c => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reviewFilter} onValueChange={setReviewFilter}>
              <SelectTrigger><SelectValue placeholder="Review" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="ai">AI</SelectItem>
                <SelectItem value="ai_edited">AI Edited</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch 
                id="suspicious" 
                checked={showSuspicious} 
                onCheckedChange={setShowSuspicious} 
              />
              <Label htmlFor="suspicious" className="text-sm cursor-pointer">
                Only Suspicious Blocks
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="duplicates" 
                checked={showDuplicates} 
                onCheckedChange={setShowDuplicates} 
              />
              <Label htmlFor="duplicates" className="text-sm cursor-pointer">
                Include Duplicate Scenes
              </Label>
            </div>
            <div className="flex-1" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkApprove}
              disabled={bulkActioning}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve All Shown
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkMarkNeedsReview}
              disabled={bulkActioning}
            >
              <Eye className="w-4 h-4 mr-1" />
              Mark All Needs Review
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <main className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : lineBlocks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No lines found</div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Location</TableHead>
                  <TableHead className="w-28">Speaker</TableHead>
                  <TableHead>Original (excerpt)</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-28">Review</TableHead>
                  <TableHead className="w-24">Source</TableHead>
                  <TableHead className="w-32">Flags</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineBlocks.map(line => (
                  <TableRow key={line.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(line)}>
                    <TableCell className="text-xs text-muted-foreground">
                      {line.section?.act_number && line.section?.scene_number 
                        ? `${line.section.act_number}.${line.section.scene_number}` 
                        : '-'}
                      <br />#{line.order_index}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{line.speaker_name}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm">
                      {line.text_raw.slice(0, 80)}...
                    </TableCell>
                    <TableCell>{getStatusBadge(line.translation)}</TableCell>
                    <TableCell>{getReviewBadge(line.translation)}</TableCell>
                    <TableCell>{getSourceBadge(line.translation?.source)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(line.script_issues?.length || 0) > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <Flag className="w-3 h-3 mr-1" />
                            {line.script_issues?.length} issue(s)
                          </Badge>
                        )}
                        {(line.suspicious_reasons?.length || 0) > 0 && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Suspicious
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDetail(line); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Detail Sheet */}
      <Sheet open={!!selectedLine} onOpenChange={(open) => !open && setSelectedLine(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedLine && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedLine.speaker_name}</Badge>
                  <span className="text-sm text-muted-foreground">#{selectedLine.order_index}</span>
                  {(selectedLine.script_issues?.length || 0) > 0 && (
                    <Badge variant="destructive"><Flag className="w-3 h-3 mr-1" />Has Issues</Badge>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Suspicious warnings */}
                {(selectedLine.suspicious_reasons?.length || 0) > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Suspicious:</strong> {selectedLine.suspicious_reasons?.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Script issues */}
                {(selectedLine.script_issues?.length || 0) > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Open Issues</h4>
                    {selectedLine.script_issues?.map(issue => (
                      <Alert key={issue.id} variant="destructive">
                        <Flag className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{ISSUE_TYPES.find(t => t.value === issue.issue_type)?.label || issue.issue_type}:</strong> {issue.note || 'No note'}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                {/* Original Text */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Original Text</h4>
                  <div className="p-4 bg-muted rounded-lg font-serif text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedLine.text_raw}
                  </div>
                </div>

                {/* Translation Editor */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    Translation
                    {selectedLine.translation?.source && getSourceBadge(selectedLine.translation.source)}
                  </h4>
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Enter modern English translation..."
                    className="min-h-32"
                  />
                  {selectedLine.translation?.error && (
                    <p className="text-sm text-destructive mt-2">
                      Error: {selectedLine.translation.error}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleSave()} disabled={saving || !editText.trim()}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                  
                  <Button variant="outline" onClick={() => handleSave("approved")} disabled={saving || !editText.trim()}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save & Approve
                  </Button>

                  <Button variant="outline" onClick={() => handleSave("needs_review")} disabled={saving || !editText.trim()}>
                    <Eye className="w-4 h-4 mr-2" />
                    Save as Needs Review
                  </Button>

                  <Button variant="outline" onClick={() => handleSave(undefined, "manual")} disabled={saving || !editText.trim()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Save as Manual
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                  <Button variant="secondary" onClick={() => handleRegenerate(false)} disabled={regenerating}>
                    {regenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Regenerate
                  </Button>

                  <Button variant="secondary" onClick={() => handleRegenerate(true)} disabled={regenerating}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Force Regenerate
                  </Button>

                  <Button variant="destructive" onClick={handleMarkFailed} disabled={saving}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Mark Failed
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowFlagDialog(true)}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Flag Parser Issue
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/admin/script-fix')}
                  >
                    <Scissors className="w-4 h-4 mr-2" />
                    Open Script Fix
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Flag Issue Dialog */}
      <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Parser Issue</DialogTitle>
            <DialogDescription>
              Report a parsing problem with this line block
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Issue Type</Label>
              <Select value={flagIssueType} onValueChange={setFlagIssueType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea 
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="Describe the issue..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFlagDialog(false)}>Cancel</Button>
            <Button onClick={handleFlagIssue} disabled={flagging}>
              {flagging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flag className="w-4 h-4 mr-2" />}
              Flag Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTranslationsReview;
