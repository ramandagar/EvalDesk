export function MatrixBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(171,200,58,0.06) 0%, transparent 70%)",
      }}
    />
  );
}
