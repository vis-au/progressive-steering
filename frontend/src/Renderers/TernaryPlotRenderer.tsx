import * as React from 'react';
import * as d3 from 'd3';

import { DEFAULT_POINT_COLOR, DEFAULT_POINT_RADIUS, NON_STEERING_POINT_COLOR } from './RendererDefaultParameters';
import { DEFAULT_TERNARY_DIM0, DEFAULT_TERNARY_DIM1, DEFAULT_TERNARY_DIM2 } from '../Data/EelBridge';
import { ScaledCartesianCoordinate } from '../PointTypes';

import './TernaryPlotRenderer.css';

interface Props {
  width: number,
  height: number,
  dimensions: string[],
  // extents: Map<string, [number, number]>,
  data: any[],
  nonSteeringData: any[],
  showNonSteeringData: boolean,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  // stepsBeforePaddingGrows: number,
  onBrushedPoints?: (points: any[]) => any,
  // onBrushedRegion: (extent: number[][]) => any,
  onNewPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
  // onNewNonSteeredPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
}
interface State {
  size: number,
  yOffset: number,
  brushedPoints: ScaledCartesianCoordinate[],
  selectedPoint: ScaledCartesianCoordinate | null;
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
  private steeringScreenPositions: ScaledCartesianCoordinate[];
  private nonSteeringScreenPositions: ScaledCartesianCoordinate[];

  private axesSvg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringCanvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private brush: d3.BrushBehavior<any>;
  private selection: any;

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

    this.selection = null;
    this.axesSvg = null;
    this.canvas = null;
    this.nonSteeringCanvas = null;

    this.steeringScreenPositions = [];
    this.nonSteeringScreenPositions = [];

    this.brush = d3.brush()
      .on("start", null)
      .on("brush", null)
      .on("end", this.onBrushEnd.bind(this));

    this.state = {
      size,
      yOffset,
      brushedPoints: [],
      selectedPoint: null
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

  private getCanvasWidth() {
    return this.props.showNonSteeringData
      ? this.props.width / 2 - 1
      : this.props.width;
  }

  private isNodeInBounds(node: ScaledCartesianCoordinate, bounds: number[][]) {
    const canvasWidth = this.getCanvasWidth();

    return (
      node.px + canvasWidth/2 >= bounds[0][0] &&
      node.px + canvasWidth/2 < bounds[1][0] &&
      node.py + this.props.height/2 >= bounds[0][1] &&
      node.py + this.props.height/2 < bounds[1][1]
    );
  }

  private getNewPointsInCurrentSelection(newPoints: ScaledCartesianCoordinate[], useNonSteeringData: boolean = false): any[] {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }

    const pointsInSelection: ScaledCartesianCoordinate[] = [];

    newPoints.forEach(datum => {
      if (this.isNodeInBounds(datum, this.selection)) {
        pointsInSelection.push(datum);
      }
    });

    return pointsInSelection;
  }

  private getPointsInRegion(region: number[][], useNonSteeringData: boolean = false) {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }

    const canvasWidth = this.getCanvasWidth();

    const x0 = region[0][0] - canvasWidth / 2;
    const x3 = region[1][0] - canvasWidth / 2;
    const y0 = region[0][1] - this.props.height / 2;
    const y3 = region[1][1] - this.props.height / 2;

    const data = useNonSteeringData
      ? this.nonSteeringScreenPositions
      : this.steeringScreenPositions;

    const pointsInRegion: ScaledCartesianCoordinate[] = data.filter(d => {
      return d.px >= x0 && d.px <= x3 && d.py >= y0 && d.py <= y3;
    });

