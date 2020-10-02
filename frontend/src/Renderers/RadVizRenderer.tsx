import * as React from 'react';
import { RadViz, radviz } from 'd3-radviz';
import * as d3 from 'd3';
import { ScaledCartesianCoordinate } from '../PointTypes';

import "./RadVizRenderer.css";

interface Props {
  width: number,
  height: number,
  dimensions: string[],
  extents: [number, number][],
  data: any[],
  nonSteeringData: any[],
  showNonSteeringData: boolean,
  showHeatMap: boolean,
  useDeltaHeatMap: boolean,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  onBrushedRegion: (extent: number[][]) => any,
}
interface State {
  margin: number,
}

export default class RadVizRenderer extends React.Component<Props, State> {
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringCanvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private lastChunk: any[] = [];

  private radVizGenerator: RadViz;
  private nonSteeredRadVizGenerator: RadViz;

  public constructor(props: Props) {
    super(props);

    this.canvas = null;
    this.nonSteeringCanvas = null;

    this.radVizGenerator = radviz();
    this.radVizGenerator.setRadiusPoints(0.25);
    this.radVizGenerator.setQuality();
    this.nonSteeredRadVizGenerator = radviz();
    this.nonSteeredRadVizGenerator.setRadiusPoints(0.25);
    this.nonSteeredRadVizGenerator.setQuality();

    this.state = {
      margin: 50
    };
  }

  private getCanvasWidth() {
    return this.props.showNonSteeringData
      ? this.props.width / 2 - 1
      : this.props.width;
  }

  private getLatestChunk(useNonSteeringData: boolean = false) {
    let itemCount = this.props.data.length;

    if (useNonSteeringData) {
      itemCount = this.props.nonSteeringData.length;
      return this.props.nonSteeringData.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
    }

    // if chunksize property is not defined, return the full dataset
    return this.props.data.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
  }

  private receivedNewData() {
    const chunk = this.getLatestChunk()

    if (chunk[0] !== undefined && chunk[0] === this.lastChunk[0]) {
      return false;
    }

    return true;
  }

  private renderPoints(useNonSteeringData: boolean = false): ScaledCartesianCoordinate[] {
    if (this.canvas === null) {
      return [];
    } else if (this.nonSteeringCanvas === null) {
      return [];
    } else if (!this.receivedNewData()) {
      return [];
    } else if (this.props.data.length === 0) {
      return [];
    }

    const radVizGenerator = useNonSteeringData
      ? this.nonSteeredRadVizGenerator
      : this.radVizGenerator;

    const container = useNonSteeringData
      ? this.nonSteeringCanvas
      : this.canvas;

    radVizGenerator.data(this.props.data);

    radVizGenerator.setFunctionClick((_) => {
      console.log("click", _)
    });
    radVizGenerator.setFunctionUpdateResults((_) => {
      console.log("error value", _)
    });

    container.selectAll("*").remove();
    container.call(radVizGenerator as any);

    return [];
  }

  private renderSteeringPoints() {
    this.renderPoints(false);
  }

  private renderNonSteeringPoints() {
    this.renderPoints(true);
  }

  private updatePoints() {
    this.renderSteeringPoints();
    this.renderNonSteeringPoints();
  }

  public render() {
    this.updatePoints();

    const canvasWidth = this.getCanvasWidth();
    const isNonSteeringCanvasVisible = this.props.showNonSteeringData ? 'visible' : 'hidden';

    this.lastChunk = this.getLatestChunk();

    return (
      <div className="radVizRenderer">
        <div className="left">
          <div id="radVizCanvas" style={ { width: canvasWidth, height: this.props.height } }/>
          <svg className="radVizAxesCanvas" width={ canvasWidth } height={ this.props.height }/>
          <svg className="recentStarPointsCanvas" width={ canvasWidth } height={ this.props.height } />
        </div>
        <div className={`right ${isNonSteeringCanvasVisible}`}>
          <div id="nonSteeringRadVizCanvas" style={ { width: canvasWidth, height: this.props.height } }/>
          <svg className="nonSteeringRadVizAxesCanvas" width={ canvasWidth } height={ this.props.height }/>
          <svg className="recentNonSteeredStarPointsCanvas" width={ canvasWidth } height={ this.props.height } />
        </div>
      </div>
    );
  }

  public componentDidMount() {
    this.canvas = d3.select("div#radVizCanvas");
    this.nonSteeringCanvas = d3.select("div#nonSteeringRadVizCanvas");

    this.props.onBrushedRegion([[0, 0], [0, 0]]);
  }
}