import * as React from 'react';
import * as d3 from "d3";

import "./MapViewer.css";

interface Props {
  width: number,
  height: number
}
interface State {
}

const pois = [
  {x: 600, y: 100, label: "poi 1"},
  {x: 700, y: 400, label: "poi 2"},
  {x: 660, y: 450, label: "poi 3"},
  {x: 576, y: 900, label: "poi 4"},
  {x: 544, y: 500, label: "poi 5"}
];

export default class MapViewRenderer extends React.Component<Props, State> {
  private mapData: any = null;

  constructor(props: Props) {
    super(props);

    fetch("https://raw.githubusercontent.com/larsbouwens/nl-geojson/master/nl.geojson")
      .then(res => res.json())
      .then(data => this.mapData = data)
      .then(() => this.renderMap());
  }

  public renderMap() {
    const svg = d3.select("svg.map-canvas g.map")

    const projection = d3.geoMercator()
      .fitExtent([[20, 20], [this.props.width, this.props.height]], this.mapData);

    const path = d3.geoPath().projection(projection);

    svg.append('g').selectAll('path')
      .data(this.mapData.features)
      .enter().append('path')
      .attr('d', path as any)
      .style('fill', 'white')
      .style('stroke', '#ccc');
  }

  public render() {
    return (
      <div className="map-view-component">
        <svg className="map-canvas" width={ this.props.width } height={ this.props.height }>
          <g className="map"></g>
          <g className="overlay"></g>
        </svg>
      </div>
    );
  }

  public componentDidMount() {
    d3.select("svg.map-canvas .overlay").selectAll("circle.poi").data(pois)
      .join("circle")
        .attr("class", "poi")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", 10)
        .on("mouseenter", function() { d3.select(this).attr("r", 15) })
        .on("mouseout", function() { d3.select(this).attr("r", 10) })
        .on("click", d => {

        });
  }
}