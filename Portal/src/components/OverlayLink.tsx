"use client";

import type { ComponentProps, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCloseTopOverlay } from "@/src/hooks/useFocusTrap";

type OverlayLinkProps = Omit<ComponentProps<typeof Link>, "href" | "replace"> & { href: string };

export function OverlayLink({ href, onClick, ...rest }: OverlayLinkProps) {
  const router = useRouter();
  const closeTop = useCloseTopOverlay();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isPlainClick(event)) return;
    if (new URL(href, window.location.href).href === window.location.href) {
      if (closeTop(false)) event.preventDefault();
      return;
    }
    if (closeTop(true)) {
      event.preventDefault();
      router.replace(href);
    }
  };

  return <Link href={href} onClick={handleClick} {...rest} />;
}

export function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  const link = event.currentTarget;
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
    && (!link.target || link.target === "_self") && !link.hasAttribute("download");
}
