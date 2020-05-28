import * as React from 'react';
import * as d3 from 'd3';
import "./EvaluationMetric.css";

interface Props {
  label: string,
  value: number
}
interface State {
  canvasVisible: boolean
}

const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 75;
const DEFAULT_PADDING = 30;
const DEFAULT_POINTS_SHOWN = 100;

export default class EvaluationMetric extends React.Component<Props, State> {
  private pastValues: [number, number][] = [];
  private scaleX = d3.scaleLinear().range([0, DEFAULT_WIDTH]);
  private scaleY = d3.scaleLinear().domain([0, 1]).range([DEFAULT_HEIGHT, 0]);
  private lineGenerator: d3.Line<[number, number]> = d3.line().curve(d3.curveNatural);

  constructor(props: Props) {
    super(props);

    this.lineGenerator
      .x((d, i) => this.scaleX(i))
      .y(d => this.scaleY(d[1]) + DEFAULT_PADDING/2);

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

  private updateTimeSeries() {
    const svg = d3.select(`#${this.getCanvasSelector()}`);

    this.scaleX.domain([0, this.pastValues.length]);

    svg.selectAll("*").remove();

    svg.append("path")
      .attr("class", "time")
      .attr("d", () => this.lineGenerator(this.pastValues))
  }

  public render() {
    const canvasLabel = this.state.canvasVisible ? '' : 'hidden';
    const activeLabel = this.state.canvasVisible ? 'active' : '';

    return (
      <div className={`evaluationMetric ${activeLabel}`} onClick={ this.toggleVisibility.bind(this) }>
        <span className="label">{ this.props.label }:</span>
        <span className="value">{ this.props.value }</span>
        <svg id={ this.getCanvasSelector() } className={ `canvas ${canvasLabel}` } width={ DEFAULT_WIDTH } height={ DEFAULT_HEIGHT + DEFAULT_PADDING }></svg>
      </div>
    );
  }

  public componentDidUpdate(previousProps: Props) {
    this.pastValues.push([this.pastValues.length, previousProps.value]);
    this.pastValues = this.pastValues.slice(this.pastValues.length - DEFAULT_POINTS_SHOWN);
    this.updateTimeSeries();
  }
}