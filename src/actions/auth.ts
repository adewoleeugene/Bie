"use server";

import { db } from "@/lib/db";
import { signUpSchema, SignUpInput } from "@/lib/validators/auth";
import { ActionResult } from "@/types";
import bcrypt from "bcryptjs";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function signUp(input: SignUpInput): Promise<ActionResult> {
    try {
        const validated = signUpSchema.parse(input);

        // Check for existing user
        const existingUser = await db.user.findUnique({
            where: { email: validated.email },
        });

        if (existingUser) {
            return {
                success: false,
                error: "User with this email already exists",
            };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(validated.password, 10);

        // Create user
        const user = await db.user.create({
            data: {
                name: validated.name,
                email: validated.email,
                password: hashedPassword,
            },
        });

        // Add to default organization (since events only fire for adapter-created users)
        const defaultOrg = await db.organization.findFirst({
            where: { slug: "christex" },
        });

        if (defaultOrg) {
            await db.organizationMember.create({
                data: {
                    userId: user.id,
                    organizationId: defaultOrg.id,
                    role: "MEMBER",
                },
            });
        }

        // Auto sign-in
        try {
            await signIn("credentials", {
                email: validated.email,
                password: validated.password,
                redirect: false,
            });
        } catch (error) {
            if (error instanceof AuthError) {
                return { success: false, error: "Created account but failed to sign in automatically." };
            }
            throw error;
        }

        return { success: true, data: undefined };
    } catch (error) {
        console.error("Signup error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create account",
        };
    }
}
