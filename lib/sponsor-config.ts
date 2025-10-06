// lib/sponsor-config.ts

export type PlatformKey = 'everflow' | 'hitpath' | 'cake' | 'hasoffers';

interface PlatformConfig {
  api_url_offer: string;
  api_url_reporting: string;
  login_driver?: string;
  affiliateInfoUrl?: string;
  tracking_template?: string;
}

export const sponsorConfigs: Record<PlatformKey, PlatformConfig> = {
  everflow: {
    api_url_offer: 'https://api.eflow.team/v1/affiliates/offers/',
    api_url_reporting: 'https://api.eflow.team/v1/affiliates/reporting',
    affiliateInfoUrl: 'https://api.eflow.team/v1/affiliates/affiliate',
    tracking_template: '?sub1=[user]&sub2=[offer]-[campaign]&sub3=[list]-[email]-[interface]',
  },
  hitpath: {
    api_url_offer: '',
    api_url_reporting: '',
    affiliateInfoUrl: '',
  },
  cake: {
    api_url_offer: 'https://lolaleadsmarketing.com/affiliates/api',
    api_url_reporting: 'https://lolaleadsmarketing.com/affiliates/api',
    affiliateInfoUrl: 'https://lolaleadsmarketing.com/affiliates/api/Account/AccountManager',
    tracking_template: '?sub1=[user]&sub2=[offer]-[campaign]&sub3=[list]-[email]-[interface]',
  },
  hasoffers: {
    api_url_offer: '',
    api_url_reporting: '',
    affiliateInfoUrl: '',
  },
};