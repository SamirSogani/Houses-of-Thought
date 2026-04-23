import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useComments, markCommentsRead, type CommentTargetType, type CommentRow } from "@/hooks/useComments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash2, Check, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  assignmentId: string;
  targetType: CommentTargetType;
  submissionId?: string | null;
  analysisId?: string | null;
  targetKind?: string | null;
  targetId?: string | null;
  /** When false the composer is hidden (e.g. one-way for the student, or assignment-wide for students). */
  canPost: boolean;
  /** When true, students may resolve/unresolve their own-submission comments. */
  studentCanResolve?: boolean;
  /** Optional banner message displayed when the composer is hidden. */
  readOnlyMessage?: string;
  /** Optional teacher id — used to color teacher comments distinctly. */
  teacherId?: string | null;
  emptyMessage?: string;
  /** Mark visible comments as read when true. Default true. */
  autoMarkRead?: boolean;
  /** Pre-fills the composer (used by highlight-to-comment). */
  initialDraft?: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

export default function CommentThread(props: Props) {
  const {
    assignmentId,
    targetType,
    submissionId = null,
    analysisId = null,
    targetKind = null,
    targetId = null,
    canPost,
    studentCanResolve = false,
    readOnlyMessage,
    teacherId,
    emptyMessage = "No comments yet.",
    autoMarkRead = true,
    initialDraft,
  } = props;
  const { user } = useAuth();
  const { comments, loading, post, edit, remove, resolve, unresolve } = useComments({
    assignmentId,
    targetType,
    submissionId,
    analysisId,
    targetKind,
    targetId,
  });
  const [draft, setDraft] = useState(initialDraft || "");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const markedRef = useRef<Set<string>>(new Set());

  // If a fresh initialDraft arrives (sheet reopened with selection), pre-fill.
  useEffect(() => {
    if (initialDraft) setDraft(initialDraft);
  }, [initialDraft]);


  // Auto-mark visible others' comments as read
  useEffect(() => {
    if (!autoMarkRead || !user) return;
    const ids = comments
      .filter((c) => c.author_id !== user.id && !markedRef.current.has(c.id))
      .map((c) => c.id);
    if (!ids.length) return;
    ids.forEach((id) => markedRef.current.add(id));
    markCommentsRead(ids);
  }, [comments, user, autoMarkRead]);

  const handlePost = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    const { error } = await post(body);
    setPosting(false);
    if (error) {
      toast.error("Could not post comment");
      return;
    }
    setDraft("");
  };

  const startEdit = (c: CommentRow) => {
    setEditingId(c.id);
    setEditDraft(c.body);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const body = editDraft.trim();
    if (!body) return;
    const { error } = await edit(editingId, body);
    if (error) {
      toast.error("Could not save edit");
      return;
    }
    setEditingId(null);
    setEditDraft("");
  };

  const handleDelete = async (id: string) => {
    const { data, error } = await remove(id);
    if (error || (data && (data as any).ok === false)) {
      toast.error("Could not delete comment");
      return;
    }
    toast.success("Comment deleted");
  };

  const handleResolveToggle = async (c: CommentRow) => {
    if (c.resolved_at) {
      const { error } = await unresolve(c.id);
      if (error) toast.error("Could not unresolve");
    } else {
      const { error } = await resolve(c.id);
      if (error) toast.error("Could not resolve");
    }
  };

  const sorted = useMemo(
    () => [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comments],
  );

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading comments…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((c) => {
            const mine = user?.id === c.author_id;
            const isTeacherAuthor = c.author_role === "teacher";
            const resolved = !!c.resolved_at;
            return (
              <li
                key={c.id}
                className={`rounded-md border p-3 ${
                  resolved
                    ? "border-border/50 bg-muted/20 opacity-70"
                    : isTeacherAuthor
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={isTeacherAuthor ? "default" : "secondary"} className="capitalize">
                      {c.author_role}
                    </Badge>
                    <span className="text-muted-foreground">{formatTime(c.created_at)}</span>
                    {c.edited_at && <span className="text-muted-foreground italic">(edited)</span>}
                    {resolved && (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600/40">
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {studentCanResolve && c.target_type !== "assignment" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleResolveToggle(c)}
                      >
                        {resolved ? (
                          <>
                            <RotateCcw className="h-3 w-3 mr-1" /> Unresolve
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" /> Resolve
                          </>
                        )}
                      </Button>
                    )}
                    {mine && editingId !== c.id && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(c)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {mine && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => handleDelete(c.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {editingId === c.id ? (
                  <div className="space-y-2">
                    <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={saveEdit}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canPost ? (
        <div className="space-y-2 pt-1">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handlePost} disabled={posting || !draft.trim()}>
              <Send className="h-3.5 w-3.5 mr-1" />
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      ) : (
        readOnlyMessage && (
          <p className="text-xs text-muted-foreground italic border-t pt-2">{readOnlyMessage}</p>
        )
      )}
    </div>
  );
}
