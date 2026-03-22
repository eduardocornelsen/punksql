"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

export function useProgress(localData, onServerUpdate) {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const lastUpdateRef = useRef(0);

  // Fetch server progress on login
  useEffect(() => {
    if (user) {
      fetch("/api/progress")
        .then(res => res.json())
        .then(data => {
          if (data.progress) {
            onServerUpdate(data.progress);
          }
        })
        .catch(console.error);
    }
  }, [user]);

  // Sync to server (debounced)
  const syncToServer = useCallback(async (data) => {
    if (!user) return;
    setSyncing(true);
    try {
      await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
    }
  }, [user]);

  // Trigger sync on local changes
  useEffect(() => {
    if (!user) return;
    
    // Debounce 2s
    const timer = setTimeout(() => {
      syncToServer(localData);
    }, 2000);

    return () => clearTimeout(timer);
  }, [localData, user, syncToServer]);

  // Track analytics
  const logAttempt = useCallback(async (attempt) => {
    if (!user) return;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt),
    }).catch(() => {}); // Fire and forget
  }, [user]);

  return { syncing, logAttempt };
}
