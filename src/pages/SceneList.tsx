import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSceneData } from '@/hooks/useSceneData';
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

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  const handleDelete = async (sceneId: string) => {
    await deleteScene(sceneId);
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
          Back
        </Button>
        <h1 className="font-serif text-2xl font-bold text-foreground text-center">
          My Scenes
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''} uploaded
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* Upload New Button */}
          <Button
            variant="stage"
            size="lg"
            className="w-full"
            onClick={() => navigate('/upload')}
          >
            <Plus className="w-5 h-5 mr-2" />
            Upload New Scene
          </Button>

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
                  Upload a PDF to get started
                </p>
              </CardContent>
            </Card>
          )}

          {/* Scene List */}
          {scenes.map((scene) => (
            <Card key={scene.id} className="overflow-hidden">
              <CardHeader className="py-4 px-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold text-foreground truncate">
                        {scene.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {scene.source_pdf || 'Manual entry'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/role-picker/${scene.id}`)}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Practice
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/parse-review/${scene.id}`)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Scene?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{scene.title}" and all its parsed data.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDelete(scene.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
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
