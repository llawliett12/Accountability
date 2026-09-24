import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchClassById } from "@/lib/academics/queries";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cls = await fetchClassById(user.id, id);
  if (!cls) notFound();

  if (cls.course_id) {
    redirect(`/academics/courses/${cls.course_id}`);
  }

  redirect("/academics");
}
