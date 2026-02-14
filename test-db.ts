import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const pages = await prisma.wikiPage.findMany({ take: 1 })
    console.log(pages)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
