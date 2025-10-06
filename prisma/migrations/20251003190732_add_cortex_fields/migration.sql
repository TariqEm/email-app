-- CreateEnum
CREATE TYPE "SponsorPlatform" AS ENUM ('everflow', 'hitpath', 'hasoffers', 'cake');

-- CreateEnum
CREATE TYPE "SponsorStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('open', 'click', 'unsubscribe');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('active', 'inactive', 'paused');

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_driver" TEXT NOT NULL,
    "affiliate_number" TEXT,
    "api_key" TEXT,
    "username" TEXT,
    "password" TEXT,
    "api_url_offer" TEXT,
    "api_url_reporting" TEXT,
    "login_driver" TEXT,
    "tracking_template" TEXT,
    "status" "SponsorStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "externalOfferId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "offerTrackingLink" TEXT,
    "unsbTrackingLink" TEXT,
    "payoutType" TEXT,
    "optizmoKey" TEXT,
    "allowedCountries" TEXT[],
    "payoutAmount" DOUBLE PRECISION,
    "payoutCurrency" TEXT,
    "verticalId" TEXT,
    "geoTargeting" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vertical" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vertical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "unsubscribeUrl" TEXT NOT NULL,
    "trackingDomainId" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "inactiveReason" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "targetCountries" TEXT[],
    "status" "CampaignStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cortexClickTracking" TEXT,
    "cortexUnsbTracking" TEXT,
    "trackingPixelLink" TEXT,
    "clickTrackingLink" TEXT,
    "unsubTrackingLink" TEXT,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSegment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "verticalId" TEXT,
    "countries" TEXT[],
    "deviceTypes" TEXT[],
    "filterRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "emailHash" TEXT NOT NULL,
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" TEXT,
    "referer" TEXT,
    "city" TEXT,
    "region" TEXT,
    "isp" TEXT,
    "organization" TEXT,
    "asn" INTEGER,
    "timezone" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "browserVersion" TEXT,
    "os" TEXT,
    "userAgent" TEXT,
    "isInvalid" BOOLEAN NOT NULL DEFAULT false,
    "additionalData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingDomain" (
    "id" TEXT NOT NULL,
    "subdomainPrefix" TEXT NOT NULL,
    "rootDomain" TEXT NOT NULL,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dnsVerified" BOOLEAN NOT NULL DEFAULT false,
    "rotationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiSyncLog" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "lastSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "recordsCount" INTEGER NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "ApiSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSegment" (
    "id" TEXT NOT NULL,
    "countryCodes" TEXT[],
    "verticalIds" TEXT[],
    "engagement" TEXT,
    "customFilter" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateManager" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telegram" TEXT,
    "referralLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_externalOfferId_key" ON "Offer"("externalOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "Vertical_slug_key" ON "Vertical"("slug");

-- CreateIndex
CREATE INDEX "TrackingEvent_campaignId_idx" ON "TrackingEvent"("campaignId");

-- CreateIndex
CREATE INDEX "TrackingEvent_eventType_idx" ON "TrackingEvent"("eventType");

-- CreateIndex
CREATE INDEX "TrackingEvent_timestamp_idx" ON "TrackingEvent"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateManager_sponsorId_key" ON "AffiliateManager"("sponsorId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vertical" ADD CONSTRAINT "Vertical_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_trackingDomainId_fkey" FOREIGN KEY ("trackingDomainId") REFERENCES "TrackingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSegment" ADD CONSTRAINT "CampaignSegment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSegment" ADD CONSTRAINT "CampaignSegment_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiSyncLog" ADD CONSTRAINT "ApiSyncLog_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateManager" ADD CONSTRAINT "AffiliateManager_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
