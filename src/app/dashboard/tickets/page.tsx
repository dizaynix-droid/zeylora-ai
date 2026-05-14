import { redirect } from "next/navigation";

export default function DashboardTicketsRedirect() {
  redirect("/dashboard/support");
}
