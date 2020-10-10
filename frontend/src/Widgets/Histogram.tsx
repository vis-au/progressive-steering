import * as React from 'react';
import * as d3 from 'd3';
import "./Histogram.css";

interface Props {
  label: string,
  min: number,
  max: number,
  width: number,
  height?: number,
  margin?: number,
  bins?: number[],
  selectedBins?: number[],
  onSelection: (selection: [number, number]) => any
}
interface State {
  currentLowerBound: number,
  currentUpperBound: number
}

const DEFAULT_HEIGHT = 20;
const DEFAULT_MARGIN = 10;
const DEFAULT_TICK_NUMBER = 6;

function id(label: string) {
  return label.toLowerCase().split(" ").join("_");
}

export default class Histogram extends React.Component<Props, State> {
  private scale: d3.ScaleLinear<number, number> = d3.scaleLinear();
  private brush: any;
  private selection: any;

  constructor(props: Props) {
    super(props);

    this.createBrush();
  }

  private createBrush() {
    this.brush = d3.brushX()
      .extent([[DEFAULT_MARGIN, 0], [this.props.width + DEFAULT_MARGIN, this.props.height || DEFAULT_HEIGHT]])
      .on("start brush", this.onBrush.bind(this))
      .on("end", this.onBrushEnd.bind(this));
  }

  private onBrush() {
    // "empty" filters or whenever the brush is destroyed by clicking
    if (!(d3.event.selection instanceof Array)) {
      return;
    }

    const [x0, x1] = d3.event.selection;

    this.selection = [ this.scale.invert(x0 - DEFAULT_MARGIN), this.scale.invert(x1 - DEFAULT_MARGIN) ];
  }

  private onBrushEnd() {
    if (this.selection[0] - this.selection[1] === 0) {
      this.selection = [];
    }

    if (this.props.onSelection !== undefined) {
      this.props.onSelection(this.selection);
    }
  }

  private updateScale() {
    this.scale
      .domain([this.props.min, this.props.max])
      .range([0, this.props.width]);
  }

  private renderAxis() {
    if (this.props.bins !== undefined) {
      return;
    }

    const axis = d3.axisTop(this.scale).ticks(DEFAULT_TICK_NUMBER);
    const height = this.props.height || DEFAULT_HEIGHT;
    const margin = this.props.margin || DEFAULT_MARGIN;
    const svg = d3.select(`#${id(this.props.label)}`);

    svg.selectAll(".axis").remove();

    svg.call(this.brush);

    svg.select("g.boundary-scale").append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin},${height - 1})`)
      .call(axis);
  }

  private renderHistogram() {
    if (this.props.bins === undefined) {
      return;
    }

    const svg = d3.select(`#${id(this.props.label)}`);
    const histogram = svg.select("g.histogram");

    const numberOfBins = this.props.bins.length;
    const numberOfSelectedBins = this.props.selectedBins === undefined
      ? 1
      : this.props.selectedBins.length;
    const binSize = this.props.width / numberOfBins;
    const maxValue = Math.max(...this.props.bins);

    const binScale = d3.scaleLinear()
      .domain([0, numberOfBins])
      .range([0, this.props.width]);

    const barScale = d3.scaleLinear()
      .domain([maxValue, 0])
      .range([0, this.props.height || DEFAULT_HEIGHT]);

    svg.call(this.brush);

    // histogram.selectAll("rect.bin").remove();

    histogram.selectAll("rect.bin").data(this.props.bins)
      .join("rect")
        .attr("class", "bin")
        .classed("empty-selection", numberOfSelectedBins === 1)
        .attr("width", binSize)
        .attr("height", d => barScale(0) - barScale(d))
        .attr("x", (d, i) => binScale(i + 1.5))
        .attr("y", barScale);


    if (this.props.selectedBins === undefined) {
      return;
    }

    const histogramOverlay = svg.select("g.selectionOverlay");
    histogramOverlay.selectAll("rect.bin").data(this.props.selectedBins)
      .join("rect")
        .attr("class", "bin")
        .attr("width", binSize)
        .attr("height", d => barScale(0) - barScale(d))
        .attr("x", (d, i) => binScale(i + 1.5))
        .attr("y", barScale);
  }

  public render() {
    this.updateScale();
    this.renderAxis();
    this.renderHistogram();

    return (
      <div className="histogram-container">
        <label htmlFor={ id(this.props.label) }>{ this.props.label }</label>
        <svg
          id={ id(this.props.label) }
          className="histogram-canvas"
          width={ this.props.width + 2*(this.props.margin || DEFAULT_MARGIN) }
          height={ this.props.height || DEFAULT_HEIGHT }>

          <g className="histogram"></g>
          <g className="selectionOverlay"></g>
          <g className="boundary-scale"></g>
        </svg>
      </div>
    );
  }
}