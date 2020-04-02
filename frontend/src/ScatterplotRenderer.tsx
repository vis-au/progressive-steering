import React from 'react';
import * as d3 from 'd3';

import { ScenarioPreset } from './EelBridge';

import "./ScatterplotRenderer.css";

interface State {
  brushedRegions: number[][][]
}
interface Props {
  width: number,
  height: number,
  dimensionX: string | null,
  dimensionY: string | null,
  extentX: [number, number],
  extentY: [number, number],
  data: any[],
  filters: Map<string, number[]>,
  presetSelection: ScenarioPreset | null,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  onBrushedPoints?: (points: any[]) => any,
  onBrushedRegion?: (extent: number[][]) => any,
  onNewPointsInSelection?: (points: any[]) => any
}

const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_POINT_COLOR = "rgba(70, 130, 180, 0.3)";
const DEFAULT_POINT_STROKE_WIDTH = 0;
const DEFAULT_POINT_HIGHLIGHTED_STROKE_WIDTH = 5;
const DEFAULT_KERNEL_STD = 10;
const DEFAULT_DENSITY_LEVELS = 5;

export default class ScatterplotRenderer extends React.Component<Props, State> {
  private brush: any;
  private selection: any;

  private svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private scaleX: d3.ScaleLinear<number, number>;
  private scaleY: d3.ScaleLinear<number, number>;

  private quadtree: d3.Quadtree<[number, number]>;
  private densityContourGenerator: d3.ContourDensity<[number, number]>;

  private lastChunk: any[] = [];
  private lastDrawnPreset: number[][] = [];

  constructor(props: Props) {
    super(props);

    this.brush = d3.brush()
      .on("start", this.onBrushStart.bind(this))
      .on("brush", this.onBrush.bind(this))
      .on("end", this.onBrushEnd.bind(this));

    this.svg = null;
    this.canvas = null;
    this.selection = null;

    this.quadtree = d3.quadtree()
      .extent([[0, 0], [this.props.width, this.props.height]])
      .x((d: any) => this.scaleX(d[this.props.dimensionX || ""]))
      .y((d: any) => this.scaleY(d[this.props.dimensionY || ""]));

    this.densityContourGenerator = d3.contourDensity()
      .size([this.props.width, this.props.height])
      .x((d: any) => this.scaleX(d[this.props.dimensionX || ""]))
      .y((d: any) => this.scaleY(d[this.props.dimensionY || ""]))
      .bandwidth(DEFAULT_KERNEL_STD)
      .thresholds(DEFAULT_DENSITY_LEVELS);

    this.scaleX = d3.scaleLinear()
      .range([0, this.props.width]);

    this.scaleY = d3.scaleLinear()
      .range([0, this.props.height]);

    this.state = {
      brushedRegions: []
    };
  }

  private updateScales() {
    if (this.svg === null) {
      return;
    }

    this.scaleX.domain(this.props.extentX);
    this.scaleY.domain([this.props.extentY[1], this.props.extentY[0]]);
  }

  private getCurrentlyBrushedPoints() {
    const extent = this.selection;
    const currentlyBrushedPoints: any[] = this.getPointsInRegion(extent);

    return currentlyBrushedPoints;
  }

  private getNewPointsInCurrentSelection(newPoints: any[]) {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return [];
    }

    const pointsInSelection: any[] = [];
    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;
    const selection = this.selection;

    newPoints.forEach(datum => {
      const x = this.scaleX(datum[dimX]);
      const y = this.scaleY(datum[dimY]);

      if (x > selection[0][0] && x < selection[1][0] && y > selection[0][1] && y < selection[1][1]) {
        pointsInSelection.push(datum);
      }
    });

