"use client";

import React, { useState, useEffect } from "react";

interface OpensData {
  count: number;
}

interface OpensCardProps {
  startDate: Date;
  endDate: Date;
}

export default function OpensCard({ startDate, endDate }: OpensCardProps) {
  const [opensCount, setOpensCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchOpens() {
      setLoading(true);
      try {
        const url = new URL("/api/statics/opens", window.location.origin);
        url.searchParams.set("startDate", startDate.toISOString());
        url.searchParams.set("endDate", endDate.toISOString());

        const res = await fetch(url);
        const json: OpensData = await res.json();
        if (isMounted) {
          setOpensCount(json.count);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (isMounted) {
          setOpensCount(0);
          setLoading(false);
        }
      }
    }

    fetchOpens();
    const intervalId = setInterval(fetchOpens, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [startDate, endDate]);

  return (
    <div className="bg-white shadow rounded p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Opens</h2>

      <div className="text-center text-5xl font-bold mb-4 text-blue-600">
        {loading ? "..." : opensCount.toLocaleString()}
      </div>

      {lastUpdated && (
        <div className="text-center text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
