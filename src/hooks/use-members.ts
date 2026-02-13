"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrganizationMembers } from "@/actions/members";

export function useMembers() {
    return useQuery({
        queryKey: ["members"],
        queryFn: getOrganizationMembers,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
