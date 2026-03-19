import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Calendar, MessageSquare, Home, Clock, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface UserSummary {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  analysis_count: number;
  chat_count: number;
}

interface UserDetail {
  user: { id: string; email: string; created_at: string; last_sign_in_at: string | null };
  analyses: { id: string; title: string; created_at: string; updated_at: string; is_public: boolean }[];
  chats: { id: string; chat_title: string; created_at: string; updated_at: string; message_count: number; messages: any[]; analysis_id: string }[];
}

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedChat, setExpandedChat] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("admin-users", {
      body: null,
      method: "GET",
    });
    if (fnError) {
      setError("Failed to load users");
      setLoading(false);
      return;
    }
    // Handle the response - functions.invoke returns data directly
    if (data?.error) {
      setError(data.error);
    } else {
      setUsers(data?.users || []);
    }
    setLoading(false);
  };

  const loadUserDetail = async (userId: string) => {
    setLoadingDetail(true);
    const { data, error: fnError } = await supabase.functions.invoke(
      `admin-users?action=user-detail&userId=${userId}`,
      { body: null, method: "GET" }
    );
    if (!fnError && data && !data.error) {
      setSelectedUser(data);
    }
    setLoadingDetail(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-display font-semibold text-foreground">Admin: Users</h3>
        <div className="animate-pulse text-xs text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-display font-semibold text-foreground">Admin: Users</h3>
        <div className="text-xs text-destructive">{error}</div>
        <Button variant="outline" size="sm" onClick={loadUsers}>Retry</Button>
      </div>
    );
  }

  // User detail view
  if (selectedUser) {
    const u = selectedUser.user;
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedUser(null); setExpandedChat(null); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to users
        </button>

        <div className="space-y-1">
          <h3 className="text-sm font-display font-semibold text-foreground truncate">{u.email}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Joined {format(new Date(u.created_at), "MMM d, yyyy")}
          </div>
          {u.last_sign_in_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last active {formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true })}
            </div>
          )}
        </div>

        {/* Analyses / Houses */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Home className="h-3 w-3" /> Houses ({selectedUser.analyses.length})
          </h4>
          {selectedUser.analyses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No houses created</p>
          ) : (
            <div className="space-y-1">
              {selectedUser.analyses.map((a) => (
                <div key={a.id} className="rounded-md border border-border bg-card p-2">
                  <div className="text-xs font-medium text-foreground truncate">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}
                    {a.is_public && <span className="ml-1 text-primary">• Public</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Chats */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> AI Discussions ({selectedUser.chats.length})
          </h4>
          {selectedUser.chats.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No AI discussions</p>
          ) : (
            <div className="space-y-1">
              {selectedUser.chats.map((c) => (
                <div key={c.id} className="rounded-md border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedChat(expandedChat === c.id ? null : c.id)}
                    className="w-full text-left p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-foreground truncate flex-1">{c.chat_title}</div>
                      <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${expandedChat === c.id ? "rotate-90" : ""}`} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {c.message_count} messages • {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                    </div>
                  </button>
                  {expandedChat === c.id && c.messages.length > 0 && (
                    <div className="border-t border-border p-2 space-y-1.5 max-h-60 overflow-y-auto bg-muted/30">
                      {c.messages.map((msg: any, i: number) => (
                        <div key={i} className={`text-[11px] p-1.5 rounded ${msg.role === "user" ? "bg-primary/10 text-foreground" : "bg-card text-muted-foreground"}`}>
                          <span className="font-semibold text-[10px] uppercase">{msg.role}: </span>
                          <span className="whitespace-pre-wrap break-words">
                            {typeof msg.content === "string" ? msg.content.substring(0, 300) : JSON.stringify(msg.content).substring(0, 300)}
                            {(typeof msg.content === "string" ? msg.content.length : JSON.stringify(msg.content).length) > 300 && "…"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // User list view
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-display font-semibold text-foreground">Admin: Users ({users.length})</h3>
      {loadingDetail && <div className="text-xs text-muted-foreground animate-pulse">Loading details...</div>}
      <div className="space-y-1">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => loadUserDetail(u.id)}
            className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">{u.email}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2">
              <span>{u.analysis_count} houses</span>
              <span>{u.chat_count} chats</span>
              {u.last_sign_in_at && (
                <span>Active {formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true })}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
