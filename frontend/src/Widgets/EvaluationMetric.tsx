import * as React from 'react';
import * as d3 from 'd3';

import { TrainingState } from '../Data/EelBridge';

import "./EvaluationMetric.css";

interface Props {
  label: string,
  values: number[],
  trainingStates: TrainingState[],
  canvasVisible?: boolean,
  onClick: () => void
}
interface State {
}

const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 75;
const DEFAULT_VERTICAL_PADDING = 30;
const DEFAULT_HORIZONTAL_PADDING = 70;
const INDICATOR_LINE_WIDTH = 5;

export default class EvaluationMetric extends React.Component<Props, State> {
  private scaleX = d3.scaleLinear().range([0, DEFAULT_WIDTH]);
  private scaleY = d3.scaleLinear().domain([0, 1]).range([DEFAULT_HEIGHT, 0]);
  private lineGenerator: d3.Line<[number, number]> = d3.line().curve(d3.curveStep);

  constructor(props: Props) {
    super(props);

    this.lineGenerator
      .x((d, i) => this.scaleX(i))
      .y(d => this.scaleY(d[1]));
  }

  private getCanvasSelector() {
    return `metric-timeseries-${ this.props.label.split(" ").join("") }`;
  }

  private toggleVisibility() {
    this.props.onClick();
  }

  private updateAxes() {
    const container = d3.select(`#${this.getCanvasSelector()}`).select("g.content");
    container.selectAll("g.axis").remove();

    const yAxis = d3.axisLeft(this.scaleY).ticks(5);
    container.append("g")
      .attr("class", "axis y")
      .call(yAxis);
  }

  private updateTimeSeries() {
    const svg = d3.select(`#${this.getCanvasSelector()}`);

    svg.selectAll("*").remove();
    const content = svg.append("g")
      .attr("class", "content")
      .attr("transform", `translate(${DEFAULT_HORIZONTAL_PADDING/2},${DEFAULT_VERTICAL_PADDING/2})`);

    content.append("path")
      .attr("class", "time")
      .attr("d", () => this.lineGenerator(this.props.values.map((d, i) => [i, d])));

    content.append("circle")
      .attr("class", "endpoint")
      .attr("r", 3)
      .attr("cx", this.scaleX(this.props.values.length - 1))
      .attr("cy", this.scaleY(this.props.values[this.props.values.length - 1]));
  }

  private updateStatusIndicator() {
    const container = d3.select(`#${this.getCanvasSelector()}`).select("g.content");
    container.selectAll("g.state-indicator");

    const stateIndicator = container.append("g")
      .attr("class", "state-indicator")
      .attr("transform", `translate(0,${this.scaleY.range()[0] + 10})`);

    stateIndicator.selectAll("line.indicator").data(this.props.trainingStates).join("line")
      .attr("class", d => `indicator ${d}`)
      .attr("x1", (d, i) => this.scaleX.range()[1] * (i/this.props.trainingStates.length))
      .attr("x2", (d, i) => this.scaleX.range()[1] * ((i+1)/this.props.trainingStates.length))
      .attr("stroke-width", INDICATOR_LINE_WIDTH);
  }

  private updateScales() {
    this.scaleX.domain([0, this.props.values.length - 1]);
    const minY = d3.min(this.props.values) || 0;
    const maxY = d3.max(this.props.values) || 1;
    this.scaleY.domain([minY, maxY]);
  }

  public render() {
    const canvasLabel = this.props.canvasVisible ? '' : 'hidden';
    const activeLabel = this.props.canvasVisible ? 'active' : '';

    return (
      <div className={`evaluationMetric ${activeLabel}`} onClick={ this.toggleVisibility.bind(this) }>
        <span className="label">{ this.props.label }:</span>
        <span className="value">{ this.props.values[this.props.values.length - 1] }</span>
        <svg id={ this.getCanvasSelector() } className={ `canvas ${canvasLabel}` } width={ DEFAULT_WIDTH + DEFAULT_HORIZONTAL_PADDING } height={ DEFAULT_HEIGHT + DEFAULT_VERTICAL_PADDING }></svg>
      </div>
    );
  }

  public componentDidUpdate(previousProps: Props) {
    this.updateScales();
    this.updateTimeSeries();
    this.updateStatusIndicator();
    this.updateAxes();
  }
}