import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
    const hostname = request.headers.get("host") || "";

    // Extract subdomain
    // This logic assumes standard domain structure (e.g., subdomain.domain.com or subdomain.localhost:port)
    const subdomain = hostname.split(".")[0];

    // If accessing via wiki subdomain, rewrite to /published-wiki using the existing path
    if (subdomain === "wiki") {
        const url = request.nextUrl.clone();
        url.pathname = `/published-wiki${url.pathname}`;
        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
