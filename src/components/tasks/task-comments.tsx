"use client";

import { useState } from "react";
import { useComments, useCreateComment } from "@/hooks/use-comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { SendHorizonal } from "lucide-react";

interface TaskCommentsProps {
    taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
    const { data: comments, isLoading } = useComments(taskId);
    const createComment = useCreateComment();
    const [newComment, setNewComment] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        await createComment.mutateAsync({ taskId, body: newComment });
        setNewComment("");
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase">Comments</h3>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {isLoading ? (
                    <p className="text-sm text-neutral-500">Loading comments...</p>
                ) : comments?.length === 0 ? (
                    <p className="text-sm text-neutral-500 italic">No comments yet.</p>
                ) : (
                    comments?.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                            <Avatar className="h-8 w-8 mt-1">
                                <AvatarImage src={comment.author.image || undefined} />
                                <AvatarFallback className="text-xs">
                                    {comment.author.name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{comment.author.name}</span>
                                    <span className="text-xs text-neutral-500">
                                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap rounded-md bg-neutral-50 p-2 dark:bg-neutral-900">
                                    {comment.body}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <Avatar className="h-8 w-8">
                    {/* Ideally current user avatar here */}
                    <AvatarFallback className="text-xs">ME</AvatarFallback>
                </Avatar>
                <div className="flex-1 relative">
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="min-h-[80px] pr-10 resize-none"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-2 right-2 h-8 w-8 text-neutral-500 hover:text-primary"
                        disabled={!newComment.trim() || createComment.isPending}
                    >
                        <SendHorizonal className="h-4 w-4" />
                    </Button>
                </div>
            </form>
        </div>
    );
}
