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
  onBrushedPoints: (points: any[]) => any,
  onBrushedRegion: (extent: number[][]) => any
}
interface State {
  margin: number,
  brushedPoints: ScaledCartesianCoordinate[]
}

export default class RadVizRenderer extends React.Component<Props, State> {
  private canvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;
  private nonSteeringCanvas: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private brushSvg: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null;

  private lastChunk: any[] = [];

  private radVizGenerator: RadViz;
  private nonSteeredRadVizGenerator: RadViz;

  private steeringScreenPositions: ScaledCartesianCoordinate[];
  private nonSteeringScreenPositions: ScaledCartesianCoordinate[];

  private brush: d3.BrushBehavior<any>;

  public constructor(props: Props) {
    super(props);

    this.canvas = null;
    this.nonSteeringCanvas = null;
    this.brushSvg = null;

    this.steeringScreenPositions = [];
    this.nonSteeringScreenPositions = [];

    this.radVizGenerator = radviz();
    this.radVizGenerator.setRadiusPoints(0.25);
    this.radVizGenerator.setQuality();
    this.nonSteeredRadVizGenerator = radviz();
    this.nonSteeredRadVizGenerator.setRadiusPoints(0.25);
    this.nonSteeredRadVizGenerator.setQuality();


    this.brush = d3.brush()
      .on("start", null)
      .on("brush", null)
      .on("end", this.onBrushEnd.bind(this));

    this.state = {
      margin: 50,
      brushedPoints: []
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

    const scaleX = this.radVizGenerator.scaleX();
    const scaleY = this.radVizGenerator.scaleY();

    radVizGenerator.setFunctionClick((angles, datum, selection) => {
      console.log("pos:", scaleX(datum.x1), scaleY(datum.x2));
    });
    radVizGenerator.setFunctionUpdateResults((_) => {
      console.log("error value", _)
    });

    container.selectAll("*").remove();
    container.call(radVizGenerator as any);

    return [];
  }

  private renderSteeringPoints() {
    this.steeringScreenPositions = this.renderPoints(false);
  }

  private renderNonSteeringPoints() {
    this.nonSteeringScreenPositions = this.renderPoints(true);
  }

  private updatePoints() {
    this.renderSteeringPoints();
    this.renderNonSteeringPoints();
  }

  private renderDetailsPanel() {
    if (this.state.brushedPoints.length === 0) {
      return null;
    }

    return (
      <div className="detailsPanel" style={ { left: 10, top: 75 } }>
        <pre>
          { `Brushed ${this.state.brushedPoints.length} points.` }
        </pre>
      </div>
    );
  }

  private onBrushEnd() {
    if (this.canvas === null) {
      return;
    }

    const scaleX = this.radVizGenerator.scaleX();
    const scaleY = this.radVizGenerator.scaleY();
    const centerX = this.radVizGenerator.center().x;
    const centerY = this.radVizGenerator.center().y;

    const selection = d3.event.selection;

    if (selection === null) {
      this.setState({
        brushedPoints: []
      });
      return;
    }

    selection[0][0] -= centerX;
    selection[0][1] -= centerY;
    selection[1][0] -= centerX;
    selection[1][1] -= centerY;

    const brushedCoordinates: ScaledCartesianCoordinate[] = this.radVizGenerator.data().entries
      .map(entry => {
        return { px: scaleX(entry.x2), py: scaleY(entry.x1), values: entry };
      })
      .filter(point => {
        return point.px > selection[0][0]
            && point.px < selection[1][0]
            && point.py > selection[0][1]
            && point.py < selection[1][1];
      });

    const brushedData = brushedCoordinates.map(d => d.values.original);

    this.props.onBrushedPoints(brushedData);

    this.setState({
      brushedPoints: brushedCoordinates
    });
  }

  private addBrushBehavior() {
    if (this.brushSvg === null) {
      return;
    }

    this.brushSvg.call(this.brush as any);
  }

  public render() {
    this.updatePoints();

    const canvasWidth = this.getCanvasWidth();
    const isNonSteeringCanvasVisible = this.props.showNonSteeringData ? 'visible' : 'hidden';

    this.lastChunk = this.getLatestChunk();

    return (
      <div className="radVizRenderer">
        { this.renderDetailsPanel() }
        <div className="left">
          <div id="radVizCanvas" style={ { width: canvasWidth, height: this.props.height } }/>
          <svg className="radVizAxesCanvas" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width={ this.props.height } height={ this.props.height }>
          <svg className="recentStarPointsCanvas" width={ canvasWidth } height={ this.props.height } />
          </svg>
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
    this.brushSvg = d3.select("svg.radVizAxesCanvas");
    this.nonSteeringCanvas = d3.select("div#nonSteeringRadVizCanvas");

    this.addBrushBehavior();

    this.props.onBrushedRegion([[0, 0], [0, 0]]);
  }
}