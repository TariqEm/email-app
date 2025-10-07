const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Embedded blocklists (copied from your TS files)
const BLOCKED_ISPS = [
      '2day telecom llp',
  '365 - midlar ehf',
  '50hertz transmission gmbh',
  '6kanet',
  'adenis sarl',
  'ahbr company limited',
  'akamai international b.v.',
  'akamai technologies, inc.',
  'alastyr telekomunikasyon internet bilgisayar hizmetleri sanayi ticaret limited sirket',
  'alltele allmanna svenska telefonaktiebolaget',
  'alpari limited',
  'alvotech gmbh',
  'ankara universitesi rektorlugu',
  'arax i.s.p.',
  'as for mk netzdienste gmbh co. kg',
  'asiatech data transfer inc. plc',
  'asmunda new media ltd.',
  'aspire technology solutions ltd',
  'autonomous system for',
  'avea iletisim hizmetleri a.s.',
  'azeronline information services',
  'baharan plc',
  'baksell ltd llc',
  'beijing founder broadband network technology co. ltd',
  'beijing gehua catv network co. ltd.',
  'beijing kuandaitong telecom technology co. ltd',
  'belgacom s.a.',
  'british sky broadcasting limited',
  'broadnet as',
  'cableuropa s.a.u.',
  'call u communications ltd.',
  'camelhost sia',
  'cect-chinacomm communications co. ltd.',
  'china education and research network',
  'china internet network infomation center',
  'china telecom europe ltd.',
  'china unicom heilongjiang province network',
  'china unicom neimenggu province network',
  'chinanet beijing province network',
  'chinanet fujian province network',
  'chinanet guangdong province network',
  'chinanet guizhou province network',
  'chinanet henan province network',
  'chinanet neimenggu province network',
  'chinanet ningxia province network',
  'chinanet shaanxi province network',
  'chinanet shanxi province network',
  'chinanet',
  'chunghwa telecom data communication business group',
  'cipherspace gmbh',
  'amazon',
  'google',
  'microsoft',
  'cloudflare',
  'digitalocean',
  'linode',
  'ovh',
  'hetzner',
  'contabo',
  'vultr',
  'ibm',
  'oracle',
  'alibaba',
  'level 3',
  'leaseweb',
  'rackspace',
  'softlayer',
  'quadranet',
  'choopa',
  'colocrossing',
  'godaddy',
  'namecheap',
  'hostgator',
  'bluehost',
  'liquid web',
  'm247',
  'vpn',
  'proxy',
  'tor',
  'datacenter',
  'hosting',
  'cloud',
  'aruba',
].map(isp => isp.toLowerCase());

