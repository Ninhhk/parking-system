import { redirect } from "next/navigation";

export default function RfidCatchAllRedirect() {
    redirect("/employee/checkin");
}
