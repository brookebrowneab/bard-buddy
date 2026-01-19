import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  FileText, 
  Edit3, 
  Languages, 
  LogOut, 
  Loader2,
  Scissors,
  CheckCircle,
  ArrowLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminLink {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/admin/login');
        return;
      }

      // Check if admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        toast.error("Admin access required");
        navigate('/admin/login');
        return;
      }

      setUserEmail(session.user.email || null);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate('/admin/login');
  };

  const adminLinks: AdminLink[] = [
    {
      title: "Upload Script",
      description: "Upload a new PDF script and parse it into scenes and line blocks",
      href: "/upload",
      icon: <Upload className="w-8 h-8" />,
    },
    {
      title: "Upload Translations",
      description: "Generate AI translations or import translations from CSV",
      href: "/admin/translations",
      icon: <Languages className="w-8 h-8" />,
    },
    {
      title: "Script Editing",
      description: "Split, merge, and correct raw text in line blocks",
      href: "/admin/script-fix",
      icon: <Scissors className="w-8 h-8" />,
    },
    {
      title: "Edit Translations",
      description: "Side-by-side editor for manual translation corrections",
      href: "/admin/translation-editor",
      icon: <Edit3 className="w-8 h-8" />,
    },
    {
      title: "Review Translations",
      description: "Bulk approve or flag translations for review",
      href: "/admin/translations-review",
      icon: <CheckCircle className="w-8 h-8" />,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              {userEmail && (
                <p className="text-muted-foreground text-sm">Logged in as {userEmail}</p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Admin Links Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {adminLinks.map((link) => (
            <Link key={link.href} to={link.href} className="block">
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    {link.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Stats (optional future enhancement) */}
        <div className="mt-8 pt-8 border-t">
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/scenes">
                <FileText className="w-4 h-4 mr-2" />
                View All Scenes
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/">
                Practice Mode
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
