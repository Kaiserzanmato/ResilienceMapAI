"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { geoOrthographic, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "./AmbientGlobe.css";
import { useWorldAtlas } from "./useWorldAtlas";

const SIZE = 640;
// Ambient drift, not attention-grabbing spin — a full rotation every ~70-100s.
const ROTATE_DEG_PER_MS = 0.005;
const ANIMATION_STATE_KEY = "__ambient_globe_start_time";

// Single source of truth for routes that render their own full-screen map
// (the decorative globe would be redundant/distracting behind them). Add
// new full-screen pages here rather than inlining another pathname check.
const FULL_SCREEN_ROUTES = ["/map", "/weather"];
function isFullScreenRoute(pathname: string | null): boolean {
  return FULL_SCREEN_ROUTES.some((r) => pathname === r || pathname?.startsWith(`${r}/`));
}

// Global animation tracking for seamless cross-tab consistency
class GlobeAnimationState {
  private startTime: number;
  private isPaused = false;
  private pauseTime = 0;

  constructor() {
    // Restore from sessionStorage (survives hard refresh)
    const stored = sessionStorage.getItem(ANIMATION_STATE_KEY);
    this.startTime = stored ? parseInt(stored, 10) : Date.now();
    sessionStorage.setItem(ANIMATION_STATE_KEY, this.startTime.toString());
  }

  getElapsedMs(): number {
    if (this.isPaused) {
      return this.pauseTime;
    }
    return Date.now() - this.startTime;
  }

  pause(): void {
    if (!this.isPaused) {
      this.pauseTime = this.getElapsedMs();
      this.isPaused = true;
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      // Adjust startTime to account for paused duration
      this.startTime = Date.now() - this.pauseTime;
      sessionStorage.setItem(ANIMATION_STATE_KEY, this.startTime.toString());
    }
  }
}

// Single global instance
let globalAnimationState: GlobeAnimationState | null = null;

function getAnimationState(): GlobeAnimationState {
  if (!globalAnimationState) {
    globalAnimationState = new GlobeAnimationState();
  }
  return globalAnimationState;
}

export default function AmbientGlobe() {
  const pathname = usePathname();
  const { countries } = useWorldAtlas();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // The component stays mounted in the root layout. Re-run this effect on
    // route transitions so its cleanup cancels animation while a full-screen
    // map or weather route hides the globe, then initializes it again when a
    // normal route becomes visible.
    if (isFullScreenRoute(pathname) || !countries || !svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = geoOrthographic()
      .scale(SIZE * 0.42)
      .translate([SIZE / 2, SIZE / 2])
      .clipAngle(90);

    const path = geoPath(projection);

    svg
      .append("circle")
      .attr("class", "ambient-globe__sphere")
      .attr("cx", SIZE / 2)
      .attr("cy", SIZE / 2)
      .attr("r", SIZE * 0.42);

    const countryGroup = svg
      .append("g")
      .attr("class", "ambient-globe__countries")
      .selectAll("path")
      .data(countries.features)
      .enter()
      .append("path");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = (rotate: [number, number, number]) => {
      projection.rotate(rotate);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      countryGroup.attr("d", path as any);
    };

    if (reduceMotion) {
      render([-20, -12, 0]);
      return;
    }

    // Use global animation state for consistency across tab switches
    const animationState = getAnimationState();

    // Animate using requestAnimationFrame for smooth 60fps rendering
    const animate = () => {
      const elapsed = animationState.getElapsedMs();
      const rotation = elapsed * ROTATE_DEG_PER_MS;
      render([rotation, -12, 0]);
      rafRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Handle tab visibility changes with smooth pause/resume
    const handleVisibility = () => {
      if (document.hidden) {
        animationState.pause();
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        animationState.resume();
        animate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [countries, pathname]);

  if (isFullScreenRoute(pathname)) return null;

  return (
    <div className="ambient-globe" aria-hidden="true">
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="ambient-globe__svg"
      />
    </div>
  );
}
