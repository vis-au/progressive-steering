import React from 'react';
import * as d3 from 'd3';

import { ScenarioPreset, TrainingState } from './EelBridge';

import "./ScatterplotRenderer.css";
import HeatMapRenderer from './HeatMapRenderer';

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
  nonSteeringData: any[],
  trainingState: TrainingState,
  filters: Map<string, number[]>,
  presetSelection: ScenarioPreset | null,
  showNonSteeringData: boolean,
  showHeatMap: boolean,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  stepsBeforePaddingGrows: number,
  onBrushedPoints?: (points: any[]) => any,
  onBrushedRegion?: (extent: number[][]) => any,
  onNewPointsInSelection?: (currentPoints: any[], allPoints?: any[]) => any
}

const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_POINT_COLOR = "rgba(70, 130, 180, 0.3)";
const NON_STEERING_POINT_COLOR = "rgba(30, 30, 30, 0.3)";
const DEFAULT_POINT_STROKE_WIDTH = 0;
const DEFAULT_POINT_HIGHLIGHTED_STROKE_WIDTH = 5;
const DEFAULT_KERNEL_STD = 25;
const DEFAULT_DENSITY_LEVELS = 10;
const MIN_SELECTION_THRESHOLD = 0;
const MAX_BRUSH_SCALE_FACTOR = 2;
const SELECTION_INCREMENT = 0.05;

export default class ScatterplotRenderer extends React.Component<Props, State> {
  private brush: any;
  private selection: any;

  private svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringSVG: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringCanvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private scaleX: d3.ScaleLinear<number, number>;
  private scaleY: d3.ScaleLinear<number, number>;

  private quadtree: d3.Quadtree<[number, number]>;
  private densityContourGenerator: d3.ContourDensity<[number, number]>;

  private lastChunk: any[] = [];
  private lastDrawnPreset: number[][] = [];
  private brushScaleFactor = 1;
  private stepsWithoutHit: number = 0;

  constructor(props: Props) {
    super(props);

    this.brush = d3.brush()
      .on("start", this.onBrushStart.bind(this))
      .on("brush", this.onBrush.bind(this))
      .on("end", this.onBrushEnd.bind(this));

    this.svg = null;
    this.canvas = null;
    this.nonSteeringCanvas = null;
    this.nonSteeringSVG = null;
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

  private receivedNewData() {
    const chunk = this.getLatestChunk()

    if (chunk[0] !== undefined && chunk[0] === this.lastChunk[0]) {
      return false;
    }

    return true;
  }

  private updateScales() {
    if (this.svg === null) {
      return;
    }

    this.scaleX.domain(this.props.extentX);
    this.scaleY.domain([this.props.extentY[1], this.props.extentY[0]]);
  }

  private updatePaddedBrushSize() {
    if (this.svg === null) {
      return;
    } else if (!this.receivedNewData()) {
      return;
    }

    const currentlySelectedPoints = this.getNewPointsInCurrentSelection(this.getLatestChunk());

    if (currentlySelectedPoints.length <= MIN_SELECTION_THRESHOLD) {
      this.stepsWithoutHit = this.stepsWithoutHit + 1;
      if (this.stepsWithoutHit >= this.props.stepsBeforePaddingGrows) {
        this.brushScaleFactor = this.brushScaleFactor + SELECTION_INCREMENT;
      }
    } else {
      if (this.props.trainingState !== "collectingData") {
        this.brushScaleFactor = 1;
      }

      this.stepsWithoutHit = 0;
    }

    if (this.brushScaleFactor > MAX_BRUSH_SCALE_FACTOR) {
      this.brushScaleFactor = MAX_BRUSH_SCALE_FACTOR;
    }
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

    let bounds = this.getPaddedBrushBounds();
    if (bounds === null) {
      return [];
    }
    if (this.props.trainingState === "usingTree") {
      bounds = this.selection;
      if (bounds === null) {
        bounds = [[0, 0], [0, 0]];
      }
    }

    const [[minX, minY], [maxX, maxY]] = bounds;

    newPoints.forEach(datum => {
      const x = this.scaleX(datum[dimX]);
      const y = this.scaleY(datum[dimY]);

      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        pointsInSelection.push(datum);
      }
    });

    return pointsInSelection;
  }

