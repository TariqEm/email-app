"use client";

import React, { useState, useEffect } from "react";

interface ClicksData {
  count: number;
}

interface ClicksCardProps {
  startDate: Date;
  endDate: Date;
}

export default function ClicksCard({ startDate, endDate }: ClicksCardProps) {
  const [clicksCount, setClicksCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchClicks() {
      setLoading(true);
      try {
        const url = new URL("/api/statics/clicks", window.location.origin);
        url.searchParams.set("startDate", startDate.toISOString());
        url.searchParams.set("endDate", endDate.toISOString());

        const res = await fetch(url);
        const json: ClicksData = await res.json();
        if (isMounted) {
          setClicksCount(json.count);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (isMounted) {
          setClicksCount(0);
          setLoading(false);
        }
      }
    }

    fetchClicks();
    const intervalId = setInterval(fetchClicks, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [startDate, endDate]);

  return (
    <div className="bg-white shadow rounded p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Clicks</h2>

      <div className="text-center text-5xl font-bold mb-4 text-green-600">
        {loading ? "..." : clicksCount.toLocaleString()}
      </div>

      {lastUpdated && (
        <div className="text-center text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
