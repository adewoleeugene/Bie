"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/validators/auth";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoginForm() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    const form = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    // Display error from URL if present
    if (error === "CredentialsSignin") {
        // This is a generic NextAuth error for credentials failure
        // We can't easily distinguish between "wrong password" and "no user" here 
        // unless we use a custom logic or redirect-less signIn.
    }

    async function onSubmit(data: LoginInput) {
        setIsLoading(true);
        try {
            const result = await signIn("credentials", {
                email: data.email,
                password: data.password,
                redirect: false,
            });

            if (result?.error) {
                if (result.error === "GOOGLE_ACCOUNT_EXISTS" || result.error.includes("GOOGLE_ACCOUNT_EXISTS")) {
                    toast.error("This account uses Google sign-in. Please click the button below.");
                } else {
                    toast.error("Invalid email or password");
                }
            } else {
                toast.success("Logged in successfully!");
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error) {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Email Address
                </label>
                <Input
                    {...form.register("email")}
                    type="email"
                    placeholder="john@example.com"
                    disabled={isLoading}
                />
                {form.formState.errors.email && (
                    <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Password
                </label>
                <Input
                    {...form.register("password")}
                    type="password"
                    placeholder="••••••••"
                    disabled={isLoading}
                />
                {form.formState.errors.password && (
                    <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
                )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In with Email
            </Button>
        </form>
    );
}
