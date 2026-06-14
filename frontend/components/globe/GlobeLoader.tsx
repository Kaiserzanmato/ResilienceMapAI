"use client";
import { useEffect, useRef } from "react";
import { geoOrthographic, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { timer } from "d3-timer";
import "./GlobeLoader.css";
import { useWorldAtlas } from "./useWorldAtlas";

export default function GlobeLoader() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { countries, error } = useWorldAtlas();

  useEffect(() => {
    if (!countries || !svgRef.current) return;

    const width = 200;
    const height = 200;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = geoOrthographic()
      .scale(82)
      .translate([width / 2, height / 2])
      .clipAngle(90);

    const path = geoPath(projection);

    svg
      .append("circle")
      .attr("class", "globe-loader__sphere")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", 82);

    const countryGroup = svg
      .append("g")
      .attr("class", "globe-loader__countries")
      .selectAll("path")
      .data(countries.features)
      .enter()
      .append("path");

    const spin = timer((elapsed) => {
      const rotate = [elapsed * 0.018, -12, 0] as [number, number, number];
      projection.rotate(rotate);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      countryGroup.attr("d", path as any);
    });

    return () => spin.stop();
  }, [countries]);

  if (error) {
    return (
      <div className="globe-loader-page" aria-label="Loading">
        <div className="globe-loader-fallback" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="globe-loader-page" aria-label="Loading">
      <div className="globe-loader-wrap" aria-hidden="true">
        <div className="globe-loader-whirl globe-loader-whirl--one" />
        <div className="globe-loader-whirl globe-loader-whirl--two" />
        <svg
          ref={svgRef}
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="globe-loader-svg"
        />
      </div>
    </div>
  );
}
