import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WhatsAppSettings } from "@/components/settings/whatsapp-settings";

export default async function WhatsAppOnboardingPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Connect WhatsApp</h1>
                <p className="text-sm text-muted-foreground">
                    Add the number Bie should message for notifications and lightweight task updates.
                </p>
            </div>
            <WhatsAppSettings compact />
        </main>
    );
}
