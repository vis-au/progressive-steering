import * as React from 'react';
import * as d3 from 'd3';

import './StarCoordinateRenderer.css';
import { debug } from 'console';

interface Props {
  width: number,
  height: number,
  dimensions: string[],
  extents: [number, number][],
  data: any[],
  // nonSteeringData: any[],
  // showNonSteeringData: boolean,
  // showHeatMap: boolean,
  // useDeltaHeatMap: boolean,
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

type CartesianCoordinate = {x: number, y: number};
type PolarCoordinate = {r: number, theta: number};

const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_POINT_COLOR = "rgba(70, 130, 180, 0.3)";
const DEFAULT_POINT_STROKE_WIDTH = 0;


export default class StarCoordinateRenderer extends React.Component<Props, State> {

  private svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private scales: d3.ScaleLinear<number, number>[] = [];

  private scaleX: d3.ScaleLinear<number, number>;
  private scaleY: d3.ScaleLinear<number, number>;

  private plotSize: number;

  constructor(props: Props) {
    super(props);

    this.scales = [];

    this.svg = null;
    this.canvas = null;

    this.state = {
      margin: 150
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

  private updateScales() {
    debugger
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

  private getStarCoordinatesForData() {
    const polarCoordinates: PolarCoordinate[][] = this.getDataInPolarCoordinates();
    const cartesianCoordinates: CartesianCoordinate[][] = this.getCartesianCoordinatesFromPolarCoordinates(polarCoordinates);

    const starCoordinates: CartesianCoordinate[] = [];
    cartesianCoordinates.forEach(cartesianCoordinate => {
      const x = cartesianCoordinate.reduce((sum, newValue) => sum + newValue.x, 0);
      const y = cartesianCoordinate.reduce((sum, newValue) => sum + newValue.y, 0);

      starCoordinates.push({ x, y });
    });

    return starCoordinates;
  }

  private renderPoints() {
    if (this.svg === null) {
      return;
    } else if (this.canvas === null) {
      return;
    }

    const starCoordinates = this.getStarCoordinatesForData();

    // const container = this.svg.select("g.container");

    // const points = container.append("g")
    //   .attr("class", "points")
    //   .attr("transform", `translate(${this.plotSize/2}, ${this.plotSize/2})`);

    // render points using svg
    // points.selectAll("circle.point").data(starCoordinates).enter().append("circle")
    //   .attr("class", "point")
    //   .attr("r", 5)
    //   .attr("fill-opacity", 0.3)
    //   .attr("cx", d => this.scaleX(d.x))
    //   .attr("cy", d => this.scaleY(d.y));

    const centerOffsetX = this.plotSize / 2 + this.state.margin;
    const centerOffsetY = this.plotSize / 2 + this.state.margin;

    const context: any = (this.canvas.node() as any).getContext("2d");

    context.fillStyle = DEFAULT_POINT_COLOR;
    context.strokeStyle = DEFAULT_POINT_COLOR;
    context.lineWidth = DEFAULT_POINT_STROKE_WIDTH;

    starCoordinates.forEach(datum => {
      const px = this.scaleX(datum.x) + centerOffsetX;
      const py = this.scaleY(datum.y) + centerOffsetY;

      context.beginPath();
      context.arc(px, py, DEFAULT_POINT_RADIUS, 0, 2 * Math.PI, true);
      context.fill();
      context.closePath();
    });
  }

  private renderAxes() {
    if (this.svg === null) {
      return;
    }

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

    const container = this.svg.select("g.container");

    const axes = container.append("g").attr("class", "axes");

    // enclosing circle
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

  public render() {
    this.renderPoints();

    return (
      <div className="starCoordinatesRenderer" style={ { width: this.props.width }}>
        <canvas className="starCoordinateCanvas" width={ this.props.width / 2 } height={ this.props.height } />
        <svg className="starCoordinateAxesCanvas" width={ this.props.width / 2 } height={ this.props.height }/>
      </div>
    );
  }

  public componentDidMount() {
    this.canvas = d3.select("canvas.starCoordinateCanvas");
    this.svg = d3.select("svg.starCoordinateAxesCanvas");

    this.svg.append("g")
      .attr("class", "container")
      .attr("transform", `translate(${this.state.margin}, ${this.state.margin})`);

    this.props.onBrushedRegion([[0, 0], [0, 0]]);
  }

  public componentDidUpdate(oldProps: Props) {
    if (oldProps.dimensions.length === 0 && this.props.dimensions.length > 0) {
      this.updateScales();
      this.renderAxes();
    }
  }
}