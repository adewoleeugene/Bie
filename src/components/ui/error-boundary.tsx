"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Rendered instead of the children when a render error is caught. */
    fallback?: ReactNode;
    /** Optional hook for logging to an error-reporting service. */
    onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Generic client-side error boundary. Catches render/lifecycle errors in its
 * subtree so one broken widget degrades to a fallback instead of taking down
 * the whole page (which surfaces as Next.js's "Application error" white screen).
 */
export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error(error);
        this.props.onError?.(error);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? null;
        }
        return this.props.children;
    }
}
