"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Edge Ops has moved to the admin section.
 * Redirect any old bookmarks/links.
 */
export default function EdgeMonitorRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/edge-ops");
    }, [router]);

    return null;
}
