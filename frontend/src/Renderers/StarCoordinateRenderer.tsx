import * as React from 'react';
import * as d3 from 'd3';

import { CartesianCoordinate, PolarCoordinate, ScaledCartesianCoordinate } from '../PointTypes';
import { DEFAULT_POINT_COLOR, DEFAULT_POINT_RADIUS, DEFAULT_POINT_STROKE_WIDTH, NON_STEERING_POINT_COLOR } from './RendererDefaultParameters';

import './StarCoordinateRenderer.css';

interface Props {
  width: number,
  height: number,
  dimensions: string[],
  extents: Map<string, [number, number]>,
  data: any[],
  nonSteeringData: any[],
  showNonSteeringData: boolean,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  // stepsBeforePaddingGrows: number,
  onBrushedPoints?: (points: any[]) => any,
  onBrushedRegion: (extent: number[][]) => any,
  onNewPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
  onNewNonSteeredPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
}
interface State {
  margin: number,
  brushedPoints: ScaledCartesianCoordinate[],
  selectedPoint: ScaledCartesianCoordinate | null;
}

export default class StarCoordinateRenderer extends React.Component<Props, State> {

  private axesSvg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringAxesSvg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringCanvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private scales: d3.ScaleLinear<number, number>[] = [];

  private brush: d3.BrushBehavior<any>;
  private selection: any;

  private scaleX: d3.ScaleLinear<number, number>;
  private scaleY: d3.ScaleLinear<number, number>;

  private lastChunk: any[] = [];
  private steeringScreenPositions: ScaledCartesianCoordinate[];
  private nonSteeringScreenPositions: ScaledCartesianCoordinate[];

