"use client";

import React, { useState, useEffect } from "react";

interface UnsubscribesData {
  count: number;
}

interface UnsubscribesCardProps {
  startDate: Date;
  endDate: Date;
}

export default function UnsubscribesCard({ startDate, endDate }: UnsubscribesCardProps) {
  const [unsubscribesCount, setUnsubscribesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchUnsubscribes() {
      setLoading(true);
      try {
        const url = new URL("/api/statics/unsubscribes", window.location.origin);
        url.searchParams.set("startDate", startDate.toISOString());
        url.searchParams.set("endDate", endDate.toISOString());

        const res = await fetch(url);
        const json: UnsubscribesData = await res.json();
        if (isMounted) {
          setUnsubscribesCount(json.count);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (isMounted) {
          setUnsubscribesCount(0);
          setLoading(false);
        }
      }
    }

    fetchUnsubscribes();
    const intervalId = setInterval(fetchUnsubscribes, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [startDate, endDate]);

  return (
    <div className="bg-white shadow rounded p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Unsubscribes</h2>

      <div className="text-center text-5xl font-bold mb-4 text-red-600">
        {loading ? "..." : unsubscribesCount.toLocaleString()}
      </div>

      {lastUpdated && (
        <div className="text-center text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
