import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";
import ClassroomCodeBadge from "./ClassroomCodeBadge";
import type { ClassroomRow } from "@/hooks/useClassrooms";

export default function ClassroomCard({
  classroom,
  studentCount,
  onOpen,
}: {
  classroom: ClassroomRow;
  studentCount: number;
  onOpen: () => void;
}) {
  const cap = classroom.student_cap;
  return (
    <Card className="hover:shadow-lg transition-all duration-200 hover:border-primary/30 cursor-pointer group" onClick={onOpen}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display truncate">{classroom.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div onClick={(e) => e.stopPropagation()}>
          <ClassroomCodeBadge code={classroom.code} size="sm" />
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>
              {studentCount}{cap ? ` / ${cap}` : ""} student{studentCount === 1 ? "" : "s"}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
