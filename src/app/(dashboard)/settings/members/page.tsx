"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberManagement } from "@/components/settings/member-management";

export default function MembersPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="space-y-3">
                <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
                    <Link href="/settings">
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Back to settings
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">Members</h1>
            </div>

            <MemberManagement />
        </div>
    );
}
