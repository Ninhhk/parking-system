import { redirect } from "next/navigation";

// The checkout terminal is now a single screen at /employee/checkout that resolves
// the session in place from a card tap. Old per-session deep links redirect there.
export default function CheckoutSessionRedirect() {
    redirect("/employee/checkout");
}
