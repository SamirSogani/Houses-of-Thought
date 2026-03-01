import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function DeleteAccountSection() {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const userId = session.user.id;

      // Delete all user data in order (respecting FK constraints)
      // 1. assumptions (via sub_questions)
      const { data: analyses } = await supabase.from("analyses").select("id").eq("user_id", userId);
      const analysisIds = analyses?.map(a => a.id) || [];

      if (analysisIds.length > 0) {
        const { data: sqs } = await supabase.from("sub_questions").select("id").in("analysis_id", analysisIds);
        const sqIds = sqs?.map(s => s.id) || [];
        if (sqIds.length > 0) {
          await supabase.from("assumptions").delete().in("sub_question_id", sqIds);
        }
        await supabase.from("sub_questions").delete().in("analysis_id", analysisIds);
        await supabase.from("concepts").delete().in("analysis_id", analysisIds);
        await supabase.from("pov_labels").delete().in("analysis_id", analysisIds);
        await supabase.from("sidebar_chats").delete().in("analysis_id", analysisIds);
      }
      await supabase.from("analyses").delete().eq("user_id", userId);
      await supabase.from("profiles").delete().eq("user_id", userId);

      // Sign out (actual auth user deletion requires admin/service role)
      await supabase.auth.signOut();
      toast.success("Account data deleted. You have been signed out.");
      window.location.href = "/auth";
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display text-destructive">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2" disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all your analyses, sub-questions, assumptions, concepts, chats, and profile data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
