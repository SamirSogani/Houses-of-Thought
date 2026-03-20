import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function getVisitorId(): string {
  const key = "hot_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function useVisitorTracking() {
  useEffect(() => {
    const visitorId = getVisitorId();
    const path = window.location.pathname;

    // Fire-and-forget insert via anon key (RLS allows public inserts)
    supabase.from("site_visits").insert({ visitor_id: visitorId, path }).then(() => {});
  }, []);
}
