const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const pages = await prisma.wikiPage.findMany({ take: 1 });
        console.log('Found pages:', pages.length);
        if (pages.length > 0) {
            console.log('Page keys:', Object.keys(pages[0]));
        }

        const columns = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'WikiPage' AND column_name = 'published'");
        console.log('Column check:', columns);
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
