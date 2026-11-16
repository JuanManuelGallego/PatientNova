import { MarketingFrame } from "@/src/components/Landing/MarketingChrome";

/** Product pages are light only; see `MarketingFrame`. The landing page wraps itself the same way. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return <MarketingFrame>{children}</MarketingFrame>;
}
