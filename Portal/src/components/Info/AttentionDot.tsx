export function AttentionDot({ testId }: { testId: string }) {
    return (
        <span className="nav-dot" data-testid={testId}>
            <span className="sr-only">, requiere atención</span>
        </span>
    );
}
