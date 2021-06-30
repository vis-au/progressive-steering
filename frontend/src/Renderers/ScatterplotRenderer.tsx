import React from 'react';
import * as d3 from 'd3';

import HeatMapRenderer from './HeatMapRenderer';
import { ScenarioPreset, TrainingState } from '../Data/EelBridge';
import { ScaledCartesianCoordinate } from '../PointTypes';
import { DEFAULT_DENSITY_LEVELS, DEFAULT_KERNEL_STD, DEFAULT_POINT_COLOR, DEFAULT_POINT_RADIUS, DEFAULT_POINT_STROKE_WIDTH, MAX_BRUSH_SCALE_FACTOR, MIN_SELECTION_THRESHOLD, NON_STEERING_POINT_COLOR, SELECTION_INCREMENT } from './RendererDefaultParameters';

import "./ScatterplotRenderer.css";

interface State {
  brushedRegions: number[][][]
}
interface Props {
  width: number,
  height: number,
  dimensionX: string | null,
  dimensionY: string | null,
  extents: Map<string, [number, number]>,
  data: any[],
  nonSteeringData: any[],
  trainingState: TrainingState,
  presetSelection: ScenarioPreset | null,
  showNonSteeringData: boolean,
  showHeatMap: boolean,
  showDots: boolean,
  useDeltaHeatMap: boolean,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  stepsBeforePaddingGrows: number,
  onBrushedPoints?: (points: any[]) => any,
  onBrushedRegion?: (extent: number[][]) => any,
  onNewPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
  onNewNonSteeredPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
}

export default class ScatterplotRenderer extends React.Component<Props, State> {
  private brush: any;
  private selection: any;

  private svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringSVG: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringCanvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private scaleX: d3.ScaleLinear<number, number>;
  private scaleY: d3.ScaleLinear<number, number>;

  private quadtree: d3.Quadtree<ScaledCartesianCoordinate>;
  private nonSteeringQuadtree: d3.Quadtree<ScaledCartesianCoordinate>;
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

    this.quadtree = this.generateNewQuadtree();

    this.nonSteeringQuadtree = this.quadtree.copy();

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

  private generateNewQuadtree() {
    return d3.quadtree<ScaledCartesianCoordinate>()
      .extent([[0, 0], [this.props.width, this.props.height]])
      .x((d: ScaledCartesianCoordinate) => d.px)
      .y((d: ScaledCartesianCoordinate) => d.py);
  }

  private updateScales() {
    if (this.svg === null) {
      return;
    } else if (this.props.dimensionX === null) {
      return;
    } else if (this.props.dimensionY === null) {
      return;
    }

    const rangeX = this.props.extents.get(this.props.dimensionX) || [0, 1];
    const rangeY = this.props.extents.get(this.props.dimensionY) || [0, 1];

    this.scaleX.domain(rangeX);
    this.scaleY.domain([rangeY[1], rangeY[0]]);
  }

  private updatePaddedBrushSize() {
    if (this.svg === null) {
      return;
    } else if (!this.receivedNewData()) {
      return;
    } else if (this.props.data.length === 0) {
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
    if (this.quadtree.size() === 0) {
      this.brushScaleFactor = 1;
    }
  }

  private getCurrentlyBrushedPoints(useNonSteeringData: boolean = false) {
    const extent = this.state.brushedRegions[this.state.brushedRegions.length - 1];

    if (!extent) {
      return [];
    }

    const currentlyBrushedPoints = this.getPointsInRegion(extent, useNonSteeringData);

    return currentlyBrushedPoints;
  }

  private getNewPointsInCurrentSelection(newPoints: any[], useNonSteeringData: boolean = false) {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return [];
    }

    const pointsInSelection: any[] = [];

    let bounds = this.getPaddedBrushBounds() || [];
    if (bounds === null) {
      return [];
    }
    if (this.props.trainingState === "usingTree" || useNonSteeringData) {
      bounds = this.selection;
      if (bounds === null) {
        bounds = [[0, 0], [0, 0]];
      }
    }

    const [[minX, minY], [maxX, maxY]] = bounds;
    bounds = [[minX, maxY], [maxX, minY]];

    newPoints.forEach(datum => {
      if (this.isNodeInBounds(datum, bounds)) {
        pointsInSelection.push(datum);
      }
    });

    return pointsInSelection;
  }

