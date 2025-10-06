"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MetricData {
  count: number;
  percent: number;
}

interface InsightRow {
  name: string;
  totalRecords: number;
  opened: MetricData;
  clicked: MetricData;
  unsubscribed: MetricData;
}

interface CampaignInsights {
  campaignName: string;
  operatingSystems: InsightRow[];
  browsers: InsightRow[];
  locations: InsightRow[];
  cities: InsightRow[];
  deviceTypes: InsightRow[];
  timezones: InsightRow[];
  emailDomains: InsightRow[];
}

const MetricCell = ({ value, percent }: { value: number; percent: number }) => {
  const getColor = (p: number) => {
    if (p === 0) return "text-muted-foreground";
    if (p > 50) return "text-green-500";
    if (p > 20) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="text-sm">
      {value.toLocaleString()} <span className={getColor(percent)}>({percent.toFixed(2)}%)</span>
    </div>
  );
};

export default function CampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [insights, setInsights] = useState<CampaignInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState("10");

  // Segmentation filters
  const [filterOS, setFilterOS] = useState<string>("all");
  const [filterBrowser, setFilterBrowser] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterDeviceType, setFilterDeviceType] = useState<string>("all");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  
  // Segment count
  const [segmentCount, setSegmentCount] = useState<number>(0);
  const [fetchingCount, setFetchingCount] = useState(false);

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      try {
        const url = new URL(`/api/campaigns/${campaignId}/insights`, window.location.origin);

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("Received non-JSON response:", text);
          throw new Error("Server returned non-JSON response");
        }

        const data = await res.json();
        setInsights(data);
      } catch (error) {
        console.error("Failed to fetch insights:", error);
        setInsights(null);
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, [campaignId]);

  // Fetch segment count whenever filters change
  useEffect(() => {
    async function fetchSegmentCount() {
      setFetchingCount(true);
      try {
        const url = new URL(`/api/campaigns/${campaignId}/segment-count`, window.location.origin);
        
        if (filterOS !== "all") url.searchParams.set("os", filterOS);
        if (filterBrowser !== "all") url.searchParams.set("browser", filterBrowser);
        if (filterCountry !== "all") url.searchParams.set("country", filterCountry);
        if (filterDeviceType !== "all") url.searchParams.set("deviceType", filterDeviceType);
        if (filterEventType !== "all") url.searchParams.set("eventType", filterEventType);

        const res = await fetch(url);
        const data = await res.json();
        setSegmentCount(data.count || 0);
      } catch (error) {
        console.error("Failed to fetch segment count:", error);
        setSegmentCount(0);
      } finally {
        setFetchingCount(false);
      }
    }

    if (insights) {
      fetchSegmentCount();
    }
  }, [campaignId, filterOS, filterBrowser, filterCountry, filterDeviceType, filterEventType, insights]);

  async function handleSegmentedDownload() {
    try {
      const url = new URL(`/api/campaigns/${campaignId}/download-segmented`, window.location.origin);
      
      if (filterOS !== "all") url.searchParams.set("os", filterOS);
      if (filterBrowser !== "all") url.searchParams.set("browser", filterBrowser);
      if (filterCountry !== "all") url.searchParams.set("country", filterCountry);
      if (filterDeviceType !== "all") url.searchParams.set("deviceType", filterDeviceType);
      if (filterEventType !== "all") url.searchParams.set("eventType", filterEventType);

      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Failed to download segmented list');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${insights?.campaignName}-segmented-emails.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to download segmented emails:", error);
      alert("Failed to download email list");
    }
  }

  const renderInsightTable = (data: InsightRow[], categoryName: string) => {
    const filteredData = data.filter((row) =>
      row.name.toLowerCase().includes(search.toLowerCase())
    );

    const totals = filteredData.reduce(
      (acc, row) => ({
        totalRecords: acc.totalRecords + row.totalRecords,
        opened: {
          count: acc.opened.count + row.opened.count,
          percent: 0,
        },
        clicked: {
          count: acc.clicked.count + row.clicked.count,
          percent: 0,
        },
        unsubscribed: {
          count: acc.unsubscribed.count + row.unsubscribed.count,
          percent: 0,
        },
      }),
      { totalRecords: 0, opened: { count: 0, percent: 0 }, clicked: { count: 0, percent: 0 }, unsubscribed: { count: 0, percent: 0 } }
    );

    if (totals.totalRecords > 0) {
      totals.opened.percent = (totals.opened.count / totals.totalRecords) * 100;
      totals.clicked.percent = (totals.clicked.count / totals.totalRecords) * 100;
      totals.unsubscribed.percent = (totals.unsubscribed.count / totals.totalRecords) * 100;
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select value={entriesPerPage} onValueChange={setEntriesPerPage}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Search:</span>
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
              placeholder={`Search ${categoryName}...`}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    {categoryName}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    Total Records
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    Opened
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    Clicked
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    Unsubscribed
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredData.slice(0, parseInt(entriesPerPage)).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.name || "Unknown"}</TableCell>
                      <TableCell>{row.totalRecords.toLocaleString()}</TableCell>
                      <TableCell>
                        <MetricCell value={row.opened.count} percent={row.opened.percent} />
                      </TableCell>
                      <TableCell>
                        <MetricCell value={row.clicked.count} percent={row.clicked.percent} />
                      </TableCell>
                      <TableCell>
                        <MetricCell value={row.unsubscribed.count} percent={row.unsubscribed.percent} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell>{totals.totalRecords.toLocaleString()}</TableCell>
                    <TableCell>
                      <MetricCell value={totals.opened.count} percent={totals.opened.percent} />
                    </TableCell>
                    <TableCell>
                      <MetricCell value={totals.clicked.count} percent={totals.clicked.percent} />
                    </TableCell>
                    <TableCell>
                      <MetricCell value={totals.unsubscribed.count} percent={totals.unsubscribed.percent} />
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {Math.min(filteredData.length, parseInt(entriesPerPage))} of {filteredData.length} entries
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading campaign insights...</div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Campaign not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-semibold text-foreground">
              {insights.campaignName} - Insights Report
            </h1>
          </div>
        </div>

        {/* Segmentation Download Section */}
        <div className="mb-6 bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-4">Download Segmented Email List</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <Label className="text-sm mb-2 block">Operating System</Label>
              <Select value={filterOS} onValueChange={setFilterOS}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All OS</SelectItem>
                  {insights.operatingSystems.map((os) => (
                    <SelectItem key={os.name} value={os.name}>{os.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Browser</Label>
              <Select value={filterBrowser} onValueChange={setFilterBrowser}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Browsers</SelectItem>
                  {insights.browsers.map((browser) => (
                    <SelectItem key={browser.name} value={browser.name}>{browser.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Country</Label>
              <Select value={filterCountry} onValueChange={setFilterCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {insights.locations.map((location) => (
                    <SelectItem key={location.name} value={location.name}>{location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Device Type</Label>
              <Select value={filterDeviceType} onValueChange={setFilterDeviceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {insights.deviceTypes.map((device) => (
                    <SelectItem key={device.name} value={device.name}>{device.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Event Type</Label>
              <Select value={filterEventType} onValueChange={setFilterEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="open">Openers</SelectItem>
                  <SelectItem value="click">Clickers</SelectItem>
                  <SelectItem value="unsubscribe">Unsubscribers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button onClick={handleSegmentedDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download Segmented List
            </Button>

            <div className="text-sm text-gray-600">
              {fetchingCount ? (
                <span>Calculating...</span>
              ) : (
                <span>
                  Total emails matching filters: <strong className="text-lg text-blue-600">{segmentCount.toLocaleString()}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="operating-systems" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="operating-systems">Operating Systems</TabsTrigger>
            <TabsTrigger value="browsers">Browsers</TabsTrigger>
            <TabsTrigger value="locations">Countries</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="device-types">Device Types</TabsTrigger>
            <TabsTrigger value="timezones">Timezones</TabsTrigger>
            <TabsTrigger value="email-domains">Email Domains</TabsTrigger>
          </TabsList>

          <TabsContent value="operating-systems">
            {renderInsightTable(insights.operatingSystems, "Operating System")}
          </TabsContent>

          <TabsContent value="browsers">
            {renderInsightTable(insights.browsers, "Browser")}
          </TabsContent>

          <TabsContent value="locations">
            {renderInsightTable(insights.locations, "Country")}
          </TabsContent>

          <TabsContent value="cities">
            {renderInsightTable(insights.cities, "City")}
          </TabsContent>

          <TabsContent value="device-types">
            {renderInsightTable(insights.deviceTypes, "Device Type")}
          </TabsContent>

          <TabsContent value="timezones">
            {renderInsightTable(insights.timezones, "Timezone")}
          </TabsContent>

          <TabsContent value="email-domains">
            {renderInsightTable(insights.emailDomains, "Email Domain")}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
