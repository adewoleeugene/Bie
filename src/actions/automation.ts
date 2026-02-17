"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type TriggerType = "STATUS_CHANGE" | "PRIORITY_CHANGE" | "TASK_CREATED";
export type ActionType = "ADD_COMMENT" | "ASSIGN_USER" | "ARCHIVE_TASK";

export interface CreateRuleInput {
    name: string;
    projectId: string; // Required for project rules
    triggerType: TriggerType;
    triggerValue: string;
    actionType: ActionType;
    actionValue: string;
}

export async function createAutomationRule(input: CreateRuleInput) {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
    });

    if (!user) {
        return { success: false, error: "User not found" };
    }

    try {
        const rule = await db.automationRule.create({
            data: {
                name: input.name,
                triggerType: input.triggerType,
                triggerValue: input.triggerValue,
                actionType: input.actionType,
                actionValue: input.actionValue,
                projectId: input.projectId,
                creatorId: user.id,
            },
        });

        revalidatePath(`/projects/${input.projectId}`);
        return { success: true, data: rule };
    } catch (error) {
        console.error("Failed to create automation rule:", error);
        return { success: false, error: "Failed to create rule" };
    }
}

export async function getAutomationRules(projectId: string) {
    const session = await auth();
    if (!session?.user?.email) return { success: false, error: "Unauthorized" };

    try {
        const rules = await db.automationRule.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            include: {
                creator: {
                    select: { name: true, image: true }
                }
            }
        });

        return { success: true, data: rules };
    } catch (error) {
        console.error("Failed to fetch rules:", error);
        return { success: false, error: "Failed to fetch rules" };
    }
}

export async function deleteAutomationRule(ruleId: string, projectId: string) {
    const session = await auth();
    if (!session?.user?.email) return { success: false, error: "Unauthorized" };

    try {
        await db.automationRule.delete({
            where: { id: ruleId }
        });

        revalidatePath(`/projects/${projectId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete rule:", error);
        return { success: false, error: "Failed to delete rule" };
    }
}

// Logic to execute rules
// This should be called from task actions (create/update)
export async function processAutomationRules(
    taskId: string,
    projectId: string,
    triggerType: TriggerType,
    triggerValue: string,
    actorId: string // User who triggered the action
) {
    try {
        console.log(`Processing rules for task ${taskId}: ${triggerType} -> ${triggerValue}`);

        // Find matching active rules
        const rules = await db.automationRule.findMany({
            where: {
                projectId,
                isActive: true,
                triggerType,
                triggerValue
            }
        });

        if (rules.length === 0) return;

        console.log(`Found ${rules.length} matching rules`);

        for (const rule of rules) {
            await executeRuleAction(taskId, rule.actionType, rule.actionValue, actorId);
        }

    } catch (error) {
        console.error("Rule processing failed:", error);
        // Don't throw, automation failure shouldn't block main action
    }
}

async function executeRuleAction(taskId: string, actionType: string, actionValue: string, actorId: string) {
    try {
        if (actionType === "ADD_COMMENT") {
            await db.comment.create({
                data: {
                    body: `🤖 Automation: ${actionValue}`,
                    taskId: taskId,
                    authorId: actorId,
                }
            });

        } else if (actionType === "ASSIGN_USER") {
            // Assign task to user
            await db.taskAssignee.create({
                data: {
                    taskId,
                    userId: actionValue
                }
            }).catch(() => { }); // Ignore if already assigned
        } else if (actionType === "ARCHIVE_TASK") {
            await db.task.update({
                where: { id: taskId },
                data: { status: "ARCHIVED" }
            });
        }
    } catch (error) {
        console.error(`Action ${actionType} failed:`, error);
    }
}
