import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface LoadingSpinnerProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function LoadingSpinner({
    className,
    ...props
}: LoadingSpinnerProps) {
    return (
        <Loader2
            className={cn("h-4 w-4 animate-spin", className)}
            {...props}
        />
    );
}
