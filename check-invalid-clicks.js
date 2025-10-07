const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking invalid clicks...\n');

  // Query 1: Group by eventType and isInvalid
  const grouped = await prisma.trackingEvent.groupBy({
    by: ['eventType', 'isInvalid'],
    _count: {
      _all: true
    }
  });

  console.log('📊 Events grouped by type and validity:');
  console.table(grouped.map(g => ({
    eventType: g.eventType,
    isInvalid: g.isInvalid,
    count: g._count._all
  })));

  // Query 2: Get recent invalid clicks
  const invalidClicks = await prisma.trackingEvent.findMany({
    where: {
      eventType: 'click',
      isInvalid: true
    },
    select: {
      timestamp: true,
      eventType: true,
      isInvalid: true,
      ip: true,
      userAgent: true
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: 10
  });

  console.log('\n🔍 Recent invalid clicks (last 10):');
  invalidClicks.forEach((click, i) => {
    console.log(`\n${i + 1}. Timestamp: ${click.timestamp.toISOString()}`);
    console.log(`   IP: ${click.ip}`);
    console.log(`   User-Agent: ${click.userAgent?.substring(0, 50)}...`);
  });

  // Summary stats
  const totalClicks = await prisma.trackingEvent.count({
    where: { eventType: 'click' }
  });

  const invalidClicksCount = await prisma.trackingEvent.count({
    where: {
      eventType: 'click',
      isInvalid: true
    }
  });

  const validClicksCount = await prisma.trackingEvent.count({
    where: {
      eventType: 'click',
      isInvalid: false
    }
  });

  console.log('\n📈 Summary:');
  console.log(`Total Clicks: ${totalClicks}`);
  console.log(`Valid Clicks: ${validClicksCount} (${((validClicksCount/totalClicks)*100).toFixed(1)}%)`);
  console.log(`Invalid Clicks: ${invalidClicksCount} (${((invalidClicksCount/totalClicks)*100).toFixed(1)}%)`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
