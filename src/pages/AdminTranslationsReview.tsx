import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  Loader2, ChevronLeft, Languages, CheckCircle, AlertCircle, Edit, 
  RefreshCw, Save, Eye, XCircle, Plus, Play, Square
} from "lucide-react";
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

interface Character {
  name: string;
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
  };
}

const STYLE = "kid_modern_english_v1";

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
  
  const [lineBlocks, setLineBlocks] = useState<LineBlockWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [selectedLine, setSelectedLine] = useState<LineBlockWithTranslation | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  const [generating, setGenerating] = useState(false);
  const cancelRef = useRef(false);

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

  // Fetch scenes
  useEffect(() => {
    const fetchScenes = async () => {
      const { data } = await supabase
        .from('scenes')
        .select('id, title')
        .order('created_at', { ascending: false });

      setScenes(data || []);
      if (data && data.length > 0) {
        setSelectedSceneId(data[0].id);
      }
      setLoading(false);
    };

    if (isAdmin) fetchScenes();
  }, [isAdmin]);

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

    // Fetch translations
    const blockIds = blocks.map(b => b.id);
    const { data: translations } = await supabase
      .from('lineblock_translations')
      .select('id, lineblock_id, translation_text, status, review_status, source, error')
      .in('lineblock_id', blockIds)
      .eq('style', STYLE);

    const translationMap = new Map(
      (translations || []).map(t => [t.lineblock_id, t])
    );

    // Map sections
    const sectionMap = new Map(sections.map(s => [s.id, s]));

    let result: LineBlockWithTranslation[] = blocks.map(block => ({
      ...block,
      section: block.section_id ? sectionMap.get(block.section_id) : undefined,
      translation: translationMap.get(block.id),
    }));

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

    setLineBlocks(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchLineBlocks();
  }, [selectedSceneId, selectedSectionId, selectedCharacter, statusFilter, reviewFilter, sections]);

  const openDetail = (line: LineBlockWithTranslation) => {
    setSelectedLine(line);
    setEditText(line.translation?.translation_text || "");
  };

  const handleSave = async (reviewStatus?: string) => {
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
            style: STYLE,
            translation_text: editText,
            review_status: reviewStatus || selectedLine.translation?.review_status || "needs_review",
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
            style: STYLE,
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
          style: STYLE,
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
              style: STYLE,
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
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-3">
          <Select value={selectedSceneId || undefined} onValueChange={setSelectedSceneId}>
            <SelectTrigger><SelectValue placeholder="Scene" /></SelectTrigger>
            <SelectContent>
              {scenes.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
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
                  <TableHead className="w-24">Location</TableHead>
                  <TableHead className="w-32">Speaker</TableHead>
                  <TableHead>Original (excerpt)</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32">Review</TableHead>
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
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Original Text */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Original Text</h4>
                  <div className="p-4 bg-muted rounded-lg font-serif text-sm leading-relaxed">
                    {selectedLine.text_raw}
                  </div>
                </div>

                {/* Translation Editor */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    Translation
                    {selectedLine.translation?.source && (
                      <Badge variant="outline" className="text-xs">
                        {selectedLine.translation.source}
                      </Badge>
                    )}
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

                  {!selectedLine.translation && (
                    <Button variant="outline" onClick={() => setEditText("")}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Manual
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminTranslationsReview;
