"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface InvalidClicksData {
  count: number;
}

interface InvalidClicksCardProps {
  startDate: Date;
  endDate: Date;
}

export default function InvalidClicksCard({ startDate, endDate }: InvalidClicksCardProps) {
  const [invalidClicksCount, setInvalidClicksCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchInvalidClicks() {
      setLoading(true);
      try {
        const url = new URL("/api/statics/invalid-clicks", window.location.origin);
        url.searchParams.set("startDate", startDate.toISOString());
        url.searchParams.set("endDate", endDate.toISOString());

        const res = await fetch(url);
        const json: InvalidClicksData = await res.json();
        if (isMounted) {
          setInvalidClicksCount(json.count);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (isMounted) {
          setInvalidClicksCount(0);
          setLoading(false);
        }
      }
    }

    fetchInvalidClicks();
    const intervalId = setInterval(fetchInvalidClicks, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [startDate, endDate]);

  return (
    <div className="bg-white shadow rounded p-6 border-l-4 border-orange-500">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-gray-700">Invalid Clicks</h2>
      </div>

      <div className="text-center text-5xl font-bold mb-4 text-orange-600">
        {loading ? "..." : invalidClicksCount.toLocaleString()}
      </div>

      {lastUpdated && (
        <div className="text-center text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
