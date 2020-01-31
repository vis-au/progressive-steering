import * as React from 'react';
import * as d3 from 'd3';
import "./DoubleSlider.css";

interface Props {
  label: string,
  min: number,
  max: number,
  width: number,
  height?: number,
  margin?: number,
  onSelection: (selection: number[]) => any
}
interface State {
  currentLowerBound: number,
  currentUpperBound: number
}

const DEFAULT_HEIGHT = 20;
const DEFAULT_MARGIN = 10;
const DEFAULT_TICK_NUMBER = 6;

export default class DoubleSlider extends React.Component<Props, State> {
  private scale: d3.ScaleLinear<number, number>;
  private brush: any;
  private selection: any;

  constructor(props: Props) {
    super(props);

    this.scale = d3.scaleLinear()
      .domain([this.props.min, this.props.max])
      .range([0, this.props.width]);
  }

  private renderAxis() {
    const axis = d3.axisTop(this.scale).ticks(DEFAULT_TICK_NUMBER);
    const height = this.props.height || DEFAULT_HEIGHT;
    const margin = this.props.margin || DEFAULT_MARGIN;
    const svg = d3.select(`#${this.props.label}`);

    svg.selectAll(".axis").remove();

    svg.select("g.boundary-scale").append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin},${height - 1})`)
      .call(axis);
  }

  private onBrush() {
    const [x0, x1] = d3.event.selection;

    this.selection = [ this.scale.invert(x0 - DEFAULT_MARGIN), this.scale.invert(x1 - DEFAULT_MARGIN) ];

    if (this.props.onSelection !== undefined) {
      this.props.onSelection(this.selection);
    }
  }

  private createBrush() {
    this.brush = d3.brushX()
      .extent([[DEFAULT_MARGIN, 0], [this.props.width + DEFAULT_MARGIN, this.props.height || DEFAULT_HEIGHT]])
      .on("brush", this.onBrush.bind(this));

    d3.select(`#${this.props.label}`).call(this.brush);
  }

  public render() {
    this.renderAxis();
    this.createBrush();

    return (
      <div className="double-slider-container">
        <label htmlFor={ this.props.label }>{ this.props.label }</label>
        <svg
          id={ this.props.label }
          className="double-slider"
          width={ this.props.width + 2*(this.props.margin || DEFAULT_MARGIN) }
          height={ this.props.height || DEFAULT_HEIGHT }>

          <g className="boundary-scale"></g>
        </svg>
      </div>
    );
  }
}