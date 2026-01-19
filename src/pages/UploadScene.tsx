import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSceneData } from '@/hooks/useSceneData';
import { extractTextFromPdf } from '@/lib/pdfParser';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, Loader2, Users, MessageSquare, Layers } from 'lucide-react';
import AppBreadcrumbs from '@/components/AppBreadcrumbs';
import type { ParseResult } from '@/types/scene';

const UploadScene = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createScene, saveLineBlocks, saveCharacters, saveStageDirections, saveSections, updateScene } = useSceneData();
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [sceneId, setSceneId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file',
        variant: 'destructive',
      });
      return;
    }
    
    setFile(selectedFile);
    setExtractedText(null);
    setParseResult(null);
    setSceneId(null);
    
    // Auto-set title from filename
    const fileName = selectedFile.name.replace(/\.pdf$/i, '');
    if (!title) {
      setTitle(fileName);
    }
  };

  const handleExtractAndParse = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      });
      return;
    }

    // Check if user is authenticated as admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please log in as an admin to upload scripts',
        variant: 'destructive',
      });
      return;
    }

    // Step 0: Extract text from PDF
    setIsExtracting(true);
    let pdfText: string;
    
    try {
      pdfText = await extractTextFromPdf(file);
      setExtractedText(pdfText);
      console.log('Extracted PDF text:', pdfText.substring(0, 500) + '...');
    } catch (error) {
      console.error('PDF extraction error:', error);
      toast({
        title: 'Extraction failed',
        description: 'Failed to extract text from PDF. Please try another file.',
        variant: 'destructive',
      });
      setIsExtracting(false);
      return;
    }
    
    setIsExtracting(false);
    setIsParsing(true);

    try {
      // Call the parse-pdf edge function with auth header
      const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-pdf', {
        body: {
          pdf_text_raw: pdfText,
          scene_title: title || file.name,
        },
      });

      if (parseError) {
        throw new Error(parseError.message);
      }

      if (!parseData.success) {
        throw new Error(parseData.error || 'Parsing failed');
      }

      const result: ParseResult = parseData.data;
      setParseResult(result);

      // Create scene in database
      const scene = await createScene(title || file.name, pdfText, file.name);
      
      if (!scene) {
        throw new Error('Failed to create scene');
      }

      setSceneId(scene.id);

      // Update scene with normalized text
      await updateScene(scene.id, { normalized_text: result.normalized_text });

      // Save sections first and get their IDs
      const savedSections = await saveSections(scene.id, result.sections);
      
      // Create a map from section_index to section_id
      const sectionIdMap: Record<number, string> = {};
      savedSections.forEach((section, index) => {
        sectionIdMap[index] = section.id;
      });

      // Save line blocks with section references
      await saveLineBlocks(scene.id, result.line_blocks, sectionIdMap);

      // Save characters
      await saveCharacters(scene.id, result.characters);

      // Save stage directions
      await saveStageDirections(scene.id, result.stage_directions);

      toast({
        title: 'Script uploaded!',
        description: `Found ${result.characters.length} characters, ${result.line_blocks.length} lines, and ${result.sections.length} scenes`,
      });

    } catch (error) {
      console.error('Parsing error:', error);
      toast({
        title: 'Parsing failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleReviewParse = () => {
    if (sceneId) {
      navigate(`/parse-review/${sceneId}`);
    }
  };

  const handleStartPractice = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <AppBreadcrumbs className="mb-4" />
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          Upload Script (Admin)
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          Upload the full Much Ado About Nothing script
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Select PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="Script title (e.g., Much Ado About Nothing)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                {file ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-primary" />
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Click to upload PDF
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or drag and drop
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Extract & Parse Button */}
          <Button
            variant="stage"
            size="lg"
            className="w-full"
            onClick={handleExtractAndParse}
            disabled={!file || isExtracting || isParsing}
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Extracting text...
              </>
            ) : isParsing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Parsing script...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Extract & Parse Script
              </>
            )}
          </Button>

          {/* Parse Results Summary */}
          {parseResult && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg text-primary">
                  Script Uploaded!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                    <Users className="w-5 h-5 text-primary mb-1" />
                    <p className="text-2xl font-bold text-foreground">
                      {parseResult.characters.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Characters</p>
                  </div>
                  
                  <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                    <Layers className="w-5 h-5 text-primary mb-1" />
                    <p className="text-2xl font-bold text-foreground">
                      {parseResult.sections.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Scenes</p>
                  </div>
                  
                  <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                    <MessageSquare className="w-5 h-5 text-primary mb-1" />
                    <p className="text-2xl font-bold text-foreground">
                      {parseResult.line_blocks.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Lines</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Scenes detected:</p>
                  <div className="flex flex-wrap gap-2">
                    {parseResult.sections.map((section, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-background rounded-full text-xs text-foreground border border-border"
                      >
                        {section.title}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Characters:</p>
                  <div className="flex flex-wrap gap-2">
                    {parseResult.characters.map((char) => (
                      <span
                        key={char}
                        className="px-3 py-1 bg-background rounded-full text-sm text-foreground border border-border"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleReviewParse}
                  >
                    Review Parse
                  </Button>
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={handleStartPractice}
                  >
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          Admin: Upload the script once for all students
        </p>
      </footer>
    </div>
  );
};

export default UploadScene;
