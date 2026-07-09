"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("ErrorBoundary caught:", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div style={{ padding: 32, textAlign: "center" }}>
                    <h2 style={{ marginBottom: 8 }}>Algo salió mal</h2>
                    <p style={{ color: "var(--c-text-muted)", marginBottom: 16 }}>
                        {this.state.error?.message ?? "Error inesperado"}
                    </p>
                    <button
                        className="btn-primary"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        Reintentar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
