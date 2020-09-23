import * as React from 'react';
import * as d3 from 'd3';

import './StarCoordinateRenderer.css';
import HeatMapRenderer from './HeatMapRenderer';
import { CartesianCoordinate, PolarCoordinate, ScaledCartesianCoordinate } from './PointTypes';

interface Props {
  width: number,
  height: number,
  dimensions: string[],
  extents: [number, number][],
  data: any[],
  // nonSteeringData: any[],
  showNonSteeringData: boolean,
  showHeatMap: boolean,
  useDeltaHeatMap: boolean,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  // stepsBeforePaddingGrows: number,
  // onBrushedPoints?: (points: any[]) => any,
  onBrushedRegion: (extent: number[][]) => any,
  // onNewPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
  // onNewNonSteeredPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
}
interface State {
  margin: number
}

const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_POINT_COLOR = "rgba(70, 130, 180, 0.3)";
const NON_STEERING_POINT_COLOR = "rgba(30, 30, 30, 0.3)";
const DEFAULT_POINT_STROKE_WIDTH = 0;


export default class StarCoordinateRenderer extends React.Component<Props, State> {

  private axesSvg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringAxesSvg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringCanvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private scales: d3.ScaleLinear<number, number>[] = [];

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

    this.state = {
      margin: 50
    };

    this.plotSize = this.props.height - this.state.margin * 2;

    this.scaleX = d3.scaleLinear()
      .domain([-1, 1])
      .range([-this.plotSize / 2, this.plotSize / 2]);

    this.scaleY = d3.scaleLinear()
      .domain([-1, 1])
      .range([-this.plotSize / 2, this.plotSize / 2]);
  }

  private getLatestChunk() {
    let itemCount = this.props.data.length;

    // if chunksize property is not defined, return the full dataset
    return this.props.data.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
  }

  private getCanvasWidth() {
    return this.props.showNonSteeringData
      ? this.props.width / 2 - 1
      : this.props.width;
  }

  private receivedNewData() {
    const chunk = this.getLatestChunk()

    if (chunk[0] !== undefined && chunk[0] === this.lastChunk[0]) {
      return false;
    }

    return true;
  }

  private updateScales() {
    this.scales = this.props.extents.map(extent => {
      return d3.scaleLinear().domain(extent).range([0, 1]).clamp(true);
    });
  }

  private getDataInPolarCoordinates() {
    if (this.scales.length === 0) {
      this.updateScales();
    }

    const radians = 2 * Math.PI / this.props.dimensions.length;
    const polarCoordinates: PolarCoordinate[][] = [];
    const chunk = this.getLatestChunk();

    chunk.forEach(datum => {
      const polarCoordinate: PolarCoordinate[] = [];

      this.props.dimensions.forEach((dim, i) => {
        const theta = i * radians;

        if (datum[dim] === undefined) {
          polarCoordinate.push({ theta, r: 0 });
          return;
        }

        let r = this.scales[i](datum[dim]);

        if (isNaN(r)) {
          r = 0;
        }

        const newPoint = { theta, r };
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

        cartesianCoordinate.push({x, y, ...position });
      });

      cartesianCoordinates.push(cartesianCoordinate);
    });

    return cartesianCoordinates;
  }

  private getStarCoordinatesForData(useNonSteeringData: boolean) {
    const polarCoordinates: PolarCoordinate[][] = this.getDataInPolarCoordinates();
    const cartesianCoordinates: CartesianCoordinate[][] = this.getCartesianCoordinatesFromPolarCoordinates(polarCoordinates);

    const centerOffsetX = this.scaleX.invert(this.plotSize / 2 + this.state.margin);
    const centerOffsetY = this.scaleY.invert(this.plotSize / 2 + this.state.margin);

    const starCoordinates: CartesianCoordinate[] = [];
    cartesianCoordinates.forEach(cartesianCoordinate => {
      const x = cartesianCoordinate.reduce((sum, newValue) => sum + newValue.x, centerOffsetX);
      const y = cartesianCoordinate.reduce((sum, newValue) => sum + newValue.y, centerOffsetY);

      starCoordinates.push({ x, y });
    });

    return starCoordinates;
  }

  private getScaledCartesianCoordinatesForData(useNonSteeringData: boolean) {
    const starCoordinates = this.getStarCoordinatesForData(useNonSteeringData);

    const scaledStarCoordinates: ScaledCartesianCoordinate[] = [];
    starCoordinates.forEach(datum => {
      const px = this.scaleX(datum.x);
      const py = this.scaleY(datum.y);

      scaledStarCoordinates.push({ px, py });
    });

    return scaledStarCoordinates;
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

    this.steeringScreenPositions.push(...scaledChunk);
  }

  private renderNonSteeringPoints() {
    const scaledChunk = this.renderPoints(true);

    this.nonSteeringScreenPositions.push(...scaledChunk);
  }

  private updatePoints() {
    this.renderSteeringPoints();
    this.renderNonSteeringPoints();
  }

  public render() {
    this.updatePoints();

    const canvasWidth = this.getCanvasWidth();
    const isNonSteeringCanvasVisible = this.props.showNonSteeringData ? 'visible' : 'hidden';

    this.lastChunk = this.getLatestChunk();

    return (
      <div className="starCoordinatesRenderer">
        <div className="left" style={ { width: canvasWidth }}>
          <canvas className="starCoordinateCanvas" width={ canvasWidth } height={ this.props.height } />
          <svg className="starCoordinateAxesCanvas" width={ canvasWidth } height={ this.props.height }/>
        </div>
        <div className={`right ${isNonSteeringCanvasVisible}`} style={ { width: canvasWidth }}>
          <canvas className="nonSteeringStarCoordinateCanvas" width={ canvasWidth } height={ this.props.height } />
          <svg className="nonSteeringStarCoordinateAxesCanvas" width={ canvasWidth } height={ this.props.height }/>
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

    this.updateScales();
    this.renderAxes(true);
    this.renderAxes(false);

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