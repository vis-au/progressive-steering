import React from 'react';
import * as d3 from 'd3';

import "./ScatterplotRenderer.css";

interface State {
  brushedRegions: number[][][]
}
interface Props {
  width: number,
  height: number,
  dimensionX: string,
  dimensionY: string,
  extentX: number[],
  extentY: number[],
  data: any[],
  filters: Map<string, number[]>,
  onBrushedPoints?: (points: any[]) => any,
  onBrushedRegion?: (extent: number[][]) => any
}

export default class ScatterplotRenderer extends React.Component<Props, State> {
  private brush: any;
  private selection: any;

  private points: d3.Selection<SVGGElement, unknown, HTMLElement, any> | null;
  private circle: d3.Selection<any, any, d3.BaseType, unknown> | null;
  private svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private scaleX: d3.ScaleLinear<number, number>;
  private scaleY: d3.ScaleLinear<number, number>;

  constructor(props: Props) {
    super(props);

    this.brush = d3.brush()
      .on("start", this.onBrushStart.bind(this))
      .on("brush", this.onBrush.bind(this))
      .on("end", this.onBrushEnd.bind(this));

    this.svg = null;
    this.points = null;
    this.circle = null;
    this.selection = null;

    this.scaleX = d3.scaleLinear()
      .domain(this.props.extentX)
      .range([0, this.props.width]);

    this.scaleY = d3.scaleLinear()
      .domain(this.props.extentY)
      .range([0, this.props.height]);

    this.state = {
      brushedRegions: []
    };
  }

  private addCurrentSelectionToBrushedRegions() {
    if (this.selection === null) {
      return;
    }
    if (this.selection[0][0] - this.selection[1][0] === 0) {
      return;
    }

    const brushedRegions = this.state.brushedRegions;
    brushedRegions.push(this.selection);

    if (brushedRegions.length > 10) {
      brushedRegions.splice(0, 1);
    }

    this.setState({ brushedRegions });
  }

  private updateCurrentlySelectedPoints() {
    if (this.points === null) {
      return;
    }

    const brushedPoints: any[] = [];

    this.points.selectAll("circle.point.selected").each(d => {
      brushedPoints.push(d);
    });

    if (!!this.props.onBrushedPoints) {
      this.props.onBrushedPoints(brushedPoints);
    }
    if (!!this.props.onBrushedRegion) {
      this.props.onBrushedRegion(this.state.brushedRegions[this.state.brushedRegions.length - 1]);
    }
  }

  private onBrushStart() {
  }

  private onBrush() {
    if (this.circle === null) {
      return;
    }

    this.selection = d3.event.selection;

    if (this.selection === null) {
      this.circle.classed("selected", false);
    } else {
      const [[x0, y0], [x1, y1]] = this.selection;
      const selectedPoints: any[] = [];

      this.circle.classed("selected", (d) => {
        const x = this.scaleX(d[this.props.dimensionX]);
        const y = this.scaleY(d[this.props.dimensionY]);

        const selected = x0 <= x && x <= x1 && y0 <= y && y <= y1;

        if (selected) {
          selectedPoints.push(d);
        }

        return selected;
      });
    }
  }

  private onBrushEnd() {
    this.addCurrentSelectionToBrushedRegions();
    this.updateCurrentlySelectedPoints();
  }

  private updateScales() {
    if (this.svg === null) {
      return;
    }

    this.scaleX.domain(this.props.extentX);
    this.scaleY.domain(this.props.extentY);
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
      >
      </rect>
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

  private matchesFilter(datum: any) {
    let matchesFilter = true;
    const filters = this.props.filters;

    filters.forEach((extent, dim) => {
      // "empty" filters
      if (extent[0] - extent[1] === 0) {
        return;
      }
      if (extent === undefined) {
        return;
      }

      const value = datum[dim];
      matchesFilter = matchesFilter && value >= extent[0] && value <= extent[1];
    });

    return matchesFilter;
  }

  private renderPoints() {
    if (this.svg === null) {
      return;
    } else if (this.points === null) {
      return;
    }

    this.circle = this.points.selectAll("circle.point").data(this.props.data, (d: any) => d.id)
      .join("circle")
        .attr("class", "point")
        .attr("id", d => d.id)
        .attr("cx", d => this.scaleX(d[this.props.dimensionX]))
        .attr("cy", d => this.scaleY(d[this.props.dimensionY]));

    this.circle.attr("r", d => this.matchesFilter(d) ? 2 : 1);
  }

  public render() {
    this.updateScales();
    this.renderAxes();
    this.renderPoints();

    return (
      <svg className="scatterplotCanvas" width={ this.props.width } height={ this.props.height }>
        <g className="axes"></g>
        { this.renderBrushedRegions() }
      </svg>
    );
  }

  public componentDidMount() {
    this.svg = d3.select("svg.scatterplotCanvas");

    this.svg.append("g")
      .attr("class", "brush")
      .call(this.brush)
      .call(this.brush.move, [[100, 100], [200, 200]])
      .call(g => g.select(".overlay").style("cursor", "default"));

    this.points = this.svg.append("g").attr("class", "points");
  }
}