import * as React from 'react';
import { RadViz, radviz } from 'd3-radviz';
import * as d3 from 'd3';

import { ScaledCartesianCoordinate } from '../PointTypes';
import { DEFAULT_POINT_RADIUS } from './RendererDefaultParameters';

import "./RadVizRenderer.css";

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
  onBrushedRegion: (extent: number[][]) => any,
  onNewPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
  onNewNonSteeredPointsInSelection: (currentPoints: any[], allPoints?: any[]) => any,
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
  private selection: any;

  public constructor(props: Props) {
    super(props);

    this.canvas = null;
    this.nonSteeringCanvas = null;
    this.brushSvg = null;
    this.selection = null;

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
    // in case the latest chunk is empty (for example as a side-effect of when the steering phase
    // ends and no points are returned, prevent slice() to return the entire dataset)
    if  (this.props.chunkSize === 0) {
      return [];
    }

    let itemCount = this.props.data.length;

    if (useNonSteeringData) {
      itemCount = this.props.nonSteeringData.length;
      return this.props.nonSteeringData.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
    }

    // if chunksize property is not defined, return the full dataset
    return this.props.data.slice(itemCount - (this.props.chunkSize || itemCount), itemCount);
  }

  private isNodeInBounds(node: ScaledCartesianCoordinate, bounds: number[][]) {
    return (
      node.px >= bounds[0][0] &&
      node.px < bounds[1][0] &&
      node.py >= bounds[0][1] &&
      node.py < bounds[1][1]
    );
  }

  private getNewPointsInCurrentSelection(newPoints: ScaledCartesianCoordinate[], useNonSteeringData: boolean = false): any[] {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }

    const pointsInSelection: ScaledCartesianCoordinate[] = [];

    newPoints.forEach(datum => {
      if (this.isNodeInBounds(datum, this.selection)) {
        pointsInSelection.push(datum);
      }
    });

    return pointsInSelection;
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

  private onBrushEnd() {
    if (this.canvas === null) {
      return;
    }

    const scaleX = this.radVizGenerator.scaleX();
    const scaleY = this.radVizGenerator.scaleY();
    const centerX = this.radVizGenerator.center().x;
    const centerY = this.radVizGenerator.center().y;

    this.selection = d3.event.selection || null;

    if (this.selection === null) {
      this.setState({
        brushedPoints: []
      });
      return;
    }

    this.selection[0][0] -= centerX;
    this.selection[0][1] -= centerY;
    this.selection[1][0] -= centerX;
    this.selection[1][1] -= centerY;

    const brushedCoordinates: ScaledCartesianCoordinate[] = this.radVizGenerator.data().entries
      .map(entry => {
        return { px: scaleX(entry.x2), py: scaleY(entry.x1), values: entry };
      })
      .filter(point => {
        return point.px > this.selection[0][0]
            && point.px < this.selection[1][0]
            && point.py > this.selection[0][1]
            && point.py < this.selection[1][1];
      });

    const brushedData = brushedCoordinates.map(d => d.values.original);

    this.props.onBrushedPoints(brushedData);

    this.setState({
      brushedPoints: brushedCoordinates
    });
  }

  private getPointsInRegion(region: number[][], useNonSteeringData: boolean = false) {
    if (this.selection === null || this.selection.length === 0) {
      return [];
    }

    const x0 = region[0][0];
    const x3 = region[1][0];
    const y0 = region[0][1];
    const y3 = region[1][1];

    const data = useNonSteeringData
      ? this.nonSteeringScreenPositions
      : this.steeringScreenPositions;

    const pointsInRegion: ScaledCartesianCoordinate[] = data.filter(d => {
      return d.px >= x0 && d.px <= x3 && d.py >= y0 && d.py <= y3;
    });

    return pointsInRegion;
  }

  private getCurrentlyBrushedPoints(useNonSteeringData: boolean = false) {
    const extent = this.selection;

    if (!extent) {
      return [];
    }

    const currentlyBrushedPoints = this.getPointsInRegion(extent, useNonSteeringData);

    return currentlyBrushedPoints;
  }

  private updateNewPointsInCurrentSelection(newPoints: ScaledCartesianCoordinate[]) {
    const newPointsInSelection = this.getNewPointsInCurrentSelection(newPoints).map(d => d.values.original);
    const allPointsInSelection = this.getCurrentlyBrushedPoints().map(d => d.values.original);

    const newNonSteeredPoints = this.getLatestChunk(true);
    const newNonSteeredPointsInSelection = this.getNewPointsInCurrentSelection(newNonSteeredPoints, true);
    const allNonSteeredPointsInSelection = this.getCurrentlyBrushedPoints(true);

    if (newPointsInSelection.length > 0 && !!this.props.onNewPointsInSelection) {
      this.props.onNewPointsInSelection(newPointsInSelection, allPointsInSelection);
      this.props.onNewNonSteeredPointsInSelection(newNonSteeredPointsInSelection, allNonSteeredPointsInSelection);
    }
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

    const renderData = this.props.data.map(d => {
      const datum: any = {};
      datum.id = d.id;
      this.props.dimensions.forEach(dim => {
        datum[dim] = d[dim];
      });
      return datum;
    });
    radVizGenerator.data(renderData);

    const scaleX = this.radVizGenerator.scaleX();
    const scaleY = this.radVizGenerator.scaleY();

    radVizGenerator.setFunctionClick((angles, datum, selection) => {
      console.log("pos:", scaleX(datum.x1), scaleY(datum.x2));
    });
    radVizGenerator.setFunctionUpdateResults((_) => {
      console.log("error value", _)
    });

    container.selectAll("*").remove();

    if (!useNonSteeringData || this.props.showNonSteeringData) {
      container.call(radVizGenerator as any);
    }

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
    } else if (useNonSteeringData && !this.props.showNonSteeringData) {
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

    return scaledChunk;
  }

  private renderNonSteeringPoints() {
    const scaledChunk = this.renderPoints(true);
    this.renderInsideOutsidePoints(scaledChunk, true);

    this.nonSteeringScreenPositions.push(...scaledChunk);

    return scaledChunk;
  }

  private updateQuadtrees(steeredChunk: ScaledCartesianCoordinate[], nonSteeredChunk: ScaledCartesianCoordinate[]) {
    if (!this.receivedNewData()) {
      return;
    }

    this.updateNewPointsInCurrentSelection(steeredChunk);
  }

  private updatePoints() {
    const steered = this.renderSteeringPoints();
    const nonSteered = this.renderNonSteeringPoints();

    return { steered, nonSteered };
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

  private renderBrushedRegion(brushedRegion: number[][], index: number) {
    const x = brushedRegion[0][0];
    const y = brushedRegion[0][1];
    const width = Math.abs(brushedRegion[0][0] - brushedRegion[1][0]);
    const height = Math.abs(brushedRegion[0][1] - brushedRegion[1][1]);
    const opacity = 1;

    return (
      <rect
        key={ index }
        className="brushedRegion"
        width={ width }
        height={ height }
        x={ x }
        y={ y }
        strokeOpacity={ opacity }
        fillOpacity={ opacity }
      />
    );
  }

  private renderBrushedRegions() {
    if (this.selection === null) {
      return null;
    }

    // 50, 50 translate necessary because the viewport is scaled to 100, 100 with xmidyxmid meet
    return (
      <g className="brushed-regions" transform={ `translate(50, 50)` }>
        { this.renderBrushedRegion(this.selection, 0) }
      </g>
    );
  }

  public render() {
    const scaledData = this.updatePoints();
    this.updateQuadtrees(scaledData.steered, scaledData.nonSteered);

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
          <svg className="nonSteeringRadVizAxesCanvas" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width={ canvasWidth } height={ this.props.height }>{ this.renderBrushedRegions() }</svg>
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
  }
}