    return pointsInRegion;
  }

  private getCurrentlyBrushedPoints(useNonSteeringData: boolean = false) {
    const extent = this.selection;

    if (!extent) {
      return [];
    }

    const currentlyBrushedPoints = this.getPointsInRegion(extent, useNonSteeringData);

    return currentlyBrushedPoints;
  }

  private receivedNewData() {
    const chunk = this.getLatestChunk()

    if (chunk[0] !== undefined && chunk[0] === this.lastChunk[0]) {
      return false;
    }

    return true;
  }

  private onBrushEnd() {
    if (this.canvas === null) {
      return;
    } else if (this.props.onBrushedPoints === undefined) {
      return;
    }

    this.selection = d3.event.selection || null;

    if (this.selection === null) {
      this.setState({
        brushedPoints: []
      });
      return;
    }

    const lastChunkIds = this.getLatestChunk().map(d => d.id);
    const lastChunkPositions = this.steeringScreenPositions
      .filter(d => lastChunkIds.indexOf(d.values.id) > -1);
    const brushedCoordinates = this.getNewPointsInCurrentSelection(lastChunkPositions, false);

    const brushedData = brushedCoordinates.map(d => d.values);
    this.props.onBrushedPoints(brushedData);

    this.setState({
      brushedPoints: brushedCoordinates
    });
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

  private updateNewPointsInCurrentSelection(newPoints: ScaledCartesianCoordinate[]) {
    const newPointsInSelection = this.getNewPointsInCurrentSelection(newPoints).map(d => d.values);
    const allPointsInSelection = this.getCurrentlyBrushedPoints().map(d => d.values);

    // const newNonSteeredPoints = this.getLatestChunk(true);
    // const newNonSteeredPointsInSelection = this.getNewPointsInCurrentSelection(newNonSteeredPoints, true);
    // const allNonSteeredPointsInSelection = this.getCurrentlyBrushedPoints(true);

    if (newPointsInSelection.length > 0 && !!this.props.onNewPointsInSelection) {
      this.props.onNewPointsInSelection(newPointsInSelection, allPointsInSelection);
      // this.props.onNewNonSteeredPointsInSelection(newNonSteeredPointsInSelection, allNonSteeredPointsInSelection);
    }
  }

  private renderData(useNonSteeringData: boolean) {
    if (this.canvas === null) {
      return [];
    } else if (this.nonSteeringCanvas === null) {
      return [];
    } else if (!this.receivedNewData()) {
      return [];
    }

    const latestChunk = this.getLatestChunk(useNonSteeringData);

    const steeringScreenPositions = latestChunk.map(d => {
      const dim0 = d[DEFAULT_TERNARY_DIM0];
      const dim1 = d[DEFAULT_TERNARY_DIM1];
      const dim2 = d[DEFAULT_TERNARY_DIM2];

      const px = this.A[0] * +dim0 / 100 + this.B[0] * +dim1 / 100 + this.C[0] * +dim2 / 100;
      const py = this.A[1] * +dim0 / 100 + this.B[1] * +dim1 / 100 + this.C[1] * +dim2 / 100;

      return {
        px,
        py,
        values: d
      };
    });

    const chart = useNonSteeringData
      ? this.nonSteeringCanvas.select("g.chart")
      : this.canvas.select("g.chart");

    chart.selectAll(".countries")
      .data(steeringScreenPositions)
      .enter().append("circle")
        .attr("r", DEFAULT_POINT_RADIUS)
        .attr("cx", d => d.px)
        .attr("cy", d => d.py)
        .attr("fill", useNonSteeringData ? NON_STEERING_POINT_COLOR : DEFAULT_POINT_COLOR)
        .attr("stroke", useNonSteeringData ? NON_STEERING_POINT_COLOR : DEFAULT_POINT_COLOR);

    return steeringScreenPositions;
  }

  private renderPoints(useNonSteeringData: boolean = false) {
    if (this.canvas === null) {
      return [];
    } else if (this.nonSteeringCanvas === null) {
      return [];
    } else if (!this.receivedNewData()) {
      return [];
    }

    const canvas = useNonSteeringData
      ? this.nonSteeringCanvas
      : this.canvas;

    const chart = canvas.select("g.chart");
    const chunk = this.renderData(chart as any);
    this.steeringScreenPositions.push(...chunk);

    return chunk;
  }

  private renderAxes(useNonSteeringData: boolean = false) {
    if (this.canvas === null) {
      return [];
    } else if (this.nonSteeringCanvas === null) {
      return [];
    }

    const canvas = useNonSteeringData
      ? this.nonSteeringCanvas
      : this.canvas;

    canvas.selectAll("g").remove();

    const canvasWidth = this.getCanvasWidth();

    const chart = canvas.append('g')
      .attr("class", "chart")
      .attr("transform", `translate(${canvasWidth/2} ${this.props.height / 2})`)
      .attr("font-family", "sans-serif");

    // triangle
    chart.append("path")
      .attr("d", `M${this.A}L${this.B}L${this.C}Z`)
      .attr("fill", "#ececec")
      .attr("stroke", "none");

    this.renderGrid(chart);
    this.renderTicks(chart);
    this.renderLabels(chart);
  }

  private renderInsideOutsidePoints(chunk: ScaledCartesianCoordinate[], useNonSteeringData: boolean) {
    // no need to update if the chunk has not changed
    if (!this.receivedNewData()) {
      return;
    }

    const canvas = useNonSteeringData
      ? d3.select("svg.ternaryPlotNonSteeringRecentPointCanvas")
      : d3.select("svg.ternaryPlotRecentPointCanvas");

    canvas.selectAll("circle.recent-point").remove();

    if (!this.props.highlightLastChunk) {
      return;
    }

    const pointsInSelection = this.getNewPointsInCurrentSelection(chunk, false);
    const canvasWidth = this.getCanvasWidth();

    const points = canvas.selectAll("circle.recent-point").data(chunk)
      .join("circle")
        .attr("class", "recent-point")
        .classed("inside-selection", d => pointsInSelection.indexOf(d) > -1)
        .classed("steered", !useNonSteeringData)
        .attr("cx", d => d.px + canvasWidth/2)
        .attr("cy", d => d.py + this.props.height/2)
        .attr("r", DEFAULT_POINT_RADIUS);

    points.transition().duration(250).attr("r", DEFAULT_POINT_RADIUS * 2);
  }

  // adapted from https://observablehq.com/@toja/d3-ternary-plot
  private renderSteeringPoints() {
    const scaledChunk = this.renderPoints(false);
    this.renderInsideOutsidePoints(scaledChunk, false);

    return scaledChunk;
  }

  private renderNonSteeringPoints() {
    const scaledChunk = this.renderPoints(true);
    this.renderInsideOutsidePoints(scaledChunk, true);

    return scaledChunk;
  }

  private updateQuadtrees(steeredChunk: ScaledCartesianCoordinate[], nonSteeredChunk: ScaledCartesianCoordinate[]) {
    if (!this.receivedNewData()) {
      return;
    }

    this.updateNewPointsInCurrentSelection(steeredChunk);
  }

  private updatePoints() {
    const steered = this.renderSteeringPoints();
    const nonSteered = this.renderNonSteeringPoints();

    if (this.props.showNonSteeringData) {
      // nonSteered.push(...this.renderNonSteeringPoints());
    }

    return { steered, nonSteered };
  }

  private renderBrushedRegion(brushedRegion: number[][], index: number) {
    const x = brushedRegion[0][0];
    const y = brushedRegion[0][1];
    const width = Math.abs(brushedRegion[0][0] - brushedRegion[1][0]);
    const height = Math.abs(brushedRegion[0][1] - brushedRegion[1][1]);
    const opacity = 1;

    return (
      <rect
        key={ index }
        className="brushedRegion"
        width={ width }
        height={ height }
        x={ x }
        y={ y }
        strokeOpacity={ opacity }
        fillOpacity={ opacity }
      />
    );
  }

  private renderBrushedRegions() {
    if (this.selection === null) {
      return null;
    }

    return (
      <g className="brushed-regions">
        { this.renderBrushedRegion(this.selection, 0) }
      </g>
    );
  }

  public render() {
    const scaledData = this.updatePoints();
    this.updateQuadtrees(scaledData.steered, scaledData.nonSteered);

    const canvasWidth = this.getCanvasWidth();
    const isNonSteeringCanvasVisible = this.props.showNonSteeringData ? 'visible' : 'hidden';

    this.lastChunk = this.getLatestChunk();

    return (
      <div className="ternaryPlotRenderer">
        <div className="left" style={{ width: canvasWidth }}>
          <svg className="ternaryPlotCanvas" width={ canvasWidth } height={ this.props.height }></svg>
          <svg className="ternaryPlotRecentPointCanvas" width={ canvasWidth } height={ this.props.height }></svg>
          <svg className="ternaryPlotAxesCanvas" width={ canvasWidth } height={ this.props.height }></svg>
        </div>
        <div className={`right ${isNonSteeringCanvasVisible}`} style={ { width: canvasWidth }}>
          <svg className="nonSteeringTernaryPlotCanvas" width={ canvasWidth } height={ this.props.height } />
          <svg className="nonSteeringTernaryPlotAxisCanvas" width={ canvasWidth } height={ this.props.height } >
            { this.renderBrushedRegions() }
          </svg>
          <svg className="ternaryPlotNonSteeringRecentPointCanvas" width={ canvasWidth } height={ this.props.height }></svg>
        </div>
      </div>
    );
  }

  public componentDidMount() {
    this.canvas = d3.select("svg.ternaryPlotCanvas");
    this.nonSteeringCanvas = d3.select("svg.nonSteeringTernaryPlotCanvas");
    this.axesSvg = d3.select("svg.ternaryPlotAxesCanvas");

    this.axesSvg.call(this.brush as any);

    this.renderAxes(false);

    if (this.props.showNonSteeringData) {
      this.renderAxes(true);
    }
  }

  public componentDidUpdate(oldProps: Props) {
    if (oldProps.showNonSteeringData !== this.props.showNonSteeringData) {
      this.renderAxes(false);

      if (this.props.showNonSteeringData) {
        this.renderAxes(true);
      }
    }
  }
}