import { Newsreader } from "next/font/google";
import { PublicFooter } from "@/src/components/PublicBooking/PublicChrome";
import styles from "@/src/components/PublicBooking/PublicChrome.module.css";

const displayFont = Newsreader({
    subsets: [ "latin" ],
    weight: [ "400", "500", "600" ],
    variable: "--font-display",
    display: "swap",
});

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={`${styles.frame} ${displayFont.variable}`}>
            {children}
            <PublicFooter />
        </div>
    );
}
