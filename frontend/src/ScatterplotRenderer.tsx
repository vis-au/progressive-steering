import React from 'react';
import * as d3 from 'd3';

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
  chunkSize?: number,
  filters: Map<string, number[]>,
  onBrushedPoints?: (points: any[]) => any,
  onBrushedRegion?: (extent: number[][]) => any
}

const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_POINT_COLOR = "rgba(70, 130, 180, 0.3)";
const DEFAULT_POINT_STROKE_WIDTH = 0;
const DEFAULT_POINT_HIGHLIGHTED_STROKE_WIDTH = 5;

export default class ScatterplotRenderer extends React.Component<Props, State> {
  private brush: any;
  private selection: any;

  private svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private scaleX: d3.ScaleLinear<number, number>;
  private scaleY: d3.ScaleLinear<number, number>;

  private quadtree: d3.Quadtree<[number, number]>;

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
    this.scaleY.domain(this.props.extentY);
  }

  private getCurrentlyBrushedPoints() {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return [];
    }

    const currentlyBrushedPoints: any[] = [];
    const extent = this.selection;
    const dimX = this.props.dimensionX;
    const dimY = this.props.dimensionY;

    // this.quadtree.visit((node: any, x0, y0, x1, y1) => {
    //   if (!Array.isArray(node)) {
    //     do {
    //       let d = node.data;
    //       const inBounds =
    //         d[0] >= extent[0][0] &&
    //         d[0] < extent[1][0] &&
    //         d[1] >= extent[0][1] &&
    //         d[1] < extent[1][1];

    //       currentlyBrushedPoints.push(node);
    //     } while ((node = node.next));
    //   }
    //   return (
    //     x0 >= extent[1][0] ||
    //     y0 >= extent[1][1] ||
    //     x1 < extent[0][0] ||
    //     y1 < extent[0][1]
    //   );
    // });

    this.props.data.forEach(datum => {
      const x = this.scaleX(datum[dimX]);
      const y = this.scaleY(datum[dimY]);

      if (x > extent[0][0] && x < extent[1][0] && y > extent[0][1] && y < extent[1][1]) {
        currentlyBrushedPoints.push(datum);
      }
    });

    return currentlyBrushedPoints;
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

  private renderBrushedRegion(brushedRegion: number[][], index: number) {
    const x = brushedRegion[0][0];
    const y = brushedRegion[0][1];
    const width = Math.abs(brushedRegion[0][0] - brushedRegion[1][0]);
    const height = Math.abs(brushedRegion[0][1] - brushedRegion[1][1]);
    const opacity = index / this.state.brushedRegions.length + 0.1;

    return (
      <rect
        key={ index }
        className="brushedRegion"
        width={ width }
        height={ height }
        x={ x }
        y={ y }
        rx={ Math.max(width, height) * 0.01 }
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

    const itemCount = this.props.data.length;

    // if chunksize property is not defined, render the full dataset
    const chunk = this.props.data.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);

    this.quadtree.addAll(chunk);

    chunk.forEach(datum => {
      const px = this.scaleX(datum[dimX]);
      const py = this.scaleY(datum[dimY]);

      context.beginPath();
      context.arc(px, py, DEFAULT_POINT_RADIUS, 0, 2 * Math.PI, true);
      context.fill();
      context.closePath();
    });
  }

  public render() {
    this.updateScales();
    this.renderAxes();
    this.renderPoints();

    return (
      <div className="scatterplotRenderer" style={ { width: this.props.width } }>
        <canvas className="scatterplotCanvas" width={ this.props.width } height={ this.props.height }></canvas>
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
      .call(this.brush.move, [[100, 100], [200, 200]])
      .call(g => g.select(".overlay").style("cursor", "default"));
  }
}