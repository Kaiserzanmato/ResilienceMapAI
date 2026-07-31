"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { geoOrthographic, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { timer, type Timer } from "d3-timer";
import "./AmbientGlobe.css";
import { useWorldAtlas } from "./useWorldAtlas";

const SIZE = 640;
// Ambient drift, not attention-grabbing spin — a full rotation every ~70-100s.
const ROTATE_DEG_PER_MS = 0.005;

export default function AmbientGlobe() {
  const pathname = usePathname();
  const { countries } = useWorldAtlas();
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!countries || !svgRef.current) return;

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

    let spin: Timer | null = timer((elapsed) => render([elapsed * ROTATE_DEG_PER_MS, -12, 0]));

    const handleVisibility = () => {
      if (document.hidden) {
        spin?.stop();
        spin = null;
      } else if (!spin) {
        const restartedAt = Date.now();
        spin = timer((elapsed) => render([(restartedAt + elapsed) * ROTATE_DEG_PER_MS, -12, 0]));
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      spin?.stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [countries]);

  const isMapRoute = pathname === "/map" || pathname?.startsWith("/map/");
  if (isMapRoute) return null;

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