  private updateNewPointsInCurrentSelection(newPoints: ScaledCartesianCoordinate[]) {
    const newPointsInSelection = this.getNewPointsInCurrentSelection(newPoints.map(d => d.values));
    const allPointsInSelection = this.getCurrentlyBrushedPoints().map(d => d.values);

    const newNonSteeredPoints = this.getLatestChunk(true);
    const newNonSteeredPointsInSelection = this.getNewPointsInCurrentSelection(newNonSteeredPoints, true);
    const allNonSteeredPointsInSelection = this.getCurrentlyBrushedPoints(true);

    if (newPointsInSelection.length > 0 && !!this.props.onNewPointsInSelection) {
      this.props.onNewPointsInSelection(newPointsInSelection, allPointsInSelection);
      this.props.onNewNonSteeredPointsInSelection(newNonSteeredPointsInSelection, allNonSteeredPointsInSelection);
    }
  }

  private isNodeInBounds(node: any, bounds: number[][]) {
    const dimX = this.props.dimensionX as string;
    const dimY = this.props.dimensionY as string;

    return (
      node[dimX] >= bounds[0][0] &&
      node[dimX] < bounds[1][0] &&
      node[dimY] >= bounds[1][1] &&
      node[dimY] < bounds[0][1]
    );
  }

  private getPointsInRegion(region: number[][], useNonSteeringData: boolean = false) {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return [];
    }

    const pointsInRegion: ScaledCartesianCoordinate[] = [];

    const x0 = this.scaleX(region[0][0]);
    const x3 = this.scaleX(region[1][0]);
    const y0 = this.scaleY(region[0][1]);
    const y3 = this.scaleY(region[1][1]);

    const quadtree = useNonSteeringData
      ? this.nonSteeringQuadtree
      : this.quadtree;

    quadtree.visit((node: any, x1, y1, x2, y2) => {
      if (!Array.isArray(node)) {
        do {
          const nodeIsInBounds = this.isNodeInBounds(node.data.values, region);

          if (nodeIsInBounds) {
            pointsInRegion.push(node.data);
          }
        } while ((node = node.next) !== undefined);
      }

      const nodeOverlapsRegion = (
        x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0
      );

      return nodeOverlapsRegion;
    });

