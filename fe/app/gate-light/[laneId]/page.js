"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function GateLightPage() {
    const { laneId } = useParams();
    const [state, setState] = useState({ status: "CLOSED", plate: "", message: "" });
    const [connectionError, setConnectionError] = useState(false);

    useEffect(() => {
        const fetchState = async () => {
            try {
                const res = await fetch(`/api/gate-state/${laneId}`);
                if (res.ok) {
                    const data = await res.json();
                    setState(data);
                    setConnectionError(false);
                }
            } catch {
                setConnectionError(true);
            }
        };
        fetchState();
        const interval = setInterval(fetchState, 1500);
        return () => clearInterval(interval);
    }, [laneId]);

    const isOpen = state.status === "OPEN";

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a2e",
            color: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "2rem",
            position: "relative",
        }}>
            {connectionError && (
                <div style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    backgroundColor: "#ff6b6b",
                    color: "#fff",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                }}>
                    ⚠ Mất kết nối
                </div>
            )}

            <div style={{
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                backgroundColor: isOpen ? "#00e676" : "#ff1744",
                boxShadow: isOpen
                    ? "0 0 60px rgba(0, 230, 118, 0.6)"
                    : "0 0 60px rgba(255, 23, 68, 0.6)",
                marginBottom: "2rem",
                transition: "background-color 0.3s, box-shadow 0.3s",
            }} />

            <div style={{
                fontSize: "4rem",
                fontWeight: "bold",
                letterSpacing: "0.1em",
                marginBottom: "1rem",
                minHeight: "5rem",
            }}>
                {isOpen ? state.plate : ""}
            </div>

            <div style={{
                fontSize: "2.5rem",
                opacity: 0.9,
            }}>
                {isOpen ? state.message : "Sẵn sàng"}
            </div>
        </div>
    );
}
