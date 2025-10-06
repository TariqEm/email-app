"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Sponsor {
  id: string;
  name: string;
}

interface TrackingDomain {
  id: string;
  domain: string;
}

export default function CreateCampaignModal({ open, onClose, onSuccess }: CreateCampaignModalProps) {
  const [loading, setLoading] = useState(false);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [trackingDomains, setTrackingDomains] = useState<TrackingDomain[]>([]);
  
  const [formData, setFormData] = useState({
    sponsorId: "",
    offerId: "",
    campaignName: "",
    targetCountries: "",
    status: "active",
    trackingDomainId: "",
    cortexClickTracking: "",
    cortexUnsbTracking: "",
  });

  useEffect(() => {
    if (open) {
      fetchSponsors();
      fetchTrackingDomains();
    }
  }, [open]);

  async function fetchSponsors() {
    try {
      const res = await fetch('/api/sponsors');
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setSponsors(data.sponsors || []);
    } catch (error) {
      console.error('Failed to fetch sponsors:', error);
      setSponsors([]);
    }
  }

  async function fetchTrackingDomains() {
    try {
      const res = await fetch('/api/tracking-domains');
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setTrackingDomains(data.domains || []);
    } catch (error) {
      console.error('Failed to fetch tracking domains:', error);
      setTrackingDomains([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        targetCountries: formData.targetCountries.split(',').map(c => c.trim()).filter(Boolean),
      };

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create campaign');
      }

      onSuccess();
      
      // Reset form
      setFormData({
        sponsorId: "",
        offerId: "",
        campaignName: "",
        targetCountries: "",
        status: "active",
        trackingDomainId: "",
        cortexClickTracking: "",
        cortexUnsbTracking: "",
      });
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert(error instanceof Error ? error.message : 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new email campaign
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="campaignName">Campaign Name *</Label>
            <Input
              id="campaignName"
              value={formData.campaignName}
              onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
              placeholder="My Campaign 2025"
              required
            />
          </div>

          <div>
            <Label htmlFor="sponsor">Sponsor *</Label>
            <Select
              value={formData.sponsorId}
              onValueChange={(value) => setFormData({ ...formData, sponsorId: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a sponsor" />
              </SelectTrigger>
              <SelectContent>
                {sponsors.map((sponsor) => (
                  <SelectItem key={sponsor.id} value={sponsor.id}>
                    {sponsor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="offerId">Offer ID *</Label>
            <Input
              id="offerId"
              value={formData.offerId}
              onChange={(e) => setFormData({ ...formData, offerId: e.target.value })}
              placeholder="Enter offer ID"
              required
            />
          </div>

          <div>
            <Label htmlFor="targetCountries">Target Countries *</Label>
            <Input
              id="targetCountries"
              value={formData.targetCountries}
              onChange={(e) => setFormData({ ...formData, targetCountries: e.target.value })}
              placeholder="US, CA, GB (comma-separated)"
              required
            />
          </div>

          <div>
            <Label htmlFor="trackingDomain">Tracking Domain</Label>
            <Select
              value={formData.trackingDomainId}
              onValueChange={(value) => setFormData({ ...formData, trackingDomainId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tracking domain (optional)" />
              </SelectTrigger>
              <SelectContent>
                {trackingDomains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cortexClickTracking">Cortex Click URL</Label>
              <Input
                id="cortexClickTracking"
                value={formData.cortexClickTracking}
                onChange={(e) => setFormData({ ...formData, cortexClickTracking: e.target.value })}
                placeholder="https://example.com/click"
              />
            </div>

            <div>
              <Label htmlFor="cortexUnsbTracking">Cortex Unsub URL</Label>
              <Input
                id="cortexUnsbTracking"
                value={formData.cortexUnsbTracking}
                onChange={(e) => setFormData({ ...formData, cortexUnsbTracking: e.target.value })}
                placeholder="https://example.com/unsub"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
