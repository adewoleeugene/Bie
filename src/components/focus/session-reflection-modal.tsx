"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpsertReflection } from "@/hooks/use-reflections";

const MOOD_OPTIONS = [
    { value: 1, emoji: "\uD83D\uDE29", label: "Rough" },
    { value: 2, emoji: "\uD83D\uDE15", label: "Meh" },
    { value: 3, emoji: "\uD83D\uDE10", label: "Okay" },
    { value: 4, emoji: "\uD83D\uDE42", label: "Good" },
    { value: 5, emoji: "\uD83D\uDE0A", label: "Great" },
];

interface SessionReflectionModalProps {
    taskTitle: string;
    sessionMinutes: number;
    onDone: () => void;
}

/**
 * Quick 5-second check-in after a deep focus session ends.
 * Saves mood + highlights + improvements into the daily reflection (upsert).
 */
export function SessionReflectionModal({
    taskTitle,
    sessionMinutes,
    onDone,
}: SessionReflectionModalProps) {
    const upsert = useUpsertReflection();
    const [mood, setMood] = useState<number | null>(null);
    const [highlights, setHighlights] = useState("");
    const [improvements, setImprovements] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await upsert.mutateAsync({
            mood,
            highlights: highlights.trim() || null,
            improvements: improvements.trim() || null,
            content: [
                highlights.trim() ? `**Went well:** ${highlights.trim()}` : "",
                improvements.trim() ? `**Improve:** ${improvements.trim()}` : "",
                `*Session: ${taskTitle} (${sessionMinutes}min)*`,
            ]
                .filter(Boolean)
                .join("\n\n"),
        });
        onDone();
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-neutral-950/95">
            <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/[0.06] bg-neutral-900 p-8 shadow-2xl">
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-white">
                        How did that go?
                    </h2>
                    <p className="mt-1 text-sm text-white/40">
                        {taskTitle} &middot; {sessionMinutes} min
                    </p>
                </div>

                {/* Mood picker */}
                <div className="flex items-center justify-center gap-3">
                    {MOOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setMood(opt.value)}
                            className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all ${
                                mood === opt.value
                                    ? "bg-white/[0.1] scale-110"
                                    : "hover:bg-white/[0.05]"
                            }`}
                        >
                            <span className="text-2xl">{opt.emoji}</span>
                            <span className="text-[10px] text-white/40">
                                {opt.label}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Quick inputs */}
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs text-white/40">
                            What went well?
                        </label>
                        <Input
                            value={highlights}
                            onChange={(e) => setHighlights(e.target.value)}
                            placeholder="e.g. Finished the API integration"
                            className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-white/40">
                            What to improve?
                        </label>
                        <Input
                            value={improvements}
                            onChange={(e) => setImprovements(e.target.value)}
                            placeholder="e.g. Too many context switches"
                            className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-white text-black hover:bg-white/90"
                    >
                        {saving ? "Saving..." : "Save & exit"}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onDone}
                        className="text-white/40 hover:text-white/60"
                    >
                        Skip
                    </Button>
                </div>
            </div>
        </div>
    );
}
