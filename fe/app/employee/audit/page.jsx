"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Session Audit has moved to the admin section.
 * Redirect any old bookmarks/links.
 */
export default function AuditRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/audit");
    }, [router]);

    return null;
}
