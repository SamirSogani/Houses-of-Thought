import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function CreateClassroomDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string, cap: number | null) => Promise<{ error: any }>;
}) {
  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a classroom name");
      return;
    }
    const capNum = cap.trim() === "" ? null : Math.max(1, parseInt(cap, 10));
    if (cap.trim() !== "" && (isNaN(capNum as any) || (capNum as number) < 1)) {
      toast.error("Cap must be a positive number");
      return;
    }
    setBusy(true);
    const { error } = await onCreate(name.trim(), capNum);
    setBusy(false);
    if (error) {
      toast.error(error.message || "Could not create classroom");
      return;
    }
    toast.success("Classroom created");
    setName("");
    setCap("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Classroom</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cls-name">Classroom Name</Label>
            <Input
              id="cls-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Period 3 — Critical Thinking"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cls-cap">Student Cap (optional)</Label>
            <Input
              id="cls-cap"
              type="number"
              min={1}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="Leave blank for unlimited"
            />
            <p className="text-xs text-muted-foreground">Maximum number of students that can join. Leave blank for no limit.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
