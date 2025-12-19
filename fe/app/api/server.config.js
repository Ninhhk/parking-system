import { cookies } from "next/headers";

export async function serverApiFetch(path, options = {}) {
    const cookieStore = await cookies();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    const headers = {
        ...(options.headers || {}),
        "Content-Type": "application/json",
        cookie: await cookieStore.toString(),
    };
    const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        cache: "no-store",
    });
    return res;
}
