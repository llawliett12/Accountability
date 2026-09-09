import { redirect } from "next/navigation";

export default async function PlanPage(props: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const searchParams = await props.searchParams;
  redirect(searchParams?.date ? `/?date=${searchParams.date}` : "/");
}
