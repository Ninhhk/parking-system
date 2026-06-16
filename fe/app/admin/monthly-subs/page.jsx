"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Monthly subscriptions are now managed via the Card Pool page.
 * Redirect any old bookmarks/links.
 */
export default function MonthlySubsRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/parking-cards");
    }, [router]);

    return null;
}
