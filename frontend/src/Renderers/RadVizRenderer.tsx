import * as React from 'react';
import { RadViz, radviz } from 'd3-radviz';
import * as d3 from 'd3';
import { ScaledCartesianCoordinate } from '../PointTypes';

import "./RadVizRenderer.css";
import { DEFAULT_POINT_RADIUS } from './RendererDefaultParameters';

interface Props {
  width: number,
  height: number,
  dimensions: string[],
  extents: Map<string, [number, number]>,
  data: any[],
  nonSteeringData: any[],
  showNonSteeringData: boolean,
  highlightLastChunk?: boolean,
  chunkSize?: number,
  onBrushedPoints: (points: any[]) => any,
  onBrushedRegion: (extent: number[][]) => any
}
interface State {
  margin: number,
  brushedPoints: ScaledCartesianCoordinate[],
  selectedPoint: ScaledCartesianCoordinate | null
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
      brushedPoints: [],
      selectedPoint: null
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

  private getNewPointsInCurrentSelection(newPoints: any[], useNonSteeringData: boolean = false): any[] {
    return [];
  }

  private showDetails(d: ScaledCartesianCoordinate) {
    this.setState({ selectedPoint: d });
  }

  private hideDetails() {
    this.setState({ selectedPoint: null });
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

    radVizGenerator
      .ranges(this.props.extents)
      .data(this.props.data);

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

    const recentChunkIds = this.getLatestChunk().map(d => d.id);
    const recentChunkRadViz = radVizGenerator.data().entries
      .map(entry => {
        return { px: scaleX(entry.x2), py: scaleY(entry.x1), values: entry };
      })
      .filter(d => recentChunkIds.indexOf(d.values.original.id) > -1);

    return recentChunkRadViz;
  }

  private renderInsideOutsidePoints(chunk: ScaledCartesianCoordinate[], useNonSteeringData: boolean) {

    // no need to update if the chunk has not changed
    if (!this.receivedNewData()) {
      return;
    }

    const canvas = useNonSteeringData
      ? d3.select("svg.recentNonSteeredRadVizCanvas")
      : d3.select("svg.recentRadVizCanvas");

    canvas.selectAll("g.recent-points").remove();

    if (!this.props.highlightLastChunk) {
      return;
    }

    const center = this.radVizGenerator.center();
    const container = canvas.append("g")
      .attr("class", "recent-points")
      .attr("transform", `translate(${center.x},${center.y})`);

    const pointsInSelection = this.getNewPointsInCurrentSelection(chunk, useNonSteeringData);

    const points = container.selectAll("circle.recent-point").data(chunk)
      .join("circle")
        .attr("class", "recent-point")
        .classed("inside-selection", d => pointsInSelection.indexOf(d) > -1)
        .classed("steered", !useNonSteeringData)
        .attr("cx", d => d.px)
        .attr("cy", d => d.py)
        .attr("r", DEFAULT_POINT_RADIUS / 10)
        .on("mouseover", this.showDetails.bind(this))
        .on("mouseleave", this.hideDetails.bind(this))
        .style("stroke-width", 1);

    points.transition().duration(250)
      .attr("r", DEFAULT_POINT_RADIUS / 10);
  }

  private renderSteeringPoints() {
    const scaledChunk = this.renderPoints(false);
    this.renderInsideOutsidePoints(scaledChunk, false);

    this.steeringScreenPositions.push(...scaledChunk);
  }

  private renderNonSteeringPoints() {
    const scaledChunk = this.renderPoints(true);
    this.renderInsideOutsidePoints(scaledChunk, true);

    this.nonSteeringScreenPositions.push(...scaledChunk);
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
          <svg className="recentRadVizCanvas" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width={ this.props.height } height={ this.props.height } />
          <svg className="radVizAxesCanvas" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width={ this.props.height } height={ this.props.height } />
        </div>
        <div className={`right ${isNonSteeringCanvasVisible}`}>
          <div id="nonSteeringRadVizCanvas" style={ { width: canvasWidth, height: this.props.height } }/>
          <svg className="nonSteeringRadVizAxesCanvas" width={ canvasWidth } height={ this.props.height }/>
          <svg className="recentNonSteeredRadVizsCanvas" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width={ this.props.height } height={ this.props.height }/>
        </div>
      </div>
    );
  }

  public componentDidMount() {
    this.canvas = d3.select("div#radVizCanvas");
    this.brushSvg = d3.select("svg.radVizAxesCanvas");
    this.nonSteeringCanvas = d3.select("div#nonSteeringRadVizCanvas");

    this.brushSvg.call(this.brush as any);

    this.props.onBrushedRegion([[0, 0], [0, 0]]);
  }
}