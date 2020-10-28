import * as React from 'react';
import * as d3 from 'd3';

import { DEFAULT_POINT_COLOR, DEFAULT_POINT_RADIUS } from './RendererDefaultParameters';
import { DEFAULT_TERNARY_DIM0, DEFAULT_TERNARY_DIM1, DEFAULT_TERNARY_DIM2 } from '../Data/EelBridge';

import './TernaryPlotRenderer.css';

interface Props {
  width: number,
  height: number,
  data: any[],
  nonSteeringData: any[],
  chunkSize: number,
  dimensions: string[]
}
interface State {
  size: number,
  yOffset: number
}

function line(positions: number[][]) {
  const [[x1, y1], [x2, y2]] = positions;

  return function(t: number) {
    return [
      x1 + t * (x2 - x1),
      y1 + t * (y2 - y1)
    ]
  }
}

export default class TernaryPlotRenderer extends React.Component<Props, State> {
  private A: number[];
  private B: number[];
  private C: number[];

  private a: (t: number) => number[];
  private b: (t: number) => number[];
  private c: (t: number) => number[];

  private lastChunk: any[] = [];

  constructor(props: Props) {
    super(props);

    const size = Math.min(this.props.width, this.props.height) / 2;
    const yOffset = (size - Math.sin(30 * Math.PI / 180) * size) / 2;

    const [A, B, C] = [150, 30, -90].map(d => [
      Math.cos(d * Math.PI / 180) * size,
      Math.sin(d * Math.PI / 180) * size + yOffset
    ]);

    this.A = A;
    this.B = B;
    this.C = C;

    this.a = line([B, C]);
    this.b = line([C, A]);
    this.c = line([A, B]);

    this.state = {
      size,
      yOffset
    };
  }

  private getLatestChunk(useNonSteeringData: boolean = false) {
    let itemCount = this.props.data.length;

    if (useNonSteeringData) {
      itemCount = this.props.nonSteeringData.length;
      return this.props.nonSteeringData.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
    }

    // if chunksize property is not defined, return the full dataset
    return this.props.data.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
  }

  private receivedNewData() {
    const chunk = this.getLatestChunk()

    if (chunk[0] !== undefined && chunk[0] === this.lastChunk[0]) {
      return false;
    }

    return true;
  }

  private renderGrid(chart: d3.Selection<SVGGElement, any, HTMLElement, any>) {
    const grid = d3.range(0, 1, 0.1);

    chart.append("g")
      .selectAll(".grid")
      .data([
        grid.map(tick => [this.a(tick),this. b(1 - tick)]),
        grid.map(tick => [this.b(tick), this.c(1 - tick)]),
        grid.map(tick => [this.c(tick), this.a(1 - tick)])
      ])
      .enter().append("g")
        .selectAll(".gridlines")
        .data(d => d)
        .enter().append("line")
          .attr("x1", d => d[0][0])
          .attr("y1", d => d[0][1])
          .attr("x2", d => d[1][0])
          .attr("y2", d => d[1][1])
          .attr("stroke", "#fff")
          .attr("stroke-width", (d, i) => i & 1 ? 1 : 2);
  }

  private renderTicks(chart: d3.Selection<SVGGElement, any, HTMLElement, any>) {
    const ticks = d3.range(0, 100, 20).concat(100);

    chart.append("g")
      .attr("font-size", 10)
      .selectAll(".axis")
      .data([
        ticks.map(tick => ({ tick, pos: this.a(tick / 100), rot: 0, anchor: "start"})),
        ticks.map(tick => ({ tick, pos: this.b(tick / 100), rot: 60, anchor: "end"})),
        ticks.map(tick => ({ tick, pos: this.c(tick / 100), rot: -60, anchor: "end"}))
      ])
      .enter().append("g")
        .selectAll(".ticks")
        .data(d => d)
        .enter().append("text")
          .attr("transform", d => `translate(${d.pos}) rotate(${d.rot})`)
          .attr("text-anchor", d => d.anchor)
          .attr("dx", d => 10 * (d.anchor === "start" ? 1 : -1))
          .attr("dy", ".3em")
          .text(d => d.tick);
  }

  private renderLabels(chart: d3.Selection<SVGGElement, any, HTMLElement, any>) {
    const labelOffset = 80;

    const [_A, _B, _C] = [150, 30, -90].map(d => [
      Math.cos(d * Math.PI / 180) * (this.state.size + labelOffset),
      Math.sin(d * Math.PI / 180) * (this.state.size + labelOffset) + this.state.yOffset
    ]);

    const _a = line([_B, _C]);
    const _b = line([_C, _A]);
    const _c = line([_A, _B]);

    chart.append("g")
      .attr("font-size", 16)
      .selectAll(".labels")
      .data([
        { label: DEFAULT_TERNARY_DIM0, pos: _a(0.5), rot: 60 },
        { label: DEFAULT_TERNARY_DIM1, pos: _b(0.5), rot: -60 },
        { label: DEFAULT_TERNARY_DIM2, pos: _c(0.5), rot: 0 }
      ])
      .enter().append("text")
        .attr("transform", d => `translate(${d.pos}) rotate(${d.rot})`)
        .attr("text-anchor", "middle")
        .text(d => d.label)
  }

  private updatePoints(chart: d3.Selection<SVGGElement, any, HTMLElement, any>) {
    if (!this.receivedNewData()) {
      return [];
    }

    chart.selectAll(".countries")
      .data(this.props.data.map(d => {
        return {
          pos: [
            this.A[0] * +d[DEFAULT_TERNARY_DIM0] / 100 + this.B[0] * +d[DEFAULT_TERNARY_DIM1] / 100 + this.C[0] * +d[DEFAULT_TERNARY_DIM2] / 100,
            this.A[1] * +d[DEFAULT_TERNARY_DIM0] / 100 + this.B[1] * +d[DEFAULT_TERNARY_DIM1] / 100 + this.C[1] * +d[DEFAULT_TERNARY_DIM2] / 100
          ]
        };
      }
      ))
      .enter().append("circle")
        .attr("r", DEFAULT_POINT_RADIUS)
        .attr("cx", d => d.pos[0])
        .attr("cy", d => d.pos[1])
        .attr("fill", DEFAULT_POINT_COLOR)
        .attr("stroke", DEFAULT_POINT_COLOR);
  }

  // adapted from https://observablehq.com/@toja/d3-ternary-plot
  private renderTernaryPlot() {
    const svg = d3.select("svg.ternaryPlotCanvas");
    svg.selectAll("g").remove();

    const chart = svg.append('g')
      .attr("transform", `translate(${this.props.width / 2} ${this.props.height / 2})`)
      .attr("font-family", "sans-serif");

    // triangle
    chart.append("path")
      .attr("d", `M${this.A}L${this.B}L${this.C}Z`)
      .attr("fill", "#ececec")
      .attr("stroke", "none");

    this.renderGrid(chart);
    this.renderTicks(chart);
    this.renderLabels(chart);
    this.updatePoints(chart);
  }

  public render() {
    window.setTimeout(() => { this.renderTernaryPlot() }, 100);
    return (
      <div className="ternaryPlotRenderer">
        <svg className="ternaryPlotCanvas" width={ this.props.width } height={ this.props.height }></svg>

      </div>
    );
  }
}