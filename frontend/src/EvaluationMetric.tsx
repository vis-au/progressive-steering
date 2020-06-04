import * as React from 'react';
import * as d3 from 'd3';
import "./EvaluationMetric.css";

interface Props {
  label: string,
  values: number[]
}
interface State {
  canvasVisible: boolean
}

const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 75;
const DEFAULT_PADDING = 30;
const DEFAULT_POINTS_SHOWN = 100;

export default class EvaluationMetric extends React.Component<Props, State> {
  private scaleX = d3.scaleLinear().range([0, DEFAULT_WIDTH]);
  private scaleY = d3.scaleLinear().domain([0, 1]).range([DEFAULT_HEIGHT, 0]);
  private lineGenerator: d3.Line<[number, number]> = d3.line().curve(d3.curveNatural);

  constructor(props: Props) {
    super(props);

    this.lineGenerator
      .x((d, i) => this.scaleX(i))
      .y(d => this.scaleY(d[1]));

    this.state = {
      canvasVisible: false
    }
  }

  private getCanvasSelector() {
    return `metric-timeseries-${ this.props.label.split(" ").join("") }`;
  }

  private toggleVisibility() {
    this.setState({ canvasVisible: !this.state.canvasVisible });
  }

  private updateAxes() {
    const container = d3.select(`#${this.getCanvasSelector()}`).select("g.content");
    container.selectAll("g.axis").remove();

    const yAxis = d3.axisRight(this.scaleY);
    container.append("g")
      .attr("class", "axis y")
      .call(yAxis);
  }

  private updateTimeSeries() {
    const svg = d3.select(`#${this.getCanvasSelector()}`);

    svg.selectAll("*").remove();
    const content = svg.append("g")
      .attr("class", "content")
      .attr("transform", `translate(${DEFAULT_PADDING/2},${DEFAULT_PADDING/2})`);

    content.append("path")
      .attr("class", "time")
      .attr("d", () => this.lineGenerator(this.props.values.map((d, i) => [i, d])));

    content.append("circle")
      .attr("class", "endpoint")
      .attr("r", 3)
      .attr("cx", this.scaleX(this.props.values.length - 1))
      .attr("cy", this.scaleY(this.props.values[this.props.values.length - 1]));
  }

  private updateScales() {
    this.scaleX.domain([0, this.props.values.length - 1]);
    const minY = d3.min(this.props.values) || 0;
    const maxY = d3.max(this.props.values) || 1;
    this.scaleY.domain([minY, maxY]);
  }

  public render() {
    const canvasLabel = this.state.canvasVisible ? '' : 'hidden';
    const activeLabel = this.state.canvasVisible ? 'active' : '';

    return (
      <div className={`evaluationMetric ${activeLabel}`} onClick={ this.toggleVisibility.bind(this) }>
        <span className="label">{ this.props.label }:</span>
        <span className="value">{ this.props.values[this.props.values.length - 1] }</span>
        <svg id={ this.getCanvasSelector() } className={ `canvas ${canvasLabel}` } width={ DEFAULT_WIDTH + DEFAULT_PADDING } height={ DEFAULT_HEIGHT + DEFAULT_PADDING }></svg>
      </div>
    );
  }

  public componentDidUpdate(previousProps: Props) {
    this.updateScales();
    this.updateTimeSeries();
    this.updateAxes();
  }
}