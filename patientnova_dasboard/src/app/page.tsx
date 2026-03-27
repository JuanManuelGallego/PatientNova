"use client";

export default function LandingPage() {


  return (
    <div className="page-shell">
      <main className="page-main">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Patient Nova</h1>
            <p className="page-subtitle">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