    return pointsInSelection;
  }

  private updateNewPointsInCurrentSelection(newPoints: any[]) {
    const pointsInSelection = this.getNewPointsInCurrentSelection(newPoints);

    if (pointsInSelection.length > 0 && !!this.props.onNewPointsInSelection) {
      this.props.onNewPointsInSelection(pointsInSelection);
    }
  }

  private getPointsInRegion(region: number[][]) {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return [];
    }

    const pointsInRegion: any[] = [];

    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;

    this.quadtree.visit((node: any, x0, y0, x1, y1) => {
      if (!Array.isArray(node)) {
        do {
          let d = node.data;
          const inBounds = (this.scaleX(d[dimX]) >= region[0][0])
            && (this.scaleX(d[dimX]) < region[1][0])
            && (this.scaleY(d[dimY]) >= region[0][1])
            && (this.scaleY(d[dimY]) < region[1][1]);

          if (inBounds) {
            pointsInRegion.push(d);
          }
        } while ((node = node.next));
      }
      return (
        x0 >= region[1][0] ||
        y0 >= region[1][1] ||
        x1 < region[0][0] ||
        y1 < region[0][1]
      );
    });

    return pointsInRegion;
  }

  private updateCurrentlySelectedPoints() {
    const brushedPoints: any[] = this.getCurrentlyBrushedPoints();

    if (!!this.props.onBrushedPoints) {
      this.props.onBrushedPoints(brushedPoints);
    }
    if (!!this.props.onBrushedRegion) {
      // no region was added because brush is empty
      if (this.state.brushedRegions.length === 0) {
        return;
      }
      this.props.onBrushedRegion(this.state.brushedRegions[this.state.brushedRegions.length - 1]);
    }
  }

  private addCurrentSelectionToBrushedRegions() {
    const brushedRegions = this.state.brushedRegions;

    if (this.selection === null) {
      brushedRegions.splice(0, 1);
      return;
    }
    if (this.selection[0][0] - this.selection[1][0] === 0) {
      brushedRegions.splice(0, 1);
      this.selection = null;
      return;
    }
    if (this.selection === brushedRegions[brushedRegions.length - 1]) {
      brushedRegions.splice(0, 1);
      this.selection = null;
      return;
    }

    brushedRegions.push(this.selection);

    if (brushedRegions.length > 10) {
      brushedRegions.splice(0, 1);
    }

    this.setState({ brushedRegions });
  }

  private onBrushStart() {
  }

  private onBrush() {
    // udpate the reference to the selected rectangle
    this.selection = d3.event.selection;
  }

  private onBrushEnd() {
    this.addCurrentSelectionToBrushedRegions();
    this.updateCurrentlySelectedPoints();
  }

  private wasPresetAlreadyDrawn(preset: number[][]) {
    if (this.selection === null) {
      return false;
    }

    const [[newX0, newX1], [newY0, newY1]] = preset;
    const [[currentX0, currentX1], [currentY0, currentY1]] = this.lastDrawnPreset;

    const sameX = newX0 === currentX0 && newX1 === currentX1;
    const sameY = newY0 === currentY0 && newY1 === currentY1;

    return sameX && sameY;
  }

  private renderPresetSelection() {
    if (this.svg === null) {
      return;
    }
    if (!this.props.presetSelection) {
      this.lastDrawnPreset = [[-1, -1], [-1, -1]];
      return;
    }

    const presetX0 = this.scaleX(this.props.presetSelection.x_bounds[0]);
    const presetX1 = this.scaleX(this.props.presetSelection.x_bounds[1]);
    const presetY0 = this.scaleY(this.props.presetSelection.y_bounds[1]);
    const presetY1 = this.scaleY(this.props.presetSelection.y_bounds[0]);
    const preset = [[presetX0, presetY0], [presetX1, presetY1]];

    if (this.wasPresetAlreadyDrawn(preset)) {
      return;
    }

    console.log(this.props.presetSelection)
    console.log(this.scaleY.invert(presetY0), this.scaleY.invert(presetY1))

    this.svg.select("g.brush")
      .call(this.brush.move, preset);

    this.lastDrawnPreset = preset;
  }

  private renderBrushedRegion(brushedRegion: number[][], index: number) {
    const x = brushedRegion[0][0];
    const y = brushedRegion[0][1];
    const width = Math.abs(brushedRegion[0][0] - brushedRegion[1][0]);
    const height = Math.abs(brushedRegion[0][1] - brushedRegion[1][1]);
    // const opacity = index / this.state.brushedRegions.length + 0.1;
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
    return (
      <g className="brushed-regions">
        { this.state.brushedRegions.map(this.renderBrushedRegion.bind(this)) }
      </g>
    );
  }

  private renderAxes() {
    if (this.svg === null) {
      return;
    }

    const xAxis = d3.axisTop(this.scaleX);
    const yAxis = d3.axisRight(this.scaleY);

    this.svg.selectAll("g.axis").remove();

    this.svg.select("g.axes")
      .append("g")
      .attr("class", "axis x")
      .attr("transform", `translate(0,${this.props.height - 1})`)
      .call(xAxis);

    this.svg.select("g.axes")
      .append("g")
      .attr("class", "axis y")
      .attr("transform", `translate(0,0)`)
      .call(yAxis);
  }

  private renderUnsetDimensionsWarning() {
    if (this.props.dimensionX !== null && this.props.dimensionY !== null) {
      return null;
    }

    return (
      <g className="unset-dimension-warning" transform={ `translate(${this.props.width / 2},${this.props.height / 2})` }>
        <text>Set the dimensions for X and Y first.</text>
      </g>
    );
  }

  private getLatestChunk() {
    const itemCount = this.props.data.length;

    // if chunksize property is not defined, return the full dataset
    return this.props.data.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
  }

  private renderPoints() {
    if (this.canvas === null) {
      return;
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return;
    }

    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;
    const context = (this.canvas.node() as any).getContext("2d");

    context.fillStyle = DEFAULT_POINT_COLOR;
    context.strokeStyle = DEFAULT_POINT_COLOR;
    context.lineWidth = DEFAULT_POINT_STROKE_WIDTH;

    const chunk = this.getLatestChunk()

    if (chunk[0] !== undefined && chunk[0] === this.lastChunk[0]) {
      return;
    }

    this.quadtree.addAll(chunk);

    chunk.forEach(datum => {
      const px = this.scaleX(datum[dimX]);
      const py = this.scaleY(datum[dimY]);

      context.beginPath();
      context.arc(px, py, DEFAULT_POINT_RADIUS, 0, 2 * Math.PI, true);
      context.fill();
      context.closePath();
    });

    this.updateNewPointsInCurrentSelection(chunk);
  }

  private renderInsideOutsidePoints() {
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return;
    }

    const chunk = this.getLatestChunk();

    // no need to update if the chunk has not changed
    if (chunk[0] !== undefined && chunk[0] === this.lastChunk[0]) {
      return;
    }

    const canvas = d3.select("svg.recentPointsCanvas");
    canvas.selectAll("circle.recent-point").remove();

    if (!this.props.highlightLastChunk) {
      return;
    }

    const pointsInSelection = this.getNewPointsInCurrentSelection(chunk);
    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;

    const points = canvas.selectAll("circle.recent-point").data(chunk)
      .join("circle")
        .attr("class", "recent-point")
        .classed("inside-selection", d => pointsInSelection.indexOf(d) > -1)
        .attr("cx", d => this.scaleX(d[dimX]))
        .attr("cy", d => this.scaleY(d[dimY]))
        .attr("r", DEFAULT_POINT_RADIUS);

    points.transition().duration(250).attr("r", DEFAULT_POINT_RADIUS * 2);
  }

  private renderDensityPlots() {
    const pointsInBrushedRegions = this.state.brushedRegions
      .map(this.getPointsInRegion.bind(this))
      .flat();

    const canvas = d3.select("svg.densityCanvas");

    canvas.selectAll("path.density-region").data(this.densityContourGenerator(pointsInBrushedRegions))
      .join("path")
        .attr("class", "density-region")
        .attr("d", d3.geoPath());
  }

  public render() {
    this.updateScales();
    this.renderAxes();
    this.renderPoints();
    this.renderInsideOutsidePoints();
    this.renderDensityPlots();
    this.renderPresetSelection();

    this.lastChunk = this.getLatestChunk();

    return (
      <div className="scatterplotRenderer" style={ { width: this.props.width } }>
        <canvas className="scatterplotCanvas" width={ this.props.width } height={ this.props.height } />
        <svg className="recentPointsCanvas" width={ this.props.width } height={ this.props.height } />
        <svg className="densityCanvas" width={ this.props.width } height={ this.props.height } />
        <svg className="axisCanvas" width={ this.props.width } height={ this.props.height }>
          <g className="axes"></g>
          { this.renderBrushedRegions() }
          { this.renderUnsetDimensionsWarning() }
        </svg>
      </div>
    );
  }

  public componentDidMount() {
    this.svg = d3.select("svg.axisCanvas");
    this.canvas = d3.select("canvas.scatterplotCanvas");

    this.svg.append("g")
      .attr("class", "brush")
      .call(this.brush)
      //on a 1440 x900 pixel screen, Chrome full screen, only address bar visible
      // .call(this.brush.move, [[]) //15..40, 3..12 8388 tuples
      //.call(this.brush.move, [[]])   //35..40, 0..4  1441 tuples
      //.call(this.brush.move, [[830, 885], [1088, 1030]])   //29..37 0..2 
      //.call(this.brush.move, [[920, 680], [1088, 1030]])   //32..37 0..5 
      // .call(this.brush.move, [[100, 100], [200, 200]])
      .call(g => g.select(".overlay").style("cursor", "default"));
  }
}  