const BLOCKED_IPS = new Set([
  '185.164.32.217',
  '118.219.252.36',
  '100.27.27.201',
  '102.129.224.2',
  '104.131.176.234',
  '104.131.188.187',
  '45.11.183.21',
  '104.131.66.8',
  '104.131.92.125',
  '104.236.195.147',
  '104.236.205.233',
  '104.236.213.230',
  '104.236.70.228',
  '104.255.181.41',
  '105.235.134.190',
  '105.67.4.212',
  '107.167.109.26',
  '107.167.116.140',
  '107.170.127.117',
  '107.170.145.187',
  '107.170.166.118',
  '107.170.186.79',
  '108.174.126.243',
  '13.52.185.98',
  '13.56.150.167',
  '13.56.164.58',
  '13.56.184.70',
  '13.56.212.108',
  '13.57.179.221',
  '13.57.188.2',
  '13.57.202.160',
  '13.57.213.145',
  '13.57.23.250',
  '13.57.251.82',
  '13.57.3.226',
  '13.57.41.146',
  '13.57.56.124',
  '13.57.59.206',
  '13.57.9.92',
  '139.28.216.205',
  '139.47.67.73',
  '142.116.182.179',
  '142.44.173.135',
  '147.135.11.113',
  '147.135.36.175',
  '147.234.38.29',
  '154.160.21.132',
  '157.230.173.0',
  '159.65.253.109',
  '162.243.127.7',
  '167.142.232.4',
  '167.142.232.5',
  '167.142.232.6',
  '167.142.232.7',
  '173.243.184.125',
  '178.247.103.248',
  '178.62.5.157',
  '179.60.162.170',
  '18.144.17.166',
  '18.144.34.225',
  '18.144.47.173',
  '18.144.65.145',
  '18.191.184.135',
  '18.216.163.38',
  '18.221.165.86',
  '18.237.65.183',
  '185.38.241.4',
  '185.38.241.5',
  '188.57.159.110',
  '196.121.41.183',
  '198.105.218.92',
  '199.250.251.36',
  '199.68.53.171',
  '207.199.239.68',
  '208.117.250.9',
  '208.117.252.10',
  '208.117.252.4',
  '212.112.153.39',
  '216.226.127.198',
  '3.93.66.51',
  '34.204.187.225',
  '34.218.230.232',
  '34.222.106.68',
  '34.222.125.99',
  '34.223.231.51',
  '37.111.136.48',
  '47.31.137.67',
  '5.113.216.28',
  '52.15.180.133',
  '52.25.106.145',
  '52.53.163.28',
  '52.53.167.117',
  '52.53.170.109',
  '52.53.180.70',
  '52.53.201.206',
  '52.53.210.4',
  '52.53.221.86',
  '52.53.238.146',
  '52.53.238.199',
  '52.53.248.19',
  '52.53.248.2',
  '54.148.14.191',
  '54.149.64.150',
  '54.153.119.144',
  '54.153.21.70',
  '54.160.105.110',
  '54.161.124.177',
  '54.183.109.164',
  '54.183.118.178',
  '54.183.186.216',
  '54.183.2.166',
  '54.183.203.152',
  '54.183.214.93',
  '54.183.218.49',
  '54.183.225.119',
  '54.183.235.105',
  '54.183.240.71',
  '54.184.126.156',
  '54.191.121.41',
  '54.193.100.48',
  '54.193.110.11',
  '54.193.122.32',
  '54.193.35.56',
  '54.193.70.108',
  '54.202.244.231',
  '54.214.111.179',
  '54.215.178.221',
  '54.215.217.44',
  '54.215.231.11',
  '54.67.110.118',
  '54.67.57.163',
  '54.67.70.135',
  '54.71.187.124',
  '54.82.26.139',
  '54.86.177.53',
  '54.90.219.133',
  '64.251.58.118',
  '64.39.140.197',
  '64.90.64.197',
  '64.94.142.14',
  '64.94.35.33',
  '66.102.6.240',
  '66.102.6.242',
  '66.102.6.244',
  '66.159.33.5',
  '66.18.52.182',
  '66.249.81.117',
  '66.249.84.49',
  '66.249.85.51',
  '66.249.88.45',
  '66.249.93.49',
  '68.169.135.157',
  '69.25.58.18',
  '69.25.58.61',
  '209.222.82.149',
  '209.222.82.167',
  '209.222.82.164',
  '209.222.82.161',
  '209.222.82.158',
  '209.222.82.155',
  '209.222.82.152',
  '209.222.82.149',
  '209.222.82.146',
  '209.222.82.140',
  '209.222.82.137',
  '209.222.82.134',
  '209.222.82.131',
  '209.222.82.128',
  '69.25.58.55',
  '70.42.131.106',
  '70.42.131.189',
  '70.42.242.100',
  '74.217.90.250',
  '77.111.245.124',
  '77.111.245.220',
  '77.111.246.93',
  '77.111.247.161',
  '77.111.247.163',
  '77.95.65.68',
  '8.46.88.236',
  '82.145.222.200',
  '85.146.139.86',
  '40.94.31.26',
]);

const BLOCKED_IP_RANGES = [
  '51.124.95.0/24',
  '209.222.82.0/24',
];

// Helper function to check if IP is in CIDR range
function isIPInRange(ip, cidr) {
  try {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);
    
    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => {
    return (acc << 8) + parseInt(octet);
  }, 0) >>> 0;
}

// Check if ISP/Organization is blocked
function isISPBlocked(isp, organization) {
  if (!isp && !organization) return { blocked: false };

  const ispLower = isp ? isp.toLowerCase() : '';
  const orgLower = organization ? organization.toLowerCase() : '';

  for (const blockedIsp of BLOCKED_ISPS) {
    if (ispLower.includes(blockedIsp) || orgLower.includes(blockedIsp)) {
      return { blocked: true, reason: `Blocked ISP/Org: ${blockedIsp}` };
    }
  }

  return { blocked: false };
}

// Check if IP is blocked
function isIPBlocked(ip) {
  // Check exact match
  if (BLOCKED_IPS.has(ip)) {
    return { blocked: true, reason: `Blocked IP: ${ip}` };
  }

  // Check IP ranges
  for (const range of BLOCKED_IP_RANGES) {
    if (isIPInRange(ip, range)) {
      return { blocked: true, reason: `IP in blocked range: ${range}` };
    }
  }

  return { blocked: false };
}

