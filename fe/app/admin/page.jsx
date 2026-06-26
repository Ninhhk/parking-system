"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin home — redirects to Insight dashboard.
 * All navigation is handled by the sidebar; a separate landing page
 * with quick-action cards duplicated sidebar links and provided no
 * additional value.
 */
export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/insight");
    }, [router]);

    return null;
}
