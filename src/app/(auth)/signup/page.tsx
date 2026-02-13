import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function SignupPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-3xl font-bold">Create Account</CardTitle>
                    <CardDescription>
                        Sign up to get started with ChristBase
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <SignupForm />
                    <div className="text-center text-sm">
                        {"Already have an account? "}
                        <Link href="/login" className="font-semibold text-primary hover:underline">
                            Login here
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
