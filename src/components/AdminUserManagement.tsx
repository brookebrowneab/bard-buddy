import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Loader2,
  Shield,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface AdminUser {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  created_at: string;
  email?: string;
}

const AdminUserManagement = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmins();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error("Failed to load admin users");
    } finally {
      setLoading(false);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setAdding(true);
    try {
      // Look up user by email using auth admin API via edge function
      const { data, error } = await supabase.functions.invoke('admin-manage-users', {
        body: { 
          action: 'add_admin',
          email: newAdminEmail.trim().toLowerCase()
        }
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Admin role granted to ${newAdminEmail}`);
      setNewAdminEmail("");
      fetchAdmins();
    } catch (error: any) {
      console.error('Error adding admin:', error);
      toast.error(error.message || "Failed to add admin");
    } finally {
      setAdding(false);
    }
  };

  const removeAdmin = async (roleId: string, userId: string) => {
    if (userId === currentUserId) {
      toast.error("You cannot remove your own admin access");
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast.success("Admin access removed");
      fetchAdmins();
    } catch (error) {
      console.error('Error removing admin:', error);
      toast.error("Failed to remove admin");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Admin Users</CardTitle>
            <CardDescription>Manage who has admin access</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new admin */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter user email..."
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAdmin()}
            className="flex-1"
          />
          <Button onClick={addAdmin} disabled={adding}>
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Add
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          User must have an existing account to be granted admin access
        </p>

        {/* Admin list */}
        <div className="space-y-2 pt-2">
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No admin users found
            </p>
          ) : (
            admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {admin.user_id === currentUserId ? 'You' : `User ID: ${admin.user_id.slice(0, 8)}...`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(admin.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Admin</Badge>
                  {admin.user_id !== currentUserId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Admin Access?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will revoke admin privileges for this user. They will no longer be able to access admin features.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeAdmin(admin.id, admin.user_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove Access
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUserManagement;
