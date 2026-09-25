import { redirect } from "next/navigation";

// Kept so old bookmarks and installed-PWA shortcuts keep working.
export default function NowPage() {
  redirect("/focus");
}
