import { db } from "@/lib/db";
import { ResourceMemberRole, ResourceVisibility } from "@prisma/client";

/** One page's access-relevant shape, as consumed by resolveInheritedAccess. */
export interface PageAccessShape {
    visibility: ResourceVisibility;
    organizationId: string;
    creatorId: string;
    members: { userId: string; role: ResourceMemberRole }[];
}

/**
 * Build the access chain for a page: the page itself followed by each ancestor
 * folder, nearest first. Feed the result to `resolveInheritedAccess` so folder
 * shares cascade down to their contents.
 *
 * Walks the `parentPageId` links with a depth cap as a guard against cycles.
 */
export async function loadPageAccessChain(
    pageId: string,
): Promise<PageAccessShape[]> {
    const chain: PageAccessShape[] = [];
    const seen = new Set<string>();
    let currentId: string | null = pageId;
    let depth = 0;

    while (currentId && depth < 25 && !seen.has(currentId)) {
        seen.add(currentId);
        const page: {
            parentPageId: string | null;
            visibility: ResourceVisibility;
            organizationId: string;
            authorId: string;
            members: { userId: string; role: ResourceMemberRole }[];
        } | null = await db.wikiPage.findUnique({
            where: { id: currentId },
            select: {
                parentPageId: true,
                visibility: true,
                organizationId: true,
                authorId: true,
                members: { select: { userId: true, role: true } },
            },
        });
        if (!page) break;
        chain.push({
            visibility: page.visibility,
            organizationId: page.organizationId,
            creatorId: page.authorId,
            members: page.members,
        });
        currentId = page.parentPageId;
        depth++;
    }

    return chain;
}
