import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSceneData } from '@/hooks/useSceneData';
import { useScene } from '@/context/SceneContext';
import { ArrowLeft, Plus, FileText, Trash2, Play, Edit, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SceneList = () => {
  const navigate = useNavigate();
  const { scenes, fetchScenes, deleteScene, loading } = useSceneData();
  const { selectedMode, setSceneId, setSceneTitle } = useScene();

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  // Redirect if no mode selected
  useEffect(() => {
    if (!selectedMode) {
      navigate('/');
    }
  }, [selectedMode, navigate]);

  const handleDelete = async (sceneId: string) => {
    await deleteScene(sceneId);
  };

  const handleSelectScene = (scene: { id: string; title: string }) => {
    setSceneId(scene.id);
    setSceneTitle(scene.title);
    navigate(`/role-picker/${scene.id}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Games
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          Choose a Scene
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''} available
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* Loading */}
          {loading && scenes.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Empty State */}
          {!loading && scenes.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No scenes uploaded yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask an admin to upload a script
                </p>
                <Button
                  variant="stage"
                  size="lg"
                  className="mt-4"
                  onClick={() => navigate('/upload')}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Upload Scene
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Scene List */}
          {scenes.map((scene) => (
            <Card 
              key={scene.id} 
              className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleSelectScene(scene)}
            >
              <CardHeader className="py-4 px-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {scene.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {scene.source_pdf || 'Manual entry'}
                      </p>
                    </div>
                    <Play className="w-5 h-5 text-primary flex-shrink-0" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          Each scene brings you closer to the stage
        </p>
      </footer>
    </div>
  );
};

export default SceneList;