import Link from "next/link";
import { MARKETING_PAGES } from "@/src/config/site";
import { MarketingCta, MarketingFooter, MarketingLoginLink, MarketingNav, MarketingNavActions } from "./MarketingChrome";

export interface FeatureSection {
    title: string;
    paragraphs?: string[];
    bullets?: string[];
}

/**
 * One product page: a hero with the page's single <h1>, sections with <h2>s, links to the other
 * product pages and the contact banner. Server-rendered: the text is in the HTML crawlers read.
 */
export function FeaturePage({ path, badge, title, intro, sections }: {
    path: string;
    badge: string;
    title: string;
    intro: string;
    sections: FeatureSection[];
}) {
    const others = MARKETING_PAGES.filter((p) => p.path !== path);
    return (
        <>
            <MarketingNav current={path} action={<MarketingNavActions login={<MarketingLoginLink />} />} />
            <main>
                <section className="landing-hero">
                    <div className="landing-container">
                        <div className="landing-hero__badge">{badge}</div>
                        <h1 className="landing-hero__title">{title}</h1>
                        <p className="landing-hero__subtitle">{intro}</p>
                    </div>
                </section>
                <section className="landing-section">
                    <div className="landing-container marketing-prose">
                        {sections.map((s) => (
                            <section key={s.title} className="marketing-prose__section">
                                <h2>{s.title}</h2>
                                {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
                                {s.bullets && (
                                    <ul>
                                        {s.bullets.map((b) => <li key={b}>{b}</li>)}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </div>
                </section>
                <section className="landing-section landing-section--white">
                    <div className="landing-container marketing-prose">
                        <h2>También en Patient Nova</h2>
                        <ul className="marketing-related">
                            {others.map((p) => (
                                <li key={p.path}><Link href={p.path}>{p.label}</Link></li>
                            ))}
                        </ul>
                    </div>
                </section>
                <MarketingCta />
            </main>
            <MarketingFooter />
        </>
    );
}
