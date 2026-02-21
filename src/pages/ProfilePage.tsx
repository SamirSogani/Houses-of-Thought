import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [biological, setBiological] = useState("");
  const [social, setSocial] = useState("");
  const [familial, setFamilial] = useState("");
  const [individual, setIndividual] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data) {
      setBiological(data.biological);
      setSocial(data.social);
      setFamilial(data.familial);
      setIndividual(data.individual);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ biological, social, familial, individual, updated_at: new Date().toISOString() })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="page-container">
        <div className="breadcrumb-nav">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <span>/</span>
          <span className="text-foreground">Profile</span>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">Personal Foundational Point of View</h1>
        <p className="text-muted-foreground mb-8">Element 4.2 — These perspectives persist across all your analyses.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: "Biological", value: biological, set: setBiological, desc: "Your biological influences, instincts, and physical perspective" },
            { label: "Social", value: social, set: setSocial, desc: "Your social context, cultural background, and community influences" },
            { label: "Familial", value: familial, set: setFamilial, desc: "Your family upbringing, traditions, and familial values" },
            { label: "Individual", value: individual, set: setIndividual, desc: "Your unique personal experiences, beliefs, and individual identity" },
          ].map((item) => (
            <Card key={item.label} className="house-zone house-zone-foundation">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-display">{item.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={item.value}
                  onChange={(e) => item.set(e.target.value)}
                  placeholder={`Describe your ${item.label.toLowerCase()} perspective...`}
                  className="min-h-[120px] bg-card"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={saveProfile} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
