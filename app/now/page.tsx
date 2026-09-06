import CheckInForm from "@/components/CheckInForm";
import FocusTimer from "@/components/FocusTimer";
import MoodQuickLog from "@/components/MoodQuickLog";

export default function NowPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Right now</h1>
      <CheckInForm />
      <FocusTimer />
      <MoodQuickLog />
    </div>
  );
}
