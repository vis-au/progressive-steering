import * as React from 'react';

import { EelDataAdapter, getPOIs } from '../Data/DataAdapter';
import { getXDimension, getYDimension, ScenarioPreset } from '../Data/EelBridge';
import { BrushMode } from '../Renderers/BrushMode';
import RadVizRenderer from '../Renderers/RadVizRenderer';
import { Renderer } from '../Renderers/Renderers';
import ScatterplotRenderer from '../Renderers/ScatterplotRenderer';
import StarCoordinateRenderer from '../Renderers/StarCoordinateRenderer';
import TernaryPlotRenderer from '../Renderers/TernaryPlotRenderer';
import Alternatives from '../Widgets/Alternatives';
import MapViewRenderer, { POI } from '../Widgets/MapViewer';

import './MainView.css';

interface Props {
  activeRenderer: Renderer,
  activeBrushMode: BrushMode,
  dataAdapter: EelDataAdapter,
  showSideBySideView: boolean,
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  showDots: boolean,
  useDeltaHeatMap: boolean,
  stepsBeforePaddingGrows: number,
  includeDimensions: string[],
  selectedScenarioPreset: ScenarioPreset | null,
  onRendererChanged: (renderer: string) => void,
  onBrushModeChanged: (brushMode: string) => void,
  onBrushedPoints: (brushedPoints: any[]) => void,
  onBrushedRegion: (region: number[][]) => void,
  onNewPointsInSelection: (newPoints: any[], allPoints?: any[]) => void,
  onNewNonSteeredPointsInSelection: (newPoints: any[], allPoints?: any[]) => void
}
interface State {
}

const RENDERER_LABELS: Renderer[] = ["Scatter Plot", "Star Coordinates", "RadViz", "Ternary"];
const BRUSH_MODES: BrushMode[] = ["box", "lasso"];

export default class MainView extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      brushMode: "lasso"
    };
  }

  private renderDataRendererTabs() {
    return (
      <Alternatives
        id="renderer"
        title="Renderer"
        x={ 15 }
        y={ 0 }
        options={ RENDERER_LABELS }
        activeOption={ this.props.activeRenderer }
        onChange={ this.props.onRendererChanged }
      />
    );
  }

  private renderBrushModeSelection() {
    if (this.props.activeRenderer !== "Scatter Plot") {
      return;
    }

    return (
      <Alternatives
        id="brushmode"
        title="Brush"
        x={ 475 }
        y={ 0 }
        options={ BRUSH_MODES }
        icons={ ["crop_square", "gesture" ]}
        activeOption={ this.props.activeBrushMode }
        onChange={ this.props.onBrushModeChanged }
      />
    );
  }

  private renderDataRenderer(width: number, height: number) {
    const extents = this.props.dataAdapter.getDomains();

    if (this.props.activeRenderer === "RadViz") {
      return (
        <RadVizRenderer
          width={ width }
          height={ height }
          data={ this.props.dataAdapter.data }
          nonSteeringData={ this.props.dataAdapter.nonSteeringData }
          showNonSteeringData={ this.props.showSideBySideView }
          dimensions={ this.props.includeDimensions }
          extents={ extents }
          highlightLastChunk={ this.props.highlightLatestPoints }
          chunkSize={ this.props.dataAdapter.chunkSize }
          onBrushedPoints={ this.props.onBrushedPoints }
          onBrushedRegion={ this.props.onBrushedRegion }
          onNewPointsInSelection={ this.props.onNewPointsInSelection }
          onNewNonSteeredPointsInSelection={ this.props.onNewNonSteeredPointsInSelection }
        />
      );
    } else if (this.props.activeRenderer === "Star Coordinates") {
      return (
        <StarCoordinateRenderer
          width={ width }
          height={ height }
          data={ this.props.dataAdapter.data }
          nonSteeringData={ this.props.dataAdapter.nonSteeringData }
          showNonSteeringData={ this.props.showSideBySideView }
          dimensions={ this.props.includeDimensions }
          extents={ extents }
          highlightLastChunk={ this.props.highlightLatestPoints }
          chunkSize={ this.props.dataAdapter.chunkSize }
          onBrushedPoints={ this.props.onBrushedPoints }
          onBrushedRegion={ this.props.onBrushedRegion }
          onNewPointsInSelection={ this.props.onNewPointsInSelection }
          onNewNonSteeredPointsInSelection={ this.props.onNewNonSteeredPointsInSelection }
        />
      );
    } else if (this.props.activeRenderer === "Ternary") {
      return (
        <TernaryPlotRenderer
          height={ height }
          width={ width }
          data={ this.props.dataAdapter.data }
          nonSteeringData={ this.props.dataAdapter.nonSteeringData }
          showNonSteeringData={ this.props.showSideBySideView }
          dimensions={ this.props.includeDimensions }
          highlightLastChunk={ this.props.highlightLatestPoints }
          chunkSize={ this.props.dataAdapter.chunkSize }
          onBrushedPoints={ this.props.onBrushedPoints }
          onNewPointsInSelection={ this.props.onNewPointsInSelection }
        />
      );
    }

    return (
      <ScatterplotRenderer
        width={ width }
        height={ height }
        extents={ extents }
        dimensionX={ getXDimension() }
        dimensionY={ getYDimension() }
        data={ this.props.dataAdapter.data }
        nonSteeringData={ this.props.dataAdapter.nonSteeringData }
        chunkSize={ this.props.dataAdapter.chunkSize }
        trainingState={ this.props.dataAdapter.trainingState }
        highlightLastChunk={ this.props.highlightLatestPoints }
        showHeatMap={ this.props.showHeatMap }
        showDots={ this.props.showDots }
        useLassoSelection={ this.props.activeBrushMode === "lasso" }
        useDeltaHeatMap={ this.props.useDeltaHeatMap }
        showNonSteeringData={ this.props.showSideBySideView }
        presetSelection={ this.props.selectedScenarioPreset }
        stepsBeforePaddingGrows={ this.props.stepsBeforePaddingGrows }
        onBrushedPoints={ this.props.onBrushedPoints }
        onBrushedRegion={ this.props.onBrushedRegion }
        onNewPointsInSelection={ this.props.onNewPointsInSelection }
        onNewNonSteeredPointsInSelection={ this.props.onNewNonSteeredPointsInSelection }
      />
    );
  }

  private renderMapRenderer(width: number, height: number) {
    return (
      <MapViewRenderer
        width={ width * 0.45 }
        height={ height - 1 }
        pois={ getPOIs() }
        initialPOI={ null }
        onPOISelected={ (poi: POI) => this.props.dataAdapter.filterCategoricalDimension("city", poi.label) }
      />
    );
  }

  public render() {
    const width = window.innerWidth - 1;
    const height = window.innerHeight - 85;

    return (
      <div className="mainView" style={ {minHeight: height} }>
        { this.renderDataRenderer(width, height) }
        { this.renderDataRendererTabs() }
        { this.renderBrushModeSelection() }
        { this.renderMapRenderer(width, height) }
      </div>
    );
  }
}