"use client";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

interface SpatialRippleEffectProps {
  map: maplibregl.Map | null;
  lat: number;
  lng: number;
  severity: "low" | "medium" | "high";
}

export function SpatialRippleEffect({ map, lat, lng, severity }: SpatialRippleEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rippleInstanceRef = useRef<Array<{ element: HTMLDivElement; removeTime: number }>>([]);

  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.querySelector(".maplibregl-canvas") as HTMLCanvasElement | null;
    }
  }, []);

  useEffect(() => {
    if (!map || lat == null || lng == null || !canvasRef.current) return;

    const createRipple = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const point = map.project([lng, lat]);

      const ripple = document.createElement("div");
      ripple.className = "spatial-ripple-pulse";

      const severityStyles = {
        low: "border-green-500/60 shadow-green-500/40",
        medium: "border-amber-500/60 shadow-amber-500/40",
        high: "border-red-500/60 shadow-red-500/40",
      };

      ripple.style.cssText = `
        position: fixed;
        left: ${rect.left + point.x}px;
        top: ${rect.top + point.y}px;
        width: 2px;
        height: 2px;
        border: 2px solid;
        border-radius: 50%;
        pointer-events: none;
        z-index: 35;
        transform: translate(-50%, -50%);
      `;

      ripple.className = `spatial-ripple-pulse ${severityStyles[severity]}`;

      canvas.parentElement?.appendChild(ripple);

      const removeTime = Date.now() + 1600;
      rippleInstanceRef.current.push({ element: ripple, removeTime });

      setTimeout(() => {
        ripple.remove();
        rippleInstanceRef.current = rippleInstanceRef.current.filter((r) => r.element !== ripple);
      }, 1600);
    };

    createRipple();
    // Emit additional ripples for high severity
    if (severity === "high") {
      const id1 = setTimeout(createRipple, 200);
      const id2 = setTimeout(createRipple, 400);
      return () => {
        clearTimeout(id1);
        clearTimeout(id2);
      };
    }
  }, [map, lat, lng, severity]);

  return (
    <div ref={containerRef} style={{ display: "none" }}>
      <style jsx global>{`
        @keyframes ripple-expand {
          0% {
            width: 2px;
            height: 2px;
            opacity: 1;
            box-shadow: 0 0 0px currentColor;
          }
          50% {
            box-shadow: 0 0 12px currentColor;
          }
          100% {
            width: 120px;
            height: 120px;
            opacity: 0;
            box-shadow: 0 0 0px transparent;
          }
        }

        .spatial-ripple-pulse {
          animation: ripple-expand 1.6s cubic-bezier(0.4, 0, 0.6, 1) forwards !important;
        }

        .spatial-ripple-pulse.border-green-500 {
          border-color: rgb(34, 197, 94);
          box-shadow: 0 0 0px rgba(34, 197, 94, 0.4);
        }

        .spatial-ripple-pulse.border-amber-500 {
          border-color: rgb(217, 119, 6);
          box-shadow: 0 0 0px rgba(217, 119, 6, 0.4);
        }

        .spatial-ripple-pulse.border-red-500 {
          border-color: rgb(239, 68, 68);
          box-shadow: 0 0 0px rgba(239, 68, 68, 0.4);
        }
      `}</style>
    </div>
  );
}