async function main() {
  console.log('🔍 Starting fraud scan...\n');
  console.log(`📋 Blocklist info:`);
  console.log(`   Blocked ISPs: ${BLOCKED_ISPS.length}`);
  console.log(`   Blocked IPs: ${BLOCKED_IPS.size}`);
  console.log(`   Blocked IP Ranges: ${BLOCKED_IP_RANGES.length}\n`);

  // Get all tracking events that are not already marked as fraud
  const events = await prisma.trackingEvent.findMany({
    where: {
      OR: [
        { isFraud: false },
        { isFraud: null },
      ]
    },
    select: {
      id: true,
      eventType: true,
      ip: true,
      isp: true,
      organization: true,
      timestamp: true,
      campaignId: true,
      emailHash: true,
    },
  });

  console.log(`📊 Total events to scan: ${events.length}\n`);

  const fraudEvents = [];
  const fraudByType = {
    ip: 0,
    isp: 0,
    organization: 0,
  };

  let processed = 0;
  // Scan each event
  for (const event of events) {
    processed++;
    
    if (processed % 1000 === 0) {
      console.log(`   Scanned ${processed}/${events.length} events...`);
    }

    let isFraud = false;
    let fraudReason = '';
    let fraudType = '';

    // Check IP
    const ipCheck = isIPBlocked(event.ip);
    if (ipCheck.blocked) {
      isFraud = true;
      fraudReason = ipCheck.reason;
      fraudType = 'ip';
      fraudByType.ip++;
    }

    // Check ISP/Organization
    if (!isFraud) {
      const ispCheck = isISPBlocked(event.isp, event.organization);
      if (ispCheck.blocked) {
        isFraud = true;
        fraudReason = ispCheck.reason;
        fraudType = event.isp ? 'isp' : 'organization';
        if (event.isp) {
          fraudByType.isp++;
        } else {
          fraudByType.organization++;
        }
      }
    }

    if (isFraud) {
      fraudEvents.push({
        id: event.id,
        eventType: event.eventType,
        ip: event.ip,
        isp: event.isp,
        organization: event.organization,
        timestamp: event.timestamp,
        fraudReason,
        fraudType,
      });
    }
  }

  console.log(`\n🚨 Fraud detected: ${fraudEvents.length} events\n`);

  if (fraudEvents.length === 0) {
    console.log('✅ No fraud found in database!\n');
    return;
  }

  // Display summary
  console.log('📈 Fraud breakdown:');
  console.log(`   Blocked IPs: ${fraudByType.ip}`);
  console.log(`   Blocked ISPs: ${fraudByType.isp}`);
  console.log(`   Blocked Organizations: ${fraudByType.organization}\n`);

  // Show breakdown by event type
  const fraudByEventType = fraudEvents.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 Fraud by event type:');
  Object.entries(fraudByEventType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  // Show sample fraud events (first 10)
  console.log('\n🔍 Sample fraud events (first 10):');
  fraudEvents.slice(0, 10).forEach((event, i) => {
    console.log(`\n${i + 1}. ID: ${event.id}`);
    console.log(`   Type: ${event.eventType}`);
    console.log(`   IP: ${event.ip}`);
    console.log(`   ISP: ${event.isp || 'N/A'}`);
    console.log(`   Organization: ${event.organization || 'N/A'}`);
    console.log(`   Reason: ${event.fraudReason}`);
    console.log(`   Timestamp: ${event.timestamp.toISOString()}`);
  });

  // Ask user if they want to mark as fraud
  console.log('\n⚠️  Do you want to mark these events as fraud in the database?');
  console.log('   This will set isFraud=true and add fraudReason');
  console.log('\n   Run with --update flag to update database:');
  console.log('   node scripts/scan-fraud.js --update\n');

  // Check if --update flag is present
  if (process.argv.includes('--update')) {
    console.log('🔄 Updating database...\n');

    let updated = 0;
    for (const event of fraudEvents) {
      try {
        await prisma.trackingEvent.update({
          where: { id: event.id },
          data: {
            isFraud: true,
            fraudReason: event.fraudReason,
          },
        });
        updated++;

        if (updated % 100 === 0) {
          console.log(`   Updated ${updated}/${fraudEvents.length} events...`);
        }
      } catch (error) {
        console.error(`   Failed to update event ${event.id}:`, error.message);
      }
    }

    console.log(`\n✅ Successfully updated ${updated} events as fraud\n`);

    // Show updated stats
    const totalFraud = await prisma.trackingEvent.count({
      where: { isFraud: true },
    });

    const totalEvents = await prisma.trackingEvent.count();

    console.log('📊 Updated database stats:');
    console.log(`   Total events: ${totalEvents}`);
    console.log(`   Fraud events: ${totalFraud} (${((totalFraud/totalEvents)*100).toFixed(2)}%)`);
    console.log(`   Valid events: ${totalEvents - totalFraud} (${(((totalEvents - totalFraud)/totalEvents)*100).toFixed(2)}%)\n`);
  }

  // Export fraud events to CSV
  if (process.argv.includes('--export')) {
    const fs = require('fs');
    const csvRows = [
      'ID,Event Type,IP,ISP,Organization,Fraud Reason,Timestamp'
    ];

    fraudEvents.forEach(event => {
      csvRows.push(
        `${event.id},${event.eventType},${event.ip},"${event.isp || ''}","${event.organization || ''}","${event.fraudReason}",${event.timestamp.toISOString()}`
      );
    });

    const csvContent = csvRows.join('\n');
    fs.writeFileSync('fraud-events.csv', csvContent);
    console.log('📄 Fraud events exported to fraud-events.csv\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
