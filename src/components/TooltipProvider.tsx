"use client";
import { useEffect, useState } from "react";

type TooltipState = { text: string; x: number; y: number } | null;

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  useEffect(() => {
    function findTooltipTarget(el: HTMLElement | null): HTMLElement | null {
      while (el) {
        if (el.hasAttribute("data-tooltip")) return el;
        el = el.parentElement;
      }
      return null;
    }

    function onMouseOver(e: MouseEvent) {
      const target = findTooltipTarget(e.target as HTMLElement);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTooltip({
          text: target.getAttribute("data-tooltip") ?? "",
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      } else {
        setTooltip(null);
      }
    }

    function onMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as HTMLElement | null;
      const target = findTooltipTarget(e.target as HTMLElement);
      if (target && !target.contains(related)) {
        setTooltip(null);
      }
    }

    function onScroll() {
      setTooltip(null);
    }

    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  if (!tooltip || !tooltip.text) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: tooltip.x,
        top: tooltip.y - 8,
        transform: "translate(-50%, -100%)",
        background: "#1a1a1a",
        color: "#ccc",
        border: "1px solid #3a3a3a",
        borderRadius: 5,
        padding: "3px 8px",
        fontSize: 10,
        fontFamily: "var(--font-geist-mono, monospace)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 99999,
        letterSpacing: "0.04em",
      }}
    >
      {tooltip.text}
    </div>
  );
}
