import * as React from 'react';
import * as d3 from "d3";

import "./MapViewer.css";

export type POI = {lon: number, lat: number, label: string};

interface Props {
  width: number,
  height: number,
  pois: POI[],
  initialPOI: POI | null,
  buttonWidth?: number,
  onPOISelected: (poi: POI) => any
}
interface State {
  selectedPOI: POI,
  mapVisible: boolean
}

// src: https://opendata.paris.fr/explore/dataset/arrondissements/information/?location=12,48.85889,2.34692&basemap=jawg.streets&dataChart=eyJxdWVyaWVzIjpbeyJjb25maWciOnsiZGF0YXNldCI6ImFycm9uZGlzc2VtZW50cyIsIm9wdGlvbnMiOnt9fSwiY2hhcnRzIjpbeyJhbGlnbk1vbnRoIjp0cnVlLCJ0eXBlIjoiY29sdW1uIiwiZnVuYyI6IkFWRyIsInlBeGlzIjoibl9zcV9hciIsInNjaWVudGlmaWNEaXNwbGF5Ijp0cnVlLCJjb2xvciI6IiMwMDMzNjYifV0sInhBeGlzIjoibl9zcV9hciIsIm1heHBvaW50cyI6NTAsInNvcnQiOiIifV0sInRpbWVzY2FsZSI6IiIsImRpc3BsYXlMZWdlbmQiOnRydWUsImFsaWduTW9udGgiOnRydWV9
const parisGeo = require("./arrondissements.geo.json");

export default class MapViewRenderer extends React.Component<Props, State> {
  private mapData: any = null;
  private buttonWidth: number = 75;

  constructor(props: Props) {
    super(props);

    fetch("https://raw.githubusercontent.com/larsbouwens/nl-geojson/master/nl.geojson")
      .then(res => res.json())
      .then(data => {
        this.mapData = parisGeo;
      })
      .then(() => this.renderMap());

    this.buttonWidth = this.props.buttonWidth || this.buttonWidth;

    this.state = {
      selectedPOI: this.props.initialPOI || this.props.pois[0],
      mapVisible: false
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
      .style('fill', '#333')
      .style('stroke', '#ccc');
  }

  private updateSelectedPOI() {
    d3.selectAll("svg.map-canvas .overlay circle.poi")
      .classed("selected", d => d === this.state.selectedPOI);
  }

  private toggleMap() {
    this.setState({ mapVisible: !this.state.mapVisible })
  }

  public render() {
    this.updateSelectedPOI();

    return (
      <div className="map-view-component"
        style={ { width: this.state.mapVisible ? this.props.width : this.buttonWidth } }>
        <svg
          className="map-canvas"
          width={ this.props.width }
          height={ this.props.height }
          style={{display: this.state.mapVisible ? "block" : "none" }}>
          <g className="map"></g>
          <g className="overlay"></g>
        </svg>
        <button
          className="toggle-map"
          style={{ width: this.buttonWidth }}
          onClick={ this.toggleMap.bind(this) }>
            POI Map
        </button>
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