  private plotSize: number;
  constructor(props: Props) {
    super(props);

    this.scales = [];

    this.axesSvg = null;
    this.canvas = null;
    this.nonSteeringCanvas = null;
    this.nonSteeringAxesSvg = null;

    this.steeringScreenPositions = [];
    this.nonSteeringScreenPositions = [];
    this.selection = null;

    this.brush = d3.brush()
      .on("start", null)
      .on("brush", null)
      .on("end", this.onBrushEnd.bind(this));

    this.state = {
      margin: 50,
      selectedPoint: null,
      brushedPoints: []
    };

    this.plotSize = this.props.height - this.state.margin * 2;

    this.scaleX = d3.scaleLinear()
      .domain([-1, 1])
      .range([-this.plotSize / 2, this.plotSize / 2]);

    this.scaleY = d3.scaleLinear()
      .domain([-1, 1])
      .range([-this.plotSize / 2, this.plotSize / 2]);
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
    return (
      node.px >= bounds[0][0] &&
      node.px < bounds[1][0] &&
      node.py >= bounds[0][1] &&
      node.py < bounds[1][1]
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

  private updateScales() {
    const extents = Array.from(this.props.extents).map(d => d[1]);
    this.scales = extents.map(extent => {
      return d3.scaleLinear().domain(extent).range([0, 1]).clamp(true);
    });
  }

  private getDataInPolarCoordinates(useNonSteeringData: boolean) {
    if (this.scales.length === 0 || this.scales.length !== this.props.dimensions.length) {
      this.updateScales();
    }

    const radians = 2 * Math.PI / this.props.dimensions.length;
    const polarCoordinates: PolarCoordinate[][] = [];
    const chunk = this.getLatestChunk(useNonSteeringData);

    chunk.forEach(datum => {
      const polarCoordinate: PolarCoordinate[] = [];

      this.props.dimensions.forEach((dim, i) => {
        const theta = i * radians;

        if (datum[dim] === undefined) {
          polarCoordinate.push({ theta, r: 0, values: datum });
          return;
        }

        let r = this.scales[i](datum[dim]);

        if (isNaN(r)) {
          r = 0;
        }

        const newPoint: PolarCoordinate = { theta, r, values: datum };
        polarCoordinate.push(newPoint);
      });

      polarCoordinates.push(polarCoordinate);
    });

    return polarCoordinates;
  }

  private getCartesianCoordinatesFromPolarCoordinates(polarCoordinates: PolarCoordinate[][]) {

    const cartesianCoordinates: CartesianCoordinate[][] = [];

    polarCoordinates.forEach(polarCoordinate => {
      const cartesianCoordinate: CartesianCoordinate[] = [];

      polarCoordinate.forEach((position: PolarCoordinate) => {
        const x = position.r * Math.cos(position.theta);
        const y = position.r * Math.sin(position.theta);

        const newPoint: CartesianCoordinate = { x, y, values: position.values };
        cartesianCoordinate.push(newPoint);
      });

      cartesianCoordinates.push(cartesianCoordinate);
    });

    return cartesianCoordinates;
  }

  private getStarCoordinatesForData(useNonSteeringData: boolean) {
    const polarCoordinates: PolarCoordinate[][] = this.getDataInPolarCoordinates(useNonSteeringData);
    const cartesianCoordinates: CartesianCoordinate[][] = this.getCartesianCoordinatesFromPolarCoordinates(polarCoordinates);

    const centerOffsetX = this.scaleX.invert(this.plotSize / 2 + this.state.margin);
    const centerOffsetY = this.scaleY.invert(this.plotSize / 2 + this.state.margin);

    const starCoordinates: CartesianCoordinate[] = [];
    cartesianCoordinates.forEach(cartesianCoordinate => {
      const x = cartesianCoordinate.reduce((sum, newValue) => sum + newValue.x, centerOffsetX);
      const y = cartesianCoordinate.reduce((sum, newValue) => sum + newValue.y, centerOffsetY);
      const newPoint = { x, y, values: cartesianCoordinate[0].values };

      starCoordinates.push(newPoint);
    });

    return starCoordinates;
  }

  private getScaledCartesianCoordinatesForData(useNonSteeringData: boolean) {
    const starCoordinates = this.getStarCoordinatesForData(useNonSteeringData);

    const scaledStarCoordinates: ScaledCartesianCoordinate[] = [];
    starCoordinates.forEach(datum => {
      const px = this.scaleX(datum.x);
      const py = this.scaleY(datum.y);

      const newPoint = { px, py, values: datum.values }
      scaledStarCoordinates.push(newPoint);
    });

    return scaledStarCoordinates;
  }

  private showDetails(d: ScaledCartesianCoordinate) {
    this.setState({ selectedPoint: d });
  }

  private hideDetails() {
    this.setState({ selectedPoint: null });
  }

  private renderPoints(useNonSteeringData: boolean = false) {
    if (this.axesSvg === null) {
      return [];
    } else if (this.nonSteeringCanvas === null) {
      return [];
    } else if (this.canvas === null) {
      return [];
    } else if (!this.receivedNewData()) {
      return [];
    }

    const scaledCartesianCoordinates = this.getScaledCartesianCoordinatesForData(useNonSteeringData);

    let context: any = (this.canvas.node() as any).getContext("2d");
    context.fillStyle = DEFAULT_POINT_COLOR;
    context.strokeStyle = DEFAULT_POINT_COLOR;
    context.lineWidth = DEFAULT_POINT_STROKE_WIDTH;

    if (useNonSteeringData) {
      context = (this.nonSteeringCanvas.node() as any).getContext("2d");
      context.fillStyle = NON_STEERING_POINT_COLOR;
      context.strokeStyle = NON_STEERING_POINT_COLOR;
    }

    scaledCartesianCoordinates.forEach((datum: ScaledCartesianCoordinate) => {
      context.beginPath();
      context.arc(datum.px, datum.py, DEFAULT_POINT_RADIUS, 0, 2 * Math.PI, true);
      context.fill();
      context.closePath();
    });

    return scaledCartesianCoordinates;
  }

  private renderInsideOutsidePoints(chunk: ScaledCartesianCoordinate[], useNonSteeringData: boolean) {

    // no need to update if the chunk has not changed
    if (!this.receivedNewData()) {
      return;
    }

    const canvas = useNonSteeringData
      ? d3.select("svg.recentNonSteeredStarPointsCanvas")
      : d3.select("svg.recentStarPointsCanvas");

    canvas.selectAll("circle.recent-point").remove();

    if (!this.props.highlightLastChunk) {
      return;
    }

    const pointsInSelection = this.getNewPointsInCurrentSelection(chunk, false);

    const points = canvas.selectAll("circle.recent-point").data(chunk)
      .join("circle")
        .attr("class", "recent-point")
        .classed("inside-selection", d => pointsInSelection.indexOf(d) > -1)
        .classed("steered", !useNonSteeringData)
        .attr("cx", d => d.px)
        .attr("cy", d => d.py)
        .attr("r", DEFAULT_POINT_RADIUS)
        .on("mouseover", this.showDetails.bind(this))
        .on("mouseleave", this.hideDetails.bind(this));

    points.transition().duration(250).attr("r", DEFAULT_POINT_RADIUS * 2);
  }

  private getAxesDotPositions() {
    const radians = 2 * Math.PI / this.props.dimensions.length;

    const axesDotsPolar: PolarCoordinate[] = [];
      this.props.dimensions.forEach((dim, i) => {
      const r = 1;
      const theta = i * radians;

      axesDotsPolar.push({ r, theta });
    });

    const axesDotsCartesian: CartesianCoordinate[] = [];
    axesDotsPolar.forEach(polarDot => {
      const x = polarDot.r * Math.cos(polarDot.theta);
      const y = polarDot.r * Math.sin(polarDot.theta);

      axesDotsCartesian.push({ x, y });
    });

    return axesDotsCartesian;
  }

  private renderAxes(useNonSteeringData: boolean = false) {
    if (this.axesSvg === null) {
      return;
    } else if (this.nonSteeringAxesSvg === null) {
      return;
    }

    const axesDotsCartesian = this.getAxesDotPositions();

    let container = this.axesSvg.select("g.container");

    if (useNonSteeringData) {
      container = this.nonSteeringAxesSvg.select("g.container");
    }

    container.selectAll("g.axes").remove();
    const axes = container.append("g").attr("class", "axes");

    // enclosing background circle
    axes.append("circle")
      .attr("class", "outline")
      .attr("r", this.plotSize / 2)
      .attr("cx", this.plotSize/2)
      .attr("cy", this.plotSize/2)
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1);

    const dots = axes.append("g")
      .attr("class", "dots")
      .attr("transform", `translate(${this.plotSize/2}, ${this.plotSize/2})`);

    const dot = dots.selectAll("g.dot").data(axesDotsCartesian).enter()
      .append("g")
      .attr("class", "dot")
      .attr("transform", d => `translate(${this.scaleX(d.x)}, ${this.scaleY(d.y)})`);

    // label markers
    dot.append("circle")
      .attr("class", "marker")
      .attr("fill", "#555")
      .attr("stroke", "#555")
      .attr("r", 5);

    // labels
    dot.append("text")
      .attr("alignment-baseline", "middle")
      .attr("dx", 8)
      .attr("dy", 5)
      .text((d, i) => this.props.dimensions[i]);
  }

  private renderSteeringPoints() {
    const scaledChunk = this.renderPoints(false);
    this.renderInsideOutsidePoints(scaledChunk, false);

    this.steeringScreenPositions.push(...scaledChunk);
    return scaledChunk;
  }

  private renderNonSteeringPoints() {
    const scaledChunk = this.renderPoints(true);
    this.renderInsideOutsidePoints(scaledChunk, true);

    this.nonSteeringScreenPositions.push(...scaledChunk);
    return scaledChunk;
  }

  private updatePoints() {
    const steered = this.renderSteeringPoints();
    const nonSteered: ScaledCartesianCoordinate[] = [];

    if (this.props.showNonSteeringData) {
      nonSteered.push(...this.renderNonSteeringPoints());
    }

    return { steered, nonSteered };
  }

  private updateAxes() {
    this.renderAxes(true);
    this.renderAxes(false);
  }

  private getPointsInRegion(region: number[][], useNonSteeringData: boolean = false) {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }

    const x0 = region[0][0];
    const x3 = region[1][0];
    const y0 = region[0][1];
    const y3 = region[1][1];

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

  private updateNewPointsInCurrentSelection(newPoints: ScaledCartesianCoordinate[]) {
    const newPointsInSelection = this.getNewPointsInCurrentSelection(newPoints).map(d => d.values);
    const allPointsInSelection = this.getCurrentlyBrushedPoints().map(d => d.values);

    const newNonSteeredPoints = this.getLatestChunk(true);
    const newNonSteeredPointsInSelection = this.getNewPointsInCurrentSelection(newNonSteeredPoints, true);
    const allNonSteeredPointsInSelection = this.getCurrentlyBrushedPoints(true);

    if (newPointsInSelection.length > 0 && !!this.props.onNewPointsInSelection) {
      this.props.onNewPointsInSelection(newPointsInSelection, allPointsInSelection);
      this.props.onNewNonSteeredPointsInSelection(newNonSteeredPointsInSelection, allNonSteeredPointsInSelection);
    }
  }

  private updateQuadtrees(steeredChunk: ScaledCartesianCoordinate[], nonSteeredChunk: ScaledCartesianCoordinate[]) {
    if (!this.receivedNewData()) {
      return;
    }

    this.updateNewPointsInCurrentSelection(steeredChunk);
  }

  private renderDetailsPanel() {
    if (this.state.selectedPoint === null) {
      return null;
    }

    const datum: any = {};
    this.props.dimensions.forEach((dim: string, i: number) => {
      if (this.state.selectedPoint === null) {
        return;
      }

      datum[dim] = this.scales[i](this.state.selectedPoint.values[dim]);
    });

    return (
      <div className="detailsPanel" style={ { left: 10, top: 75 } }>
        <pre>
          { JSON.stringify(datum, null, 2) }
        </pre>
      </div>
    );
  }

  public render() {
    const scaledData = this.updatePoints();
    this.updateAxes();
    this.updateQuadtrees(scaledData.steered, scaledData.nonSteered);

    const canvasWidth = this.getCanvasWidth();
    const isNonSteeringCanvasVisible = this.props.showNonSteeringData ? 'visible' : 'hidden';

    this.lastChunk = this.getLatestChunk();

    return (
      <div className="starCoordinatesRenderer">
        { this.renderDetailsPanel() }
        <div className="left" style={ { width: canvasWidth }}>
          <canvas className="starCoordinateCanvas" width={ canvasWidth } height={ this.props.height } />
          <svg className="recentStarPointsCanvas" width={ canvasWidth } height={ this.props.height } />
          <svg className="starCoordinateAxesCanvas" width={ canvasWidth } height={ this.props.height }/>
        </div>
        <div className={`right ${isNonSteeringCanvasVisible}`} style={ { width: canvasWidth }}>
          <canvas className="nonSteeringStarCoordinateCanvas" width={ canvasWidth } height={ this.props.height } />
          <svg className="nonSteeringStarCoordinateAxesCanvas" width={ canvasWidth } height={ this.props.height }/>
          <svg className="recentNonSteeredStarPointsCanvas" width={ canvasWidth } height={ this.props.height } />
        </div>
      </div>
    );
  }

  public componentDidMount() {
    this.canvas = d3.select("canvas.starCoordinateCanvas");
    this.nonSteeringCanvas = d3.select("canvas.nonSteeringStarCoordinateCanvas");
    this.axesSvg = d3.select("svg.starCoordinateAxesCanvas");
    this.nonSteeringAxesSvg = d3.select("svg.nonSteeringStarCoordinateAxesCanvas");

    this.axesSvg.append("g")
      .attr("class", "container")
      .attr("transform", `translate(${this.state.margin}, ${this.state.margin})`);

    this.nonSteeringAxesSvg.append("g")
      .attr("class", "container")
      .attr("transform", `translate(${this.state.margin}, ${this.state.margin})`);

    this.axesSvg.call(this.brush as any);

    this.updateScales();
    this.updateAxes();

    this.props.onBrushedRegion([[0, 0], [0, 0]]);
  }

  public componentDidUpdate(oldProps: Props) {
    // commented out, because dummy_dimensions are used to provide the data, and the db-server also encodes the
    // if (oldProps.dimensions.length === 0 && this.props.dimensions.length > 0) {
    //   this.updateScales();
    //   this.renderAxes();
    // }
  }
}