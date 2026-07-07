import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { acceptPendingInvitesForUser, ensurePersonalWorkspace } from "@/lib/workspaces";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
    trustHost: true,
    adapter: PrismaAdapter(db),
    session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await db.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user) {
                    return null;
                }

                if (!user.password) {
                    // User exists but has no password (likely signed up with Google)
                    throw new Error("GOOGLE_ACCOUNT_EXISTS");
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isPasswordValid) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            if (!user.id) return true;
            const signedInUser = {
                id: user.id,
                name: user.name,
                email: user.email,
            };

            await db.$transaction(async (tx) => {
                await ensurePersonalWorkspace(tx, signedInUser);
                await acceptPendingInvitesForUser(tx, signedInUser);
            });

            return true;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },
    events: {
        async createUser({ user }) {
            if (!user.id) return;
            const createdUser = {
                id: user.id,
                name: user.name,
                email: user.email,
            };

            await db.$transaction(async (tx) => {
                await ensurePersonalWorkspace(tx, createdUser);
                await acceptPendingInvitesForUser(tx, createdUser);
            });
        },
    },
    pages: {
        signIn: "/login",
    },
});
