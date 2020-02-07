import * as React from 'react';
import * as d3 from "d3";

import "./MapViewer.css";

export type POI = {lon: number, lat: number, label: string};

interface Props {
  width: number,
  height: number,
  pois: POI[],
  initialPOI: POI | null,
  onPOISelected: (poi: POI) => any
}
interface State {
  selectedPOI: POI
}

export default class MapViewRenderer extends React.Component<Props, State> {
  private mapData: any = null;

  constructor(props: Props) {
    super(props);

    fetch("https://raw.githubusercontent.com/larsbouwens/nl-geojson/master/nl.geojson")
      .then(res => res.json())
      .then(data => this.mapData = data)
      .then(() => this.renderMap());

    this.state = {
      selectedPOI: this.props.initialPOI || this.props.pois[0]
    };
  }

  private selectPOI(poi: POI) {
    this.props.onPOISelected(poi);
    this.setState({
      selectedPOI: poi
    });
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

  private updateSelectedPOI() {
    d3.selectAll("svg.map-canvas .overlay circle.poi")
      .classed("selected", d => d === this.state.selectedPOI);
  }

  public render() {
    this.updateSelectedPOI();

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
    d3.select("svg.map-canvas .overlay").selectAll("circle.poi").data(this.props.pois)
      .join("circle")
        .attr("class", "poi")
        .attr("cx", d => d.lon)
        .attr("cy", d => d.lat)
        .attr("r", 10)
        .on("mouseenter", function() { d3.select(this).attr("r", 15) })
        .on("mouseout", function() { d3.select(this).attr("r", 10) })
        .on("click", this.selectPOI.bind(this));
  }
}