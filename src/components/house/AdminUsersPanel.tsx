import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Calendar, MessageSquare, Home, Clock, ChevronRight, Eye } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface UserSummary {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  analysis_count: number;
  chat_count: number;
}

interface AnalysisDetail {
  analysis: any;
  sub_questions: any[];
  concepts: any[];
  assumptions: any[];
}

interface UserDetail {
  user: { id: string; email: string; created_at: string; last_sign_in_at: string | null };
  analyses: any[];
  chats: { id: string; chat_title: string; created_at: string; updated_at: string; message_count: number; messages: any[]; analysis_id: string }[];
}

type View = "list" | "user" | "analysis" | "chat";

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisDetail | null>(null);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [view, setView] = useState<View>("list");
  const [subLoading, setSubLoading] = useState(false);

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
    if (fnError) { setError("Failed to load users. Please log out and log back in."); setLoading(false); return; }
    if (data?.error) { setError(data.error === "Forbidden" ? "Access denied. Please log out and log back in." : data.error); } else { setUsers(data?.users || []); }
    setLoading(false);
  };

  const loadUserDetail = async (userId: string) => {
    setSubLoading(true);
    const { data } = await supabase.functions.invoke(
      `admin-users?action=user-detail&userId=${userId}`,
      { body: null, method: "GET" }
    );
    if (data && !data.error) {
      setSelectedUser(data);
      setView("user");
    }
    setSubLoading(false);
  };

  const loadAnalysisDetail = async (analysisId: string) => {
    setSubLoading(true);
    const { data } = await supabase.functions.invoke(
      `admin-users?action=analysis-detail&analysisId=${analysisId}`,
      { body: null, method: "GET" }
    );
    if (data && !data.error) {
      setSelectedAnalysis(data);
      setView("analysis");
    }
    setSubLoading(false);
  };

  const openChat = (chat: any) => {
    setSelectedChat(chat);
    setView("chat");
  };

  const goBack = () => {
    if (view === "chat" || view === "analysis") {
      setView("user");
      setSelectedAnalysis(null);
      setSelectedChat(null);
    } else if (view === "user") {
      setView("list");
      setSelectedUser(null);
    }
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

  // Full chat view
  if (view === "chat" && selectedChat) {
    const messages = Array.isArray(selectedChat.messages) ? selectedChat.messages : [];
    return (
      <div className="space-y-3">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to user
        </button>
        <h3 className="text-sm font-display font-semibold text-foreground">{selectedChat.chat_title}</h3>
        <div className="text-[10px] text-muted-foreground">{messages.length} messages</div>

        <div className="space-y-2">
          {messages.map((msg: any, i: number) => (
            <div key={i} className={`text-xs p-2 rounded-md border border-border ${msg.role === "user" ? "bg-primary/10" : "bg-card"}`}>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">{msg.role}</div>
              <div className="whitespace-pre-wrap break-words text-foreground">
                {typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content, null, 2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full analysis view
  if (view === "analysis" && selectedAnalysis) {
    const a = selectedAnalysis.analysis;
    const sqs = selectedAnalysis.sub_questions;
    const concepts = selectedAnalysis.concepts;
    return (
      <div className="space-y-4">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to user
        </button>
        <h3 className="text-sm font-display font-semibold text-foreground">{a?.title || "Untitled"}</h3>

        {a?.purpose && (
          <Section title="Purpose">
            <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a.purpose}</p>
          </Section>
        )}
        {a?.overarching_question && (
          <Section title="Overarching Question">
            <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a.overarching_question}</p>
          </Section>
        )}
        {a?.overarching_conclusion && (
          <Section title="Overarching Conclusion">
            <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a.overarching_conclusion}</p>
          </Section>
        )}
        {a?.consequences && (
          <Section title="Consequences">
            <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a.consequences}</p>
          </Section>
        )}

        {concepts.length > 0 && (
          <Section title={`Concepts (${concepts.length})`}>
            {concepts.map((c: any) => (
              <div key={c.id} className="border border-border rounded p-1.5 mb-1">
                <div className="text-xs font-medium text-foreground">{c.term}</div>
                <div className="text-[11px] text-muted-foreground">{c.definition}</div>
              </div>
            ))}
          </Section>
        )}

        {sqs.length > 0 && (
          <Section title={`Sub-Questions (${sqs.length})`}>
            {sqs.map((sq: any) => (
              <div key={sq.id} className="border border-border rounded p-2 mb-1.5 space-y-1">
                <div className="text-xs font-medium text-foreground">{sq.question || "No question"}</div>
                {sq.information && (
                  <div className="text-[11px] text-muted-foreground"><span className="font-semibold">Info:</span> {sq.information}</div>
                )}
                {sq.sub_conclusion && (
                  <div className="text-[11px] text-muted-foreground"><span className="font-semibold">Conclusion:</span> {sq.sub_conclusion}</div>
                )}
                <div className="text-[10px] text-muted-foreground">POV: {sq.pov_category}</div>
              </div>
            ))}
          </Section>
        )}
      </div>
    );
  }

  // User detail view
  if (view === "user" && selectedUser) {
    const u = selectedUser.user;
    return (
      <div className="space-y-4">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
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

        {subLoading && <div className="text-xs text-muted-foreground animate-pulse">Loading...</div>}

        {/* Houses */}
        <Section title={`Houses (${selectedUser.analyses.length})`} icon={<Home className="h-3 w-3" />}>
          {selectedUser.analyses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No houses created</p>
          ) : (
            selectedUser.analyses.map((a: any) => (
              <button
                key={a.id}
                onClick={() => loadAnalysisDetail(a.id)}
                className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/50 transition-colors mb-1 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}
                    {a.is_public && <span className="ml-1 text-primary">• Public</span>}
                  </div>
                </div>
                <Eye className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
              </button>
            ))
          )}
        </Section>

        {/* AI Chats */}
        <Section title={`AI Discussions (${selectedUser.chats.length})`} icon={<MessageSquare className="h-3 w-3" />}>
          {selectedUser.chats.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No AI discussions</p>
          ) : (
            selectedUser.chats.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c)}
                className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/50 transition-colors mb-1 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{c.chat_title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.message_count} messages • {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                  </div>
                </div>
                <Eye className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
              </button>
            ))
          )}
        </Section>
      </div>
    );
  }

  // User list view
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-display font-semibold text-foreground">Admin: Users ({users.length})</h3>
      {subLoading && <div className="text-xs text-muted-foreground animate-pulse">Loading details...</div>}
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

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}
