import * as React from 'react';
import * as d3 from 'd3';

import './HeatMapRenderer.css';

interface Props {
  width: number,
  height: number,
  dimensionX: string | null,
  dimensionY: string | null,
  scaleX: d3.ScaleLinear<number, number>,
  scaleY: d3.ScaleLinear<number, number>,
  data: any[],
  showNonSteeringData: boolean;
  highlightLastChunk?: boolean,
  chunkSize?: number,
}
interface State {
}

const BINS_X = 10;
const BINS_Y = 10;

export default class HeatMapRenderer extends React.Component<Props, State> {
  private binScaleX: d3.ScaleQuantize<number> = d3.scaleQuantize();
  private binScaleY: d3.ScaleQuantize<number> = d3.scaleQuantize();

  constructor(props: Props) {
    super(props);

    this.binScaleX
      .domain(props.scaleX.range() as [number, number])
      .range(d3.range(BINS_X).reverse());

    this.binScaleY
      .domain(props.scaleY.range() as [number, number])
      .range(d3.range(BINS_Y));
  }

  private getBinnedData() {
    const bins: number[][] = [];

    // initialize every cell of the matrix with 0
    d3.range(0, BINS_Y).map(y => {
      const nextBin: number[] = [];
      d3.range(0, BINS_X).map(x => {
        nextBin.push(0);
      });
      bins.push(nextBin);
    });

    const scaleX = this.props.scaleX;
    const scaleY = this.props.scaleY;

    this.props.data.forEach(d => {
      if (this.props.dimensionX === null || this.props.dimensionY === null) {
        return;
      }

      const x = this.binScaleX(scaleX(d[this.props.dimensionX]));
      const y = this.binScaleY(scaleY(d[this.props.dimensionY]));

      bins[y][x] += 1;
    });

    return bins;
  }

  private updateCells() {
    if (this.props.dimensionX === null || this.props.dimensionY === null) {
      return;
    }

    const svg = d3.select("svg.heat-map");
    svg.selectAll("*").remove();

    const bins = this.getBinnedData();
    const binsFlat = bins.flat();

    const positionX = d3.scaleLinear().domain([0, BINS_X]).range([0, this.props.width]);
    const positionY = d3.scaleLinear().domain([0, BINS_Y]).range([0, this.props.height]);
    const scaleColor = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(binsFlat) || 1]);

    svg.selectAll("rect.density").data(binsFlat).join("rect")
      .attr("class", "density")
      .attr("x", (d, i) => positionX(i % BINS_X))
      .attr("y", (d, i) => positionY(Math.floor((i) / BINS_X)))
      .attr("width", this.props.width / BINS_X)
      .attr("height", this.props.height / BINS_Y)
      .attr("fill", d => scaleColor(d))
      .attr("fill-opacity", 0.3)
      .attr("stroke", "white");

    svg.selectAll("text.density").data(binsFlat).join("text")
      .attr("class", "density")
      .attr("x", (d, i) => positionX(i % BINS_Y))
      .attr("y", (d, i) => positionY(Math.floor((i) / BINS_Y)))
      .attr("font-size", 8)
      .attr("dy", 8)
      .text(d => d);
  }

  public render() {
    return (
      <div className="heatMapRenderer">
        <svg className="heat-map" width={ this.props.width } height={ this.props.height }></svg>
      </div>
    );
  }

  public componentDidUpdate() {
    this.updateCells();
  }
}