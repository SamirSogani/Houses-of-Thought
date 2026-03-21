import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Calendar, MessageSquare, Home, Clock, Eye, BarChart3, Users, Globe } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const toPST = (dateStr: string) => {
  return new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
};
const formatPST = (dateStr: string, fmt: string) => {
  // Convert to PST string then re-parse for date-fns format
  const pstDate = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return format(pstDate, fmt);
};
const formatDistancePST = (dateStr: string) => {
  const pstDate = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return formatDistanceToNow(pstDate, { addSuffix: true });
};
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

interface SiteStats {
  unique_visitors: number;
  total_visits: number;
  total_signups: number;
  daily: { date: string; visits: number; unique_visitors: number }[];
}

interface ActivityStats {
  daily: { date: string; analyses: number; chats: number }[];
}

type View = "list" | "user" | "analysis" | "chat" | "charts";
type TimeRange = 7 | 30 | 90;

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisDetail | null>(null);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [view, setView] = useState<View>("list");
  const [subLoading, setSubLoading] = useState(false);

  // Chart state
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [siteStats, setSiteStats] = useState<SiteStats | null>(null);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [userActivityStats, setUserActivityStats] = useState<ActivityStats | null>(null);

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

  const loadChartData = async (days: TimeRange, userId?: string) => {
    setChartLoading(true);
    const [siteRes, actRes] = await Promise.all([
      userId ? null : supabase.functions.invoke(`admin-users?action=site-stats&days=${days}`, { body: null, method: "GET" }),
      supabase.functions.invoke(`admin-users?action=activity-stats&days=${days}${userId ? `&userId=${userId}` : ""}`, { body: null, method: "GET" }),
    ]);
    if (!userId && siteRes?.data && !siteRes.data.error) setSiteStats(siteRes.data);
    if (actRes?.data && !actRes.data.error) {
      if (userId) setUserActivityStats(actRes.data);
      else setActivityStats(actRes.data);
    }
    setChartLoading(false);
  };

  const openCharts = () => {
    setView("charts");
    loadChartData(timeRange);
  };

  const changeTimeRange = (r: TimeRange) => {
    setTimeRange(r);
    if (view === "charts") loadChartData(r);
    else if (view === "user" && selectedUser) loadChartData(r, selectedUser.user.id);
  };

  const goBack = () => {
    if (view === "chat" || view === "analysis") {
      setView("user");
      setSelectedAnalysis(null);
      setSelectedChat(null);
    } else if (view === "user") {
      setView("list");
      setSelectedUser(null);
      setUserActivityStats(null);
    } else if (view === "charts") {
      setView("list");
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

  // Charts view
  if (view === "charts") {
    return (
      <div className="space-y-4">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to users
        </button>
        <h3 className="text-sm font-display font-semibold text-foreground">Site Analytics</h3>

        <TimeRangeSelector value={timeRange} onChange={changeTimeRange} />

        {chartLoading && <div className="text-xs text-muted-foreground animate-pulse">Loading stats...</div>}

        {siteStats && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Globe className="h-3.5 w-3.5" />} label="Unique Visitors" value={siteStats.unique_visitors} />
            <StatCard icon={<Eye className="h-3.5 w-3.5" />} label="Total Visits" value={siteStats.total_visits} />
            <StatCard icon={<Users className="h-3.5 w-3.5" />} label="Signups" value={siteStats.total_signups} />
          </div>
        )}

        {siteStats && siteStats.daily.length > 0 && (
          <Section title="Visits Over Time">
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={siteStats.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Visits" />
                  <Line type="monotone" dataKey="unique_visitors" stroke="hsl(var(--chart-2, 160 60% 45%))" strokeWidth={2} dot={false} name="Unique" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        {activityStats && activityStats.daily.length > 0 && (
          <Section title="User Activity">
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityStats.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="analyses" fill="hsl(var(--primary))" name="Houses" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="chats" fill="hsl(var(--chart-2, 160 60% 45%))" name="Chats" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}
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
    const assumptions = selectedAnalysis.assumptions || [];

    const groupedSqs: Record<string, any[]> = {};
    sqs.forEach((sq: any) => {
      const cat = sq.pov_category || "uncategorized";
      if (!groupedSqs[cat]) groupedSqs[cat] = [];
      groupedSqs[cat].push(sq);
    });

    const povOrder = ["individual", "group", "ideas_disciplines"];
    const povLabels: Record<string, string> = { individual: "Individual", group: "Group", ideas_disciplines: "Ideas / Disciplines", uncategorized: "Other" };

    return (
      <div className="space-y-4">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to user
        </button>
        <h3 className="text-sm font-display font-semibold text-foreground">{a?.title || "Untitled"}</h3>

        {/* Atmosphere — Concepts */}
        {concepts.length > 0 && (
          <HouseZone label="Atmosphere" color="bg-sky-500/10 border-sky-500/30">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Concepts ({concepts.length})</div>
            <div className="flex flex-wrap gap-1">
              {concepts.map((c: any) => (
                <div key={c.id} className="rounded border border-border bg-card px-2 py-1">
                  <span className="text-xs font-medium text-foreground">{c.term}</span>
                  {c.definition && <span className="text-[10px] text-muted-foreground ml-1">— {c.definition}</span>}
                </div>
              ))}
            </div>
          </HouseZone>
        )}

        {/* Roof — Purpose, Sub-purposes, Consequences */}
        <HouseZone label="Roof" color="bg-amber-500/10 border-amber-500/30">
          {a?.purpose && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Purpose</div>
              <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a.purpose}</p>
            </div>
          )}
          {a?.sub_purposes && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Sub-Purposes</div>
              <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a.sub_purposes}</p>
            </div>
          )}
          {a?.consequences && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Consequences & Implications</div>
              <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a.consequences}</p>
            </div>
          )}
        </HouseZone>

        {/* Ceiling — Overarching Question + Conclusion */}
        <HouseZone label="Ceiling" color="bg-violet-500/10 border-violet-500/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Overarching Question</div>
              <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a?.overarching_question || <span className="italic text-muted-foreground">Not set</span>}</p>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Overarching Conclusion</div>
              <p className="text-xs text-foreground whitespace-pre-wrap break-words">{a?.overarching_conclusion || <span className="italic text-muted-foreground">Not set</span>}</p>
            </div>
          </div>
        </HouseZone>

        {/* Columns — Sub-Questions grouped by POV */}
        <HouseZone label="Columns" color="bg-emerald-500/10 border-emerald-500/30">
          {sqs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No sub-questions</p>
          ) : (
            [...povOrder, ...Object.keys(groupedSqs).filter(k => !povOrder.includes(k))].filter(k => groupedSqs[k]?.length > 0).map((cat) => (
              <div key={cat} className="mb-3 last:mb-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{povLabels[cat] || cat} ({groupedSqs[cat].length})</div>
                {groupedSqs[cat].map((sq: any) => {
                  const sqAssumptions = assumptions.filter((as: any) => as.sub_question_id === sq.id);
                  return (
                    <div key={sq.id} className="border border-border rounded-md bg-card p-2 mb-1.5 space-y-1">
                      <div className="text-xs font-medium text-foreground">{sq.question || "No question"}</div>
                      {sq.information && (
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">Information:</span> {sq.information}
                        </div>
                      )}
                      {sq.sub_conclusion && (
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">Sub-Conclusion:</span> {sq.sub_conclusion}
                        </div>
                      )}
                      {sqAssumptions.length > 0 && (
                        <div className="pl-2 border-l-2 border-muted mt-1 space-y-0.5">
                          <div className="text-[10px] font-semibold text-muted-foreground">Assumptions ({sqAssumptions.length})</div>
                          {sqAssumptions.map((as: any) => (
                            <div key={as.id} className="text-[10px] text-muted-foreground">
                              <span className="capitalize font-medium">{as.assumption_type}:</span> {as.content}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </HouseZone>
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
            Joined {formatPST(u.created_at, "MMM d, yyyy")} PST
          </div>
          {u.last_sign_in_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last active {formatDistancePST(u.last_sign_in_at)}
            </div>
          )}
        </div>

        {/* User activity chart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Activity
            </h4>
            <TimeRangeSelector value={timeRange} onChange={(r) => { setTimeRange(r); loadChartData(r, u.id); }} />
          </div>
          {!userActivityStats ? (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => loadChartData(timeRange, u.id)}>
              <BarChart3 className="h-3 w-3 mr-1" /> Load Activity Chart
            </Button>
          ) : (
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userActivityStats.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar dataKey="analyses" fill="hsl(var(--primary))" name="Houses" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="chats" fill="hsl(var(--chart-2, 160 60% 45%))" name="Chats" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {subLoading && <div className="text-xs text-muted-foreground animate-pulse">Loading...</div>}

        <Section title={`Houses (${selectedUser.analyses.length})`} icon={<Home className="h-3 w-3" />}>
          {selectedUser.analyses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No houses created</p>
          ) : (
            selectedUser.analyses.map((a: any) => (
              <button key={a.id} onClick={() => loadAnalysisDetail(a.id)}
                className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/50 transition-colors mb-1 flex items-center justify-between">
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

        <Section title={`AI Discussions (${selectedUser.chats.length})`} icon={<MessageSquare className="h-3 w-3" />}>
          {selectedUser.chats.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No AI discussions</p>
          ) : (
            selectedUser.chats.map((c) => (
              <button key={c.id} onClick={() => openChat(c)}
                className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/50 transition-colors mb-1 flex items-center justify-between">
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

function HouseZone({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${color}`}>
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

  // User list view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-semibold text-foreground">Admin: Users ({users.length})</h3>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={openCharts}>
          <BarChart3 className="h-3 w-3 mr-1" /> Charts
        </Button>
      </div>
      {subLoading && <div className="text-xs text-muted-foreground animate-pulse">Loading details...</div>}
      <div className="space-y-1">
        {users.map((u) => (
          <button key={u.id} onClick={() => loadUserDetail(u.id)}
            className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/50 transition-colors">
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-2 text-center">
      <div className="flex items-center justify-center text-muted-foreground mb-1">{icon}</div>
      <div className="text-lg font-bold tabular-nums text-foreground">{value.toLocaleString()}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  return (
    <div className="flex gap-1">
      {([7, 30, 90] as TimeRange[]).map((r) => (
        <button key={r} onClick={() => onChange(r)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            value === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
          }`}>
          {r}d
        </button>
      ))}
    </div>
  );
}
