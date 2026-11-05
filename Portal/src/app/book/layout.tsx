import { PublicFooter, PublicHeader } from "@/src/components/PublicBooking/PublicChrome";
import styles from "@/src/components/PublicBooking/PublicChrome.module.css";

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={styles.frame}>
            <PublicHeader />
            {children}
            <PublicFooter />
        </div>
    );
}
