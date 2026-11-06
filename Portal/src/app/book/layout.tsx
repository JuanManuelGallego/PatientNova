import { Newsreader } from "next/font/google";
import { PublicFooter } from "@/src/components/PublicBooking/PublicChrome";
import styles from "@/src/components/PublicBooking/PublicChrome.module.css";

/* Only the provider's name uses it, so a person reads differently from the interface. */
const providerFont = Newsreader({
    subsets: [ "latin" ],
    weight: "variable",
    axes: [ "opsz" ],
    style: [ "normal" ],
    display: "swap",
    variable: "--font-provider",
});

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <div data-theme="light" className={`${styles.frame} ${providerFont.variable}`}>
            {children}
            <PublicFooter />
        </div>
    );
}
