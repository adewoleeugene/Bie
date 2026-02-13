"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, SignUpInput } from "@/lib/validators/auth";
import { signUp } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SignupForm() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const form = useForm<SignUpInput>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    async function onSubmit(data: SignUpInput) {
        setIsLoading(true);
        try {
            const result = await signUp(data);
            if (result.success) {
                toast.success("Account created successfully!");
                router.push("/dashboard");
                router.refresh();
            } else {
                toast.error(result.error);
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
                    Full Name
                </label>
                <Input
                    {...form.register("name")}
                    placeholder="John Doe"
                    disabled={isLoading}
                />
                {form.formState.errors.name && (
                    <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                )}
            </div>

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

            <div className="space-y-1">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Confirm Password
                </label>
                <Input
                    {...form.register("confirmPassword")}
                    type="password"
                    placeholder="••••••••"
                    disabled={isLoading}
                />
                {form.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-500">{form.formState.errors.confirmPassword.message}</p>
                )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
            </Button>
        </form>
    );
}
