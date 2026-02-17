"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, User, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

import { parseTaskInput } from "@/lib/ai/nlp";
import { useCreateTask } from "@/hooks/use-tasks";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    metadata?: {
        taskId?: string;
        taskTitle?: string;
    };
}

export function AssistantChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hi! I'm ChristAI, your project assistant. How can I help you today?",
            timestamp: new Date(),
        },
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    const createTask = useCreateTask();

    // Scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        const lowerInput = userMsg.content.toLowerCase();

        // Check for task creation intent
        if (lowerInput.startsWith("create task") || lowerInput.startsWith("add task") || lowerInput.startsWith("/task")) {
            const taskText = userMsg.content.replace(/^(create task|add task|\/task)/i, "").trim();

            if (!taskText) {
                setMessages((prev) => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: "Please provide task details, e.g., 'Create task Review designs tomorrow P1'",
                    timestamp: new Date(),
                }]);
                setIsTyping(false);
                return;
            }

            try {
                const parsed = parseTaskInput(taskText);
                const result = await createTask.mutateAsync({
                    title: parsed.title,
                    status: parsed.status,
                    priority: parsed.priority,
                    dueDate: parsed.dueDate ? parsed.dueDate.toISOString() : undefined,
                    assigneeIds: [],
                    labels: []
                });

                if (result.success) {
                    setMessages((prev) => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: `I've created the task "${parsed.title}" for you!`,
                        timestamp: new Date(),
                        metadata: { taskTitle: parsed.title }
                    }]);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                setMessages((prev) => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: "Sorry, I encountered an error creating your task.",
                    timestamp: new Date(),
                }]);
            } finally {
                setIsTyping(false);
            }
            return;
        }

        // Default mock response (fallback)
        setTimeout(() => {
            let responseText = "I'm still learning, but I can help you manage your tasks.";

            if (lowerInput.includes("analytics") || lowerInput.includes("report")) {
                responseText = "You can view detailed project metrics in the Analytics dashboard.";
            } else if (lowerInput.includes("sprint")) {
                responseText = "Check the Sprint Board to see active sprint progress.";
            } else if (lowerInput.includes("hello") || lowerInput.includes("hi")) {
                responseText = "Hello! Ready to get some work done? Try asking me to 'Create task ...'";
            }

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: responseText,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, botMsg]);
            setIsTyping(false);
        }, 1000);
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg p-0 hover:scale-105 transition-transform z-50 bg-primary/90 hover:bg-primary"
            >
                <Bot className="h-7 w-7" />
            </Button>
        );
    }

    return (
        <Card className="fixed bottom-6 right-6 w-[350px] md:w-[400px] h-[500px] shadow-2xl z-50 flex flex-col border-primary/20 animate-in slide-in-from-bottom-10 fade-in duration-200">
            <CardHeader className="p-3 border-b flex flex-row items-center justify-between bg-primary/5 dark:bg-primary/10 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/20 rounded-lg">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold">ChristAI Assistant</CardTitle>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Online
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative">
                <div className="absolute inset-0 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full items-start gap-2",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === "assistant" && (
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1 shrink-0">
                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-muted text-muted-foreground rounded-tl-sm"
                                )}
                            >
                                {msg.content}
                            </div>
                            {msg.role === "user" && (
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-1 shrink-0">
                                    <User className="h-3.5 w-3.5 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex w-full items-start gap-2 justify-start">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1 shrink-0">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>

            <CardFooter className="p-3 border-t bg-background">
                <form onSubmit={handleSend} className="flex w-full items-center gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me anything..."
                        className="flex-1 rounded-full h-10 px-4 focus-visible:ring-primary/20"
                        disabled={isTyping}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="h-10 w-10 rounded-full shrink-0"
                        disabled={!input.trim() || isTyping}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}
