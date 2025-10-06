"use client";

import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { Plus } from "lucide-react";
import OpensCard from './OpensCard';
import ClicksCard from './ClicksCard';
import UnsubscribesCard from './UnsubscribesCard';
import InvalidClicksCard from './InvalidClicksCard';
import CampaignsTable from './CampaignsTable';
import CreateCampaignModal from './CreateCampaignModal';
import { Button } from "@/components/ui/button";

const ranges = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last7" },
  { label: "Last Month", value: "lastMonth" },
  { label: "Custom Range", value: "custom" },
];

export default function StaticsPage() {
  const [range, setRange] = useState<string>("today");
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const now = new Date();
    switch (range) {
      case "today":
        setStartDate(startOfDay(now));
        setEndDate(endOfDay(now));
        break;
      case "yesterday":
        setStartDate(startOfDay(subDays(now, 1)));
        setEndDate(endOfDay(subDays(now, 1)));
        break;
      case "last7":
        setStartDate(startOfDay(subDays(now, 6)));
        setEndDate(endOfDay(now));
        break;
      case "lastMonth":
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        setStartDate(startOfDay(firstDayLastMonth));
        setEndDate(endOfDay(lastDayLastMonth));
        break;
      case "custom":
      default:
        break;
    }
  }, [range]);

  const handleCampaignCreated = () => {
    setShowCreateModal(false);
    setRefreshKey(prev => prev + 1); // Trigger refresh of campaigns table
  };

  return (
    <div className="p-8">
      <div className="mb-6 bg-white shadow rounded p-4">
        <h1 className="text-2xl font-bold mb-4">Statistics</h1>
        
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <select
            className="p-2 border rounded"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {ranges.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {range === "custom" && (
            <div className="flex space-x-2">
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => date && setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                maxDate={new Date()}
                className="border p-2 rounded"
                placeholderText="Start Date"
              />
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => date && setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                maxDate={new Date()}
                className="border p-2 rounded"
                placeholderText="End Date"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <OpensCard startDate={startDate} endDate={endDate} />
        <ClicksCard startDate={startDate} endDate={endDate} />
        <UnsubscribesCard startDate={startDate} endDate={endDate} />
        <InvalidClicksCard startDate={startDate} endDate={endDate} />
      </div>

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Campaign
        </Button>
      </div>

      <CampaignsTable 
        startDate={startDate} 
        endDate={endDate} 
        refreshKey={refreshKey}
      />

      <CreateCampaignModal 
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCampaignCreated}
      />
    </div>
  );
}
