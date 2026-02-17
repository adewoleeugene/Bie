import { Suspense } from "react";
import { getAutomationRules } from "@/actions/automation";
import { CreateRuleDialog } from "@/components/automation/create-rule-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAutomationRule } from "@/actions/automation"; // Import delete action

export const dynamic = "force-dynamic";

export default async function AutomationPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const { data: rules } = await getAutomationRules(projectId);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Automation Rules</h2>
                    <p className="text-muted-foreground">
                        Automate tasks based on triggers and actions.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <CreateRuleDialog projectId={projectId} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rules?.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg border-dashed">
                        <Zap className="h-12 w-12 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium">No automation rules yet</h3>
                        <p className="max-w-sm mt-2 mb-6">Create your first rule to automate repetitive tasks.</p>
                        <CreateRuleDialog projectId={projectId} />
                    </div>
                ) : (
                    rules?.map((rule: any) => (
                        <Card key={rule.id} className="relative group overflow-hidden border-l-4 border-l-primary/50 hover:border-l-primary transition-all">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold flex items-center justify-between gap-2">
                                    <span className="truncate">{rule.name}</span>
                                    {/* Delete Button (Client Component needed really, but can use server action via form for simplicity if verified) */}
                                    {/* Actually, form action is easy here. */}
                                    <form action={async () => {
                                        "use server";
                                        await deleteAutomationRule(rule.id, projectId);
                                    }}>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </form>
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Created by {rule.creator.name}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-sm mt-2 p-3 bg-muted/50 rounded-lg">
                                    <div className="font-medium text-blue-600 dark:text-blue-400">
                                        If {rule.triggerType === "STATUS_CHANGE" ? "Status" : "Priority"} is {rule.triggerValue}
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    <div className="font-medium text-green-600 dark:text-green-400">
                                        {rule.actionType === "ADD_COMMENT" ? "Comment" : "Archive"}
                                    </div>
                                </div>
                                {rule.actionType === "ADD_COMMENT" && (
                                    <p className="mt-3 text-sm text-muted-foreground italic truncate">
                                        "{rule.actionValue}"
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
