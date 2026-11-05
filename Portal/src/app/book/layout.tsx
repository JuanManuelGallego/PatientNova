import { PublicFooter } from "@/src/components/PublicBooking/PublicChrome";
import styles from "@/src/components/PublicBooking/PublicChrome.module.css";

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <div data-theme="light" className={styles.frame}>
            {children}
            <PublicFooter />
        </div>
    );
}
