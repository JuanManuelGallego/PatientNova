import Image from "next/image";
import type { Screenshot } from "./screenshots";

export function ProductShot({ shot }: { shot: Screenshot }) {
    return (
        <figure className={shot.bare ? "product-shot product-shot--bare" : "product-shot"}>
            <div className="product-shot__frame">
                {!shot.bare && (
                    <div className="product-shot__bar" aria-hidden="true">
                        <span /><span /><span />
                    </div>
                )}
                <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={shot.width}
                    height={shot.height}
                    sizes={shot.bare ? "(min-width: 800px) 720px, 100vw" : "(min-width: 1120px) 1056px, 100vw"}
                    className="product-shot__img"
                />
            </div>
            {shot.caption && <figcaption className="product-shot__caption">{shot.caption}</figcaption>}
        </figure>
    );
}
