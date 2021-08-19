import { select, range } from 'd3';
import * as React from 'react';
import "./ColorLegend.css";

interface Props {
  id: string,
  colorScale: d3.ScaleDiverging<string> | d3.ScaleSequential<string>,
  x?: number,
  y?: number,
  mode: "vertical" | "horizontal",
  alignment: "left" | "right",
  width: number,
  height: number,
  padding: number,
  steps: number,
}
interface State {
}

const FONT_SIZE = 12;

export default class ColorLegend extends React.Component<Props, State> {
  private updateColorScale() {
    const container = select(`svg#${this.props.id}-legend`);

    container.selectAll("*").remove();

    container.append("rect")
      .attr("width", this.props.width)
      .attr("height", this.props.height)
      .attr("fill", "rgba(255,255,255,0.3)")

    const values = container.append("g")
      .attr("class", "color-values");

    const domain = this.props.colorScale.domain();
    const min = domain[0];
    const max = domain[domain.length - 1] // could be diverging scale with 3 entries in domain
    const step = (max - min)/this.props.steps

    const boxes = range(min, max, step);
    boxes.push(boxes[boxes.length - 1] + step);
    const boxSize = this.props.height / boxes.length;
    const w = this.props.width - this.props.padding;
    const h = boxSize;

    const box = values.selectAll("g.box").data(boxes).join("g")
      .attr("class", "box")
      .attr("transform", (d, i) => `translate(${this.props.padding},${i * boxSize})`);

    box.append("rect")
      .attr("width", w)
      .attr("height", h)
      .attr("fill", d => this.props.colorScale(d));

    box.append("text")
      .attr("font-size", FONT_SIZE)
      .attr("text-anchor", this.props.alignment === "left" ? "start" : "end")
      .attr("transform", `translate(${-5},${h/2 + FONT_SIZE/2})`)
      .text(d => Math.round(d))
  }

  public render() {
    this.updateColorScale();

    return (
      <div className="color-legend" style={{ left: this.props.x || 0, top: this.props.y || 0 }}>
        <svg
          id={ `${this.props.id}-legend` }
          width={ this.props.width }
          height={ this.props.height }
        />
      </div>
    );
  }
}