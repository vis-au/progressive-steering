import * as React from 'react';

import { EelDataAdapter, getPOIs } from '../Data/DataAdapter';
import { getXDimension, getYDimension, ScenarioPreset } from '../Data/EelBridge';
import RadVizRenderer from '../Renderers/RadVizRenderer';
import { Renderer } from '../Renderers/Renderers';
import ScatterplotRenderer from '../Renderers/ScatterplotRenderer';
import StarCoordinateRenderer from '../Renderers/StarCoordinateRenderer';
import TernaryPlotRenderer from '../Renderers/TernaryPlotRenderer';
import MapViewRenderer, { POI } from '../Widgets/MapViewer';

import './MainView.css';

interface Props {
  activeRenderer: Renderer,
  dataAdapter: EelDataAdapter,
  showSideBySideView: boolean,
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  showDots: boolean,
  useDeltaHeatMap: boolean,
  stepsBeforePaddingGrows: number,
  includeDimensions: string[],
  selectedScenarioPreset: ScenarioPreset | null,
  useLassoSelection: boolean,
  onRendererChanged: (event: React.ChangeEvent<HTMLInputElement>) => void,
  onBrushedPoints: (brushedPoints: any[]) => void,
  onBrushedRegion: (region: number[][]) => void,
  onNewPointsInSelection: (newPoints: any[], allPoints?: any[]) => void,
  onNewNonSteeredPointsInSelection: (newPoints: any[], allPoints?: any[]) => void
}
interface State {
}

const RENDERER_LABELS: Renderer[] = ["Scatter Plot", "Star Coordinates", "RadViz", "Ternary"];

export default class MainView extends React.Component<Props, State> {

  private renderRendererTab(renderer: Renderer) {
    const isActive = this.props.activeRenderer === renderer ? "active" : "inactive";

    return (
      <div className={ `renderer-tab ${isActive}` } key={ renderer } title={ `use ${renderer} layout.` }>
        <input
          type="radio"
          id={ `renderer-${renderer}` }
          className="renderer-tab"
          radioGroup="renderer-tabs-123"
          onChange={ this.props.onRendererChanged }
          checked={ this.props.activeRenderer === renderer }
          value={ renderer }/>
        <label htmlFor={ `renderer-${renderer}` }>{ renderer }</label>
      </div>
    );
  }

  private renderDataRendererTabs() {
    return (
      <div className="renderer-tabs">
        <h2>View </h2>
        { RENDERER_LABELS.map(this.renderRendererTab.bind(this)) }
      </div>
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
        useLassoSelection={ this.props.useLassoSelection }
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
        { this.renderMapRenderer(width, height) }
      </div>
    );
  }
}