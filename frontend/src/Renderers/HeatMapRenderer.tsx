import * as React from 'react';
import * as d3 from 'd3';

import { ScaledCartesianCoordinate } from '../PointTypes';

import './HeatMapRenderer.css';

interface Props {
  canvasWidth: number,
  height: number,
  scaleX: d3.ScaleLinear<number, number>,
  scaleY: d3.ScaleLinear<number, number>,
  steeredData: ScaledCartesianCoordinate[],
  nonSteeredData: ScaledCartesianCoordinate[],
  showNonSteeredCanvas: boolean,
  useDeltaHeatMap: boolean
}
interface State {
}

const BINS_X = 15;
const BINS_Y = 10;
const DEFAULT_DIVERGING_COLOR_SCHEME = d3.interpolateRdBu;
const DEFAULT_SEQUENTIAL_COLOR_SCHEME = d3.interpolateYlOrRd;

export default class HeatMapRenderer extends React.Component<Props, State> {
  private binScaleX: d3.ScaleQuantize<number> = d3.scaleQuantize();
  private binScaleY: d3.ScaleQuantize<number> = d3.scaleQuantize();

  constructor(props: Props) {
    super(props);

    this.binScaleX
      .domain(props.scaleX.range() as [number, number])
      .range(d3.range(BINS_X));

    this.binScaleY
      .domain(props.scaleY.range() as [number, number])
      .range(d3.range(BINS_Y));
  }

  private getBinnedData(useSteeredData: boolean) {
    const bins: number[][] = [];

    // initialize every cell of the matrix with 0
    d3.range(0, BINS_Y).forEach(y => {
      const nextBin: number[] = [];
      d3.range(0, BINS_X).forEach(x => {
        nextBin.push(0);
      });
      bins.push(nextBin);
    });

    const data = useSteeredData
      ? this.props.steeredData
      : this.props.nonSteeredData;

    data.forEach((d: ScaledCartesianCoordinate) => {
      const x = this.binScaleX(d.px);
      const y = this.binScaleY(d.py);

      bins[y][x] += 1;
    });

    return bins;
  }

  private getDifferenceBins(useNonSteeredData: boolean = false) {
    // steeredbins and nonsteeredbins are expected to have the same "resolution"
    const steeredBins: number[][] = this.getBinnedData(true);
    const nonSteeredBins: number[][] = this.getBinnedData(false);

    const differenceBins: number[][] = [];

    steeredBins.forEach((row, y) => {
      const rowDiff: number[] = [];

      row.forEach((steeredValue, x) => {
        const nonSteeredValue = nonSteeredBins[y][x];

        let diff = useNonSteeredData ? nonSteeredValue : steeredValue;

        if (this.props.useDeltaHeatMap) {
          diff = useNonSteeredData
            ? nonSteeredValue - steeredValue
            : steeredValue - nonSteeredValue;
        }

        rowDiff.push(diff);
      });

      differenceBins.push(rowDiff);
    });

    return differenceBins;
  }

  private updateCells(useNonSteeringCanvas: boolean = false) {
    this.binScaleX.domain(this.props.scaleX.range() as [number, number]);
    this.binScaleY.domain(this.props.scaleY.range() as [number, number]);

    const svg = useNonSteeringCanvas
      ? d3.select("svg.heat-map-canvas.non-steering")
      : d3.select("svg.heat-map-canvas.steering");

    svg.selectAll("*").remove();

    const bins = this.getDifferenceBins(useNonSteeringCanvas);
    const binsFlat = bins.flat();

    const positionX = d3.scaleLinear().domain([0, BINS_X]).range([0, this.props.canvasWidth]);
    const positionY = d3.scaleLinear().domain([0, BINS_Y]).range([0, this.props.height]);

    let scaleColor: d3.ScaleDiverging<string> | d3.ScaleSequential<string> = d3.scaleSequential(DEFAULT_SEQUENTIAL_COLOR_SCHEME)
    .clamp(true)
    .domain([0, 200]);

    if (this.props.useDeltaHeatMap) {
      scaleColor = d3.scaleDiverging(DEFAULT_DIVERGING_COLOR_SCHEME)
        .clamp(true)
        .domain([100, 0, -100]);
    }

    svg.selectAll("rect.density").data(binsFlat).join("rect")
      .attr("class", "density")
      .attr("x", (d, i) => positionX(i % BINS_X))
      .attr("y", (d, i) => positionY(Math.floor((i) / BINS_X)))
      .attr("width", this.props.canvasWidth / BINS_X - 2)
      .attr("height", this.props.height / BINS_Y - 2)
      .attr("fill", d => scaleColor(d))
      .attr("fill-opacity", 0.3)
      .attr("stroke", "white");

    svg.selectAll("text.density").data(binsFlat).join("text")
      .attr("class", "density")
      .attr("x", (d, i) => positionX(i % BINS_X))
      .attr("y", (d, i) => positionY(Math.floor((i) / BINS_X)))
      .attr("font-size", 8)
      .attr("dy", 8)
      .text(d => d);
  }

  public render() {
    const isNonSteeringCanvasHidden = this.props.showNonSteeredCanvas ? "" : "hidden";

    return (
      <div className="heatMapRenderer">
        <svg className="heat-map-canvas steering" width={ this.props.canvasWidth } height={ this.props.height }></svg>
        <svg className={`heat-map-canvas non-steering ${isNonSteeringCanvasHidden}`} width={ this.props.canvasWidth } height={ this.props.height }></svg>
      </div>
    );
  }

  public componentDidUpdate() {
    this.updateCells();

    if (this.props.showNonSteeredCanvas) {
      this.updateCells(true);
    }
  }
}