  private updateNewPointsInCurrentSelection(newPoints: any[]) {
    const newPointsInSelection = this.getNewPointsInCurrentSelection(newPoints);
    const allPointsInSelection = this.getCurrentlyBrushedPoints();

    if (newPointsInSelection.length > 0 && !!this.props.onNewPointsInSelection) {
      this.props.onNewPointsInSelection(newPointsInSelection, allPointsInSelection);
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

    brushedRegions.push(this.selection);

    this.setState({ brushedRegions });
  }

  private onBrushStart() {
  }

  private onBrush() {
    // udpate the reference to the selected rectangle
    this.selection = d3.event.selection;
    const x0 = this.selection[0][0];
    const x1 = this.selection[1][0];
    const y0 = this.selection[0][1];
    const y1 = this.selection[1][1];

    const xMin = Math.floor(this.scaleX.invert(x0) * 100) / 100;
    const xMax = Math.floor(this.scaleX.invert(x1) * 100) / 100;
    const yMin = Math.floor(this.scaleY.invert(y0) * 100) / 100;
    const yMax = Math.floor(this.scaleY.invert(y1) * 100) / 100;

    d3.select("g.brush text")
      .attr("opacity", 1)
      .attr("transform", `translate(${x0},${y0 - 5})`)
      .text(`x: [${xMin}, ${xMax}], y: [${yMax}, ${yMin}]`);

    this.stepsWithoutHit = 0;
    this.brushScaleFactor = 1;
  }

  private onBrushEnd() {
    this.addCurrentSelectionToBrushedRegions();
    this.updateCurrentlySelectedPoints();

    d3.select("g.brush text").transition().attr("opacity", 0);

    this.stepsWithoutHit = 0;
    this.brushScaleFactor = 1;
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

  private getPaddedBrushBounds() {
    if (this.selection === null) {
      return null;
    }

    const selection = this.selection;

    const brushWidth = Math.abs(selection[0][0] - selection[1][0]);
    const brushHeight = Math.abs(selection[0][1] - selection[1][1]);
    const brushHorizontalPadding = brushWidth * (1 - this.brushScaleFactor);
    const brushVerticalPadding = brushHeight * (1 - this.brushScaleFactor);

    const x0 = selection[0][0] + brushHorizontalPadding;
    const x1 = selection[1][0] - brushHorizontalPadding;
    const y0 = selection[0][1] + brushVerticalPadding;
    const y1 = selection[1][1] - brushVerticalPadding;

    return [[x0, y0], [x1, y1]];
  }

  private renderPaddedBrush() {
    if (this.brushScaleFactor === 1) {
      return null;
    }

    const bounds = this.getPaddedBrushBounds();

    if (bounds === null) {
      return null;
    }

    const [[x0, y0], [x1, y1]] = bounds;
    const paddedBrushWidth = Math.abs(x0 - x1);
    const paddedBrushHeight = Math.abs(y0 - y1);

    return (
      <rect
        className="padded-brush"
        x={ x0 }
        y={ y0 }
        width={ paddedBrushWidth }
        height={ paddedBrushHeight }
      />
    );
  }

  private renderAxes(useNonSteeringData: boolean = false) {
    if (this.svg === null || this.nonSteeringSVG === null) {
      return;
    }

    const svg = useNonSteeringData
      ? this.nonSteeringSVG
      : this.svg;

    const xAxis = d3.axisTop(this.scaleX);
    const yAxis = d3.axisRight(this.scaleY);

    svg.selectAll("g.axis").remove();

    if (useNonSteeringData && !this.props.showNonSteeringData) {
      return;
    }

    svg.select("g.axes")
      .append("g")
      .attr("class", "axis x")
      .attr("transform", `translate(0,${this.props.height - 1})`)
      .call(xAxis);

    svg.select("g.axes")
      .append("g")
      .attr("class", "axis y")
      .attr("transform", `translate(0,0)`)
      .call(yAxis);
  }

  private updateAxes() {
    this.renderAxes(true);
    this.renderAxes(false);
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

  private getLatestChunk(useNonSteeringData: boolean = false) {
    let itemCount = this.props.data.length;

    if (useNonSteeringData) {
      itemCount = this.props.nonSteeringData.length;
      return this.props.nonSteeringData.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
    }

    // if chunksize property is not defined, return the full dataset
    return this.props.data.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
  }

  private renderPoints(useNonSteeringData: boolean = false) {
    if (this.canvas === null || this.nonSteeringCanvas === null) {
      return;
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return;
    }
    if (!this.receivedNewData()) {
      return;
    }

    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;
    let context: any = (this.canvas.node() as any).getContext("2d");

    const chunk = this.getLatestChunk(useNonSteeringData);

    context.fillStyle = DEFAULT_POINT_COLOR;
    context.strokeStyle = DEFAULT_POINT_COLOR;
    context.lineWidth = DEFAULT_POINT_STROKE_WIDTH;

    if (useNonSteeringData) {
      context = (this.nonSteeringCanvas.node() as any).getContext("2d");
      context.fillStyle = NON_STEERING_POINT_COLOR;
      context.strokeStyle = NON_STEERING_POINT_COLOR;
    } else {
      this.quadtree.addAll(chunk);
    }

    chunk.forEach(datum => {
      const px = this.scaleX(datum[dimX]);
      const py = this.scaleY(datum[dimY]);

      context.beginPath();
      context.arc(px, py, DEFAULT_POINT_RADIUS, 0, 2 * Math.PI, true);
      context.fill();
      context.closePath();
    });

    if (!useNonSteeringData) {
      this.updateNewPointsInCurrentSelection(chunk);
    }
  }

  private renderNonSteeringPoints() {
    this.renderPoints(true);
    this.renderInsideOutsidePoints(true);
  }

  private renderSteeringPoints() {
    this.renderPoints(false);
    this.renderInsideOutsidePoints(false);
  }

  private updatePoints() {
    this.renderSteeringPoints();

    if (this.props.showNonSteeringData) {
      this.renderNonSteeringPoints();
    }
  }

  private renderInsideOutsidePoints(useNonSteeringData: boolean) {
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return;
    }

    // no need to update if the chunk has not changed
    if (!this.receivedNewData()) {
      return;
    }

    const canvas = useNonSteeringData
      ? d3.select("svg.recentNonSteeredPointsCanvas")
      : d3.select("svg.recentPointsCanvas");

    canvas.selectAll("circle.recent-point").remove();

    if (!this.props.highlightLastChunk) {
      return;
    }

    const chunk = this.getLatestChunk(useNonSteeringData);
    const pointsInSelection = this.getNewPointsInCurrentSelection(chunk);
    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;

    const points = canvas.selectAll("circle.recent-point").data(chunk)
      .join("circle")
        .attr("class", "recent-point")
        .classed("inside-selection", d => pointsInSelection.indexOf(d) > -1)
        .classed("steered", !useNonSteeringData)
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

  private renderHeatMap(canvasWidth: number) {
    if (this.props.showHeatMap) {
      return (
        <HeatMapRenderer
          width={ canvasWidth }
          height={ this.props.height }
          dimensionX={ this.props.dimensionX }
          dimensionY={ this.props.dimensionY }
          scaleX={ this.scaleX }
          scaleY={ this.scaleY }
          data={ this.props.data }
          showNonSteeringData={ this.props.showNonSteeringData }
          highlightLastChunk={ this.props.highlightLastChunk }
          chunkSize={ this.props.chunkSize }
        />
      );
    } else {
      return null;
    }
  }

  public render() {
    this.updateScales();
    this.updateAxes();
    this.updatePoints();
    this.renderDensityPlots();
    this.renderPresetSelection();
    this.updatePaddedBrushSize();

    this.lastChunk = this.getLatestChunk();

    const canvasWidth = this.props.showNonSteeringData
      ? this.props.width / 2 - 1
      : this.props.width;

    const isNonSteeringCanvasHidden = this.props.showNonSteeringData ? "" : "hidden";

    return (
      <div className="scatterplotRenderer" style={ { width: canvasWidth } }>
        { this.renderHeatMap(canvasWidth) }
        <canvas className="scatterplotCanvas" width={ canvasWidth } height={ this.props.height } />
        <canvas className={ `nonSteeringCanvas ${isNonSteeringCanvasHidden}` } width={ canvasWidth } height={ this.props.height }></canvas>
        <svg className="recentPointsCanvas" width={ canvasWidth } height={ this.props.height } />
        <svg className="densityCanvas" width={ canvasWidth } height={ this.props.height } />
        <svg className="recentNonSteeredPointsCanvas" width={ canvasWidth } height={ this.props.height } />
        <svg className="nonSteeringAxesCanvas" width={ canvasWidth } height={ this.props.height }>
          <g className="axes"></g>
        </svg>
        <svg className="axisCanvas" width={ canvasWidth } height={ this.props.height }>
          <g className="axes"></g>
          { this.renderBrushedRegions() }
          { this.renderPaddedBrush() }
          { this.renderUnsetDimensionsWarning() }
        </svg>
      </div>
    );
  }

  public componentDidMount() {
    this.svg = d3.select("svg.axisCanvas");
    this.canvas = d3.select("canvas.scatterplotCanvas");
    this.nonSteeringCanvas = d3.select("canvas.nonSteeringCanvas");
    this.nonSteeringSVG = d3.select("svg.nonSteeringAxesCanvas");

    this.svg.append("g")
      .attr("class", "brush")
      .call(this.brush)
      //on a 1440 x900 pixel screen, Chrome full screen, only address bar visible
      // .call(this.brush.move, [[]) //15..40, 3..12 8388 tuples
      //.call(this.brush.move, [[]])   //35..40, 0..4  1441 tuples
      //.call(this.brush.move, [[830, 885], [1088, 1030]])   //29..37 0..2
      //.call(this.brush.move, [[920, 680], [1088, 1030]])   //32..37 0..5
      // .call(this.brush.move, [[100, 100], [200, 200]])

    this.svg.select("g.brush").append("text")
      .attr("fill", "black")
      .attr("transform", "translate(0, 10)")
      .text("xdimension: 123, ydimension: 456");
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.showNonSteeringData !== this.props.showNonSteeringData) {
      if (this.svg === null) {
        return;
      }

      this.svg.selectAll("g.brush").remove();
      this.svg.append("g")
        .attr("class", "brush")
        .call(this.brush);
    }
  }
}