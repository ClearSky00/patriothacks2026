import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard-view";
import type { Book } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardView
      books={(books as Book[]) || []}
      userId={user.id}
    />
  );
}
