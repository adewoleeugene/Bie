"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTeamProductivity } from "@/hooks/use-analytics";

interface TeamProductivityProps {
    data: Array<{
        userId: string;
        userName: string;
        userImage: string | null;
        tasksCompleted: number;
        tasksAssigned: number;
        focusTime: number; // in minutes
        loggedTime: number; // in minutes
    }>;
}

export function TeamProductivity({ data }: TeamProductivityProps) {
    // Format duration function
    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Team Productivity</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Member</TableHead>
                            <TableHead className="text-right">Tasks Done</TableHead>
                            <TableHead className="text-right">Assigned</TableHead>
                            <TableHead className="text-right">Completion Rate</TableHead>
                            <TableHead className="text-right">Hours Logged</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((member) => {
                            const totalTasks = member.tasksCompleted + member.tasksAssigned;
                            const completionRate = totalTasks > 0
                                ? Math.round((member.tasksCompleted / totalTasks) * 100)
                                : 0;

                            return (
                                <TableRow key={member.userId}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.userImage || undefined} alt={member.userName} />
                                                <AvatarFallback>{member.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="truncate max-w-[150px]">{member.userName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                                        {member.tasksCompleted}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {member.tasksAssigned}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-sm w-8">{completionRate}%</span>
                                            <Progress value={completionRate} className="w-16 h-2" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        {formatDuration(member.loggedTime)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
