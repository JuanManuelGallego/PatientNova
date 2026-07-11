export function LoadingSpinner() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "3px solid var(--c-gray-200)",
        borderTopColor: "var(--c-brand)",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