    return pointsInRegion;
  }

  private updateCurrentlySelectedPoints() {
    const brushedPoints: ScaledCartesianCoordinate[] = this.getCurrentlyBrushedPoints();
    const brushedData = brushedPoints.map(d => d.values);

    if (!!this.props.onBrushedPoints) {
      this.props.onBrushedPoints(brushedData);
    }
    if (!!this.props.onBrushedRegion) {
      // no region was added because brush is empty. Can happen when user clicks on scatter plot
      // without selecting a region.
      if (this.state.brushedRegions.length === 0) {
        return;
      }
      this.props.onBrushedRegion(this.state.brushedRegions[this.state.brushedRegions.length - 1]);
    }
  }

  private addCurrentSelectionToBrushedRegions() {
    const brushedRegions = this.state.brushedRegions;
    let selectionInDataSpace: number[][] = [[-Infinity, -Infinity], [-Infinity, -Infinity]];

    if (d3.event.selection !== null) {
      const [[x0, y1], [x1, y0]] = this.selection;
      selectionInDataSpace = [[x0, y0], [x1, y1]];
    }

    brushedRegions.push(selectionInDataSpace);

    this.setState({ brushedRegions });
  }

  private onBrushStart() {
  }

  private onBrush() {
    const [[x0, y0], [x1, y1]] = d3.event.selection;
    const x = this.scaleX.invert;
    const y = this.scaleY.invert;

    // udpate the reference to the selected rectangle
    this.selection = [[x(x0), y(y1)], [x(x1), y(y0)]];

    const xMin = Math.floor(x(x0) * 100) / 100;
    const xMax = Math.floor(x(x1) * 100) / 100;
    const yMin = Math.floor(y(y0) * 100) / 100;
    const yMax = Math.floor(y(y1) * 100) / 100;

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
    const x = this.scaleX(brushedRegion[0][0]);
    const y = this.scaleY(brushedRegion[0][1]);
    const width = Math.abs(this.scaleX(brushedRegion[0][0]) - this.scaleX(brushedRegion[1][0]));
    const height = Math.abs(this.scaleY(brushedRegion[0][1]) - this.scaleY(brushedRegion[1][1]));
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

  private renderPointsInSelectionLabel(useNonSteeringData: boolean = false) {
    if (this.state.brushedRegions.length === 0) {
      return;
    }

    const currentSelection = this.state.brushedRegions[this.state.brushedRegions.length - 1];
    let pointsInSelection = this.getCurrentlyBrushedPoints(useNonSteeringData);

    const x = this.scaleX(currentSelection[0][0]);
    const y = this.scaleY(currentSelection[1][1]) + 15;

    return (
      <text className="brushed-regions" x={ x } y={ y }>
        { pointsInSelection.length } points
      </text>
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

    const x = this.scaleX;
    const y = this.scaleY;

    const [[x0, y0], [x1, y1]] = bounds;
    const paddedBrushWidth = Math.abs(x(x0) - x(x1));
    const paddedBrushHeight = Math.abs(y(y0) - y(y1));

    return (
      <rect
        className="padded-brush"
        x={ x(x0) }
        y={ y(y1) }
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
    // in case the latest chunk is empty (for example as a side-effect of when the steering phase
    // ends and no points are returned, prevent slice() to return the entire dataset)
    if  (this.props.chunkSize === 0) {
      return [];
    }

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

  private updateQuadtrees(steeredChunk: ScaledCartesianCoordinate[], nonSteeredChunk: ScaledCartesianCoordinate[]) {
    if (!this.receivedNewData()) {
      return;
    }

    this.quadtree.addAll(steeredChunk);
    this.updateNewPointsInCurrentSelection(steeredChunk);
    this.nonSteeringQuadtree.addAll(nonSteeredChunk);
  }

  private getScaledCoordinatesForData(useNonSteeringData: boolean) {
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return [];
    }

    const chunk = this.getLatestChunk(useNonSteeringData);
    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;

    const scaledCoordinates: ScaledCartesianCoordinate[] = [];

    chunk.forEach(datum => {
      const px = this.scaleX(datum[dimX]);
      const py = this.scaleY(datum[dimY]);

      scaledCoordinates.push({ px, py, values: datum });
    });

    return scaledCoordinates;
  }

  private renderPoints(useNonSteeringData: boolean = false): ScaledCartesianCoordinate[] {
    if (this.canvas === null || this.nonSteeringCanvas === null) {
      return [];
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return [];
    }
    if (!this.receivedNewData()) {
      return [];
    }

    const scaledChunk = this.getScaledCoordinatesForData(useNonSteeringData);

    if (!this.props.showDots) {
      return scaledChunk;
    }

    let context: any = (this.canvas.node() as any).getContext("2d");
    context.fillStyle = DEFAULT_POINT_COLOR;
    context.strokeStyle = DEFAULT_POINT_COLOR;
    context.lineWidth = DEFAULT_POINT_STROKE_WIDTH;

    if (useNonSteeringData) {
      context = (this.nonSteeringCanvas.node() as any).getContext("2d");
      context.fillStyle = NON_STEERING_POINT_COLOR;
      context.strokeStyle = NON_STEERING_POINT_COLOR;
    }

    scaledChunk.forEach(datum => {
      context.beginPath();
      context.arc(datum.px, datum.py, DEFAULT_POINT_RADIUS, 0, 2 * Math.PI, true);
      context.fill();
      context.closePath();
    });

    return scaledChunk;
  }

  private renderNonSteeringPoints() {
    const scaledChunk = this.renderPoints(true);
    this.renderInsideOutsidePoints(scaledChunk, true);

    return scaledChunk;
  }

  private renderSteeringPoints() {
    const scaledChunk = this.renderPoints(false);
    this.renderInsideOutsidePoints(scaledChunk, false);

    return scaledChunk;
  }

  private clearCanvases() {
    if (this.canvas === null) {
      return;
    } else if (this.nonSteeringCanvas === null) {
      return;
    }

    const steeringContext: any = (this.canvas.node() as any).getContext("2d");
    const nonSteeringContext: any = (this.nonSteeringCanvas.node() as any).getContext("2d");
    this.quadtree = this.generateNewQuadtree();
    this.nonSteeringQuadtree = this.quadtree.copy();

    steeringContext.clearRect(0, 0, this.props.width, this.props.height);
    nonSteeringContext.clearRect(0, 0, this.props.width, this.props.height);
  }

  private updatePoints() {
    const steered = this.renderSteeringPoints();
    const nonSteered: ScaledCartesianCoordinate[] = [];

    if (this.props.showNonSteeringData) {
      nonSteered.push(...this.renderNonSteeringPoints());
    }
    if (this.props.data.length === 0) {
      this.clearCanvases();
    }

    return { steered, nonSteered };
  }

  private renderInsideOutsidePoints(chunk: ScaledCartesianCoordinate[], useNonSteeringData: boolean) {

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

    const pointsInSelection = this.getNewPointsInCurrentSelection(chunk.map(d => d.values), useNonSteeringData);

    const points = canvas.selectAll("circle.recent-point").data(chunk)
      .join("circle")
        .attr("class", "recent-point")
        .classed("inside-selection", d => pointsInSelection.indexOf(d.values) > -1)
        .classed("steered", !useNonSteeringData)
        .attr("cx", d => d.px)
        .attr("cy", d => d.py)
        .attr("r", DEFAULT_POINT_RADIUS);

    points.transition().duration(250).attr("r", DEFAULT_POINT_RADIUS * 2);
  }

  private renderDensityPlots() {
    // const pointsInBrushedRegions = this.state.brushedRegions
    //   .map(d => this.getPointsInRegion(d))
    //   .flat();

    // const canvas = d3.select("svg.densityCanvas");

    // canvas.selectAll("path.density-region").data(this.densityContourGenerator(pointsInBrushedRegions))
    //   .join("path")
    //     .attr("class", "density-region")
    //     .attr("d", d3.geoPath());
  }

  private renderHeatMap(canvasWidth: number) {
    if (this.props.showHeatMap) {
      return (
        <HeatMapRenderer
          canvasWidth={ canvasWidth }
          height={ this.props.height }
          scaleX={ this.scaleX }
          scaleY={ this.scaleY }
          steeredData={ this.quadtree.data() }
          nonSteeredData={ this.nonSteeringQuadtree.data() }
          showNonSteeredCanvas={ this.props.showNonSteeringData }
          useDeltaHeatMap={ this.props.useDeltaHeatMap }
          cellOpacity={ 1 }
        />
      );
    } else {
      return null;
    }
  }

  public render() {
    this.updateScales();
    this.updateAxes();
    const scaledData = this.updatePoints();
    this.updateQuadtrees(scaledData.steered, scaledData.nonSteered);
    // this.renderDensityPlots();
    this.renderPresetSelection();
    this.updatePaddedBrushSize();

    this.lastChunk = this.getLatestChunk();
    const canvasWidth = this.getCanvasWidth();

    const isNonSteeringCanvasHidden = this.props.showNonSteeringData ? "" : "hidden";
    const isPointCanvasHidden = this.props.showDots ? "" : "hidden";

    return (
      <div className="scatterplotRenderer" style={ { width: canvasWidth } }>
        { this.renderHeatMap(canvasWidth) }
        <canvas className={`scatterplotCanvas ${isPointCanvasHidden}`} width={ canvasWidth } height={ this.props.height } />
        <canvas className={ `nonSteeringCanvas ${isNonSteeringCanvasHidden} ${isPointCanvasHidden}` } width={ canvasWidth } height={ this.props.height }></canvas>
        <svg className="recentPointsCanvas" width={ canvasWidth } height={ this.props.height } />
        <svg className="densityCanvas" width={ canvasWidth } height={ this.props.height } />
        <svg className={ `recentNonSteeredPointsCanvas ${isNonSteeringCanvasHidden}` } width={ canvasWidth } height={ this.props.height } />
        <svg className={ `nonSteeringAxesCanvas ${isNonSteeringCanvasHidden}` } width={ canvasWidth } height={ this.props.height }>
          <g className="axes"></g>
          { this.renderBrushedRegions() }
          { this.renderPointsInSelectionLabel(true) }
        </svg>
        <svg className="axisCanvas" width={ canvasWidth } height={ this.props.height }>
          <g className="axes"></g>
          { this.renderBrushedRegions() }
          { this.renderPointsInSelectionLabel() }
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
      .attr("transform", "translate(0, 10)");
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.showNonSteeringData !== this.props.showNonSteeringData) {
      if (this.svg === null) {
        return;
      }

      const canvasWidth = this.getCanvasWidth();

      this.scaleX.range([0, canvasWidth]);

      this.svg.selectAll("g.brush").remove();
      this.svg.append("g")
        .attr("class", "brush")
        .call(this.brush);
    }
  }
}