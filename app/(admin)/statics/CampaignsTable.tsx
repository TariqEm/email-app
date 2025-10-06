"use client";

import React, { useState, useEffect } from "react";
import { MoreVertical, Download, Trash2, Eye, Link2, Copy, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

interface EventExtra {
  total: number;
  unique: number;
  duplicates: number;
  invalid: number;
}

interface CampaignStats {
  id: string;
  name: string;
  offerName: string;
  sponsorName: string;
  targetCountries: string[];
  opens: number;
  clicks: number;
  unsubs: number;
  opensExtra: EventExtra;
  clicksExtra: EventExtra;
  unsubsExtra: EventExtra;
  trackingPixelLink: string | null;
  clickTrackingLink: string | null;
  unsubTrackingLink: string | null;
}

interface CampaignsTableProps {
  startDate: Date;
  endDate: Date;
  refreshKey?: number; // Add this
}

// Stat cell with hover tooltip
const StatCell = ({ value, extra, color }: { value: number; extra: EventExtra; color: string }) => {
  const hasMore = extra.duplicates > 0 || extra.invalid > 0;

  return (
    <div className="flex items-center justify-center gap-1">
      <span className={`font-semibold ${color}`}>{value.toLocaleString()}</span>
      {hasMore && (
        <HoverCard>
          <HoverCardTrigger>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 cursor-help hover:bg-gray-200">
              more
            </span>
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Events:</span>
                <span className="font-semibold">{extra.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unique (shown):</span>
                <span className="font-semibold text-green-600">{extra.unique}</span>
              </div>
              {extra.duplicates > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Duplicates:</span>
                  <span className="font-semibold text-orange-600">{extra.duplicates}</span>
                </div>
              )}
              {extra.invalid > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Invalid:</span>
                  <span className="font-semibold text-red-600">{extra.invalid}</span>
                </div>
              )}
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
};

export default function CampaignsTable({ startDate, endDate, refreshKey }: CampaignsTableProps) {
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<{ id: string; name: string } | null>(null);
  const [downloadType, setDownloadType] = useState<string>("all");
  const [isDownloading, setIsDownloading] = useState(false);

  // Tracking links modal state
  const [showTrackingLinksModal, setShowTrackingLinksModal] = useState(false);
  const [selectedTrackingCampaign, setSelectedTrackingCampaign] = useState<CampaignStats | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchCampaigns() {
      setLoading(true);
      try {
        const url = new URL("/api/statics/campaigns", window.location.origin);
        url.searchParams.set("startDate", startDate.toISOString());
        url.searchParams.set("endDate", endDate.toISOString());

        const res = await fetch(url);
        const data = await res.json();
        
        if (isMounted) {
          setCampaigns(data.campaigns || []);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
        if (isMounted) {
          setCampaigns([]);
          setLoading(false);
        }
      }
    }

    fetchCampaigns();
    const intervalId = setInterval(fetchCampaigns, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [startDate, endDate, refreshKey]);

  function handleViewStats(campaignId: string) {
    window.location.href = `/dashboard/campaigns/${campaignId}/stats`;
  }

  function openDownloadModal(campaignId: string, campaignName: string) {
    setSelectedCampaign({ id: campaignId, name: campaignName });
    setDownloadType("all");
    setShowDownloadModal(true);
  }

  function openTrackingLinksModal(campaign: CampaignStats) {
    setSelectedTrackingCampaign(campaign);
    setShowTrackingLinksModal(true);
    setCopiedField(null);
  }

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy to clipboard");
    }
  }

  async function handleDownloadEmails() {
    if (!selectedCampaign) return;

    setIsDownloading(true);
    try {
      const url = new URL("/api/statics/campaigns/download-emails", window.location.origin);
      url.searchParams.set("campaignId", selectedCampaign.id);
      url.searchParams.set("startDate", startDate.toISOString());
      url.searchParams.set("endDate", endDate.toISOString());
      url.searchParams.set("type", downloadType);

      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Failed to download emails');
      }

      const blob = await res.blob();
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${selectedCampaign.name}-${downloadType}-emails.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setShowDownloadModal(false);
    } catch (error) {
      console.error("Failed to download emails:", error);
      alert("Failed to download email list");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDeleteCampaign(campaignId: string, campaignName: string) {
    if (!confirm(`Are you sure you want to delete campaign "${campaignName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete campaign');
      }

      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      alert('Campaign deleted successfully');
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      alert("Failed to delete campaign");
    }
  }

  return (
    <>
      <div className="bg-white shadow rounded p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Campaigns Performance</h2>
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No campaigns found for this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Campaign Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Sponsor</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Offer Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Target Country</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Opens</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Clicks</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Unsubs</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{campaign.name}</td>
                    <td className="py-3 px-4">{campaign.sponsorName}</td>
                    <td className="py-3 px-4">{campaign.offerName}</td>
                    <td className="py-3 px-4">
                      {campaign.targetCountries.length > 0
                        ? campaign.targetCountries.join(", ")
                        : "All"}
                    </td>
                    <td className="text-center py-3 px-4">
                      <StatCell value={campaign.opens} extra={campaign.opensExtra} color="text-blue-600" />
                    </td>
                    <td className="text-center py-3 px-4">
                      <StatCell value={campaign.clicks} extra={campaign.clicksExtra} color="text-green-600" />
                    </td>
                    <td className="text-center py-3 px-4">
                      <StatCell value={campaign.unsubs} extra={campaign.unsubsExtra} color="text-red-600" />
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewStats(campaign.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Stats
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openTrackingLinksModal(campaign)}>
                              <Link2 className="mr-2 h-4 w-4" />
                              View Tracking Links
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDownloadModal(campaign.id, campaign.name)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download Email List
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Campaign
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Download Modal */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Email List</DialogTitle>
            <DialogDescription>
              Select which email list you want to download for campaign: <strong>{selectedCampaign?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={downloadType} onValueChange={setDownloadType}>
              <div className="flex items-center space-x-2 mb-3">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer">All Emails</Label>
              </div>
              <div className="flex items-center space-x-2 mb-3">
                <RadioGroupItem value="opens" id="opens" />
                <Label htmlFor="opens" className="cursor-pointer">Openers Only</Label>
              </div>
              <div className="flex items-center space-x-2 mb-3">
                <RadioGroupItem value="clicks" id="clicks" />
                <Label htmlFor="clicks" className="cursor-pointer">Clickers Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unsubs" id="unsubs" />
                <Label htmlFor="unsubs" className="cursor-pointer">Unsubscribers Only</Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDownloadModal(false)}
              disabled={isDownloading}
            >
              Cancel
            </Button>
            <Button onClick={handleDownloadEmails} disabled={isDownloading}>
              {isDownloading ? (
                <>Downloading...</>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tracking Links Modal */}
      <Dialog open={showTrackingLinksModal} onOpenChange={setShowTrackingLinksModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tracking Links</DialogTitle>
            <DialogDescription>
              Copy tracking links for campaign: <strong>{selectedTrackingCampaign?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Open Tracking Pixel</Label>
              <div className="flex gap-2">
                <Input
                  value={selectedTrackingCampaign?.trackingPixelLink || 'Not configured'}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedTrackingCampaign?.trackingPixelLink && copyToClipboard(selectedTrackingCampaign.trackingPixelLink, 'open')}
                  disabled={!selectedTrackingCampaign?.trackingPixelLink}
                >
                  {copiedField === 'open' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Click Tracking Link</Label>
              <div className="flex gap-2">
                <Input
                  value={selectedTrackingCampaign?.clickTrackingLink || 'Not configured'}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedTrackingCampaign?.clickTrackingLink && copyToClipboard(selectedTrackingCampaign.clickTrackingLink, 'click')}
                  disabled={!selectedTrackingCampaign?.clickTrackingLink}
                >
                  {copiedField === 'click' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Unsubscribe Tracking Link</Label>
              <div className="flex gap-2">
                <Input
                  value={selectedTrackingCampaign?.unsubTrackingLink || 'Not configured'}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedTrackingCampaign?.unsubTrackingLink && copyToClipboard(selectedTrackingCampaign.unsubTrackingLink, 'unsub')}
                  disabled={!selectedTrackingCampaign?.unsubTrackingLink}
                >
                  {copiedField === 'unsub' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowTrackingLinksModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
