import { db } from './src/lib/db';

async function test() {
    try {
        const page = await db.wikiPage.findFirst();
        if (!page) {
            console.log('No pages found to test');
            return;
        }
        console.log('Found page:', page.id);
        console.log('Checking for published field in object:', 'published' in page);

        // Try to update using a raw query to check if the column exists in PG
        const result = await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'WikiPage' AND column_name = 'published'`;
        console.log('Column check result:', result);
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await db.$disconnect();
    }
}

test();
