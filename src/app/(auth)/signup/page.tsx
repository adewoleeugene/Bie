import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
    title: "Create Account",
    description: "Create a new Bie account",
};

export default async function SignupPage({
    searchParams,
}: {
    searchParams: Promise<{ callbackUrl?: string }>;
}) {
    const { callbackUrl } = await searchParams;
    const safeCallbackUrl = callbackUrl?.startsWith("/") ? callbackUrl : "";
    const loginHref = safeCallbackUrl
        ? `/login?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`
        : "/login";

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-3xl font-bold">Create Account</CardTitle>
                    <CardDescription>
                        Sign up to get started with Bie
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Suspense fallback={<div className="h-80 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800" />}>
                        <SignupForm />
                    </Suspense>
                    <div className="text-center text-sm">
                        {"Already have an account? "}
                        <Link href={loginHref} className="font-semibold text-primary hover:underline">
                            Login here
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
