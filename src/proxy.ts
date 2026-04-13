import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
    const hostname = request.headers.get("host") || "";
    const { pathname } = request.nextUrl;

    // Extract subdomain for wiki rewrite
    const subdomain = hostname.split(".")[0];
    if (subdomain === "wiki") {
        const url = request.nextUrl.clone();
        url.pathname = `/published-wiki${pathname}`;
        return NextResponse.rewrite(url);
    }

    // Public paths that don't require authentication
    const isPublicPath =
        pathname === "/" ||
        pathname.startsWith("/published-wiki") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/uploads") ||
        pathname === "/favicon.ico" ||
        pathname === "/sitemap.xml" ||
        pathname === "/robots.txt";

    const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");

    if (isPublicPath) {
        return NextResponse.next();
    }

    // Check auth session
    const session = await auth();
    const isAuthenticated = !!session?.user;

    // Redirect authenticated users away from auth pages
    if (isAuthPage && isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
    }

    // Allow auth pages for unauthenticated users
    if (isAuthPage) {
        return NextResponse.next();
    }

    // Redirect unauthenticated users to login
    if (!isAuthenticated) {
        const loginUrl = new URL("/login", request.nextUrl);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
