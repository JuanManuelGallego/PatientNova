import type { Testimonial } from "@/src/config/testimonials";

export function Testimonials({ items }: { items: readonly Testimonial[] }) {
    if (items.length === 0) return null;
    return (
        <section className="landing-section landing-section--white" aria-labelledby="testimonials-title">
            <div className="landing-container">
                <div className="landing-section-header">
                    <h2 id="testimonials-title" className="landing-section-title">
                        Lo que dicen quienes ya lo usan
                    </h2>
                </div>
                <div className="landing-testimonials" data-count={Math.min(items.length, 3)}>
                    {items.map((t) => (
                        <figure key={t.name} className="landing-testimonial">
                            <blockquote className="landing-testimonial__quote">
                                <p>{t.quote}</p>
                            </blockquote>
                            <figcaption className="landing-testimonial__author">
                                <span className="landing-testimonial__avatar" aria-hidden="true">
                                    {initials(t.name)}
                                </span>
                                <span>
                                    <span className="landing-testimonial__name">{t.name}</span>
                                    <span className="landing-testimonial__role">{t.role}</span>
                                </span>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </div>
        </section>
    );
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((w) => w && !w.endsWith("."))
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
}
