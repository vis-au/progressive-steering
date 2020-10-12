import * as React from 'react';

import { EelDataAdapter, getPOIs } from '../Data/DataAdapter';
import { ScenarioPreset } from '../Data/EelBridge';
import RadVizRenderer from '../Renderers/RadVizRenderer';
import { Renderer } from '../Renderers/Renderers';
import ScatterplotRenderer from '../Renderers/ScatterplotRenderer';
import StarCoordinateRenderer from '../Renderers/StarCoordinateRenderer';
import MapViewRenderer, { POI } from '../Widgets/MapViewer';

import './MainView.css';

interface Props {
  activeRenderer: Renderer,
  dataAdapter: EelDataAdapter,
  showSideBySideView: boolean,
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  useDeltaHeatMap: boolean,
  stepsBeforePaddingGrows: number,
  includeDimensions: string[],
  selectedScenarioPreset: ScenarioPreset | null,
  onRendererChanged: (event: React.ChangeEvent<HTMLInputElement>) => void,
  onBrushedPoints: (brushedPoints: any[]) => void,
  onBrushedRegion: (region: number[][]) => void,
  onNewPointsInSelection: (newPoints: any[], allPoints?: any[]) => void,
  onNewNonSteeredPointsInSelection: (newPoints: any[], allPoints?: any[]) => void
}
interface State {
}

const RENDERER_LABELS: Renderer[] = ["Scatter Plot", "Star Coordinates", "RadViz"];

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

  private renderRendererTabs() {
    return (
      <div className="renderer-tabs">
        { RENDERER_LABELS.map(this.renderRendererTab.bind(this)) }
      </div>
    );
  }

  private renderRenderer() {
    const width = window.innerWidth - 1;
    const height = window.innerHeight - 85;
    const extents = new Map<string, [number, number]>();
    this.props.dataAdapter.dimensions.forEach(dim => {
      extents.set(dim, this.props.dataAdapter.getDomain(dim));
    });

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
    }

    const dimensionX = this.props.dataAdapter.xDimension;
    const dimensionY = this.props.dataAdapter.yDimension;

    return (
      <ScatterplotRenderer
        width={ width }
        height={ height }
        extents={ extents }
        dimensionX={ dimensionX }
        dimensionY={ dimensionY }
        data={ this.props.dataAdapter.data }
        nonSteeringData={ this.props.dataAdapter.nonSteeringData }
        chunkSize={ this.props.dataAdapter.chunkSize }
        trainingState={ this.props.dataAdapter.trainingState }
        highlightLastChunk={ this.props.highlightLatestPoints }
        showHeatMap={ this.props.showHeatMap }
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

  public render() {
    const width = window.innerWidth - 1;
    const height = window.innerHeight - 85;

    return (
      <div className="mainView" style={ {minHeight: height} }>
        { this.renderRenderer() }
        { this.renderRendererTabs() }
        <MapViewRenderer
          width={ width * 0.45 }
          height={ height - 1 }
          pois={ getPOIs() }
          initialPOI={ null }
          onPOISelected={ (poi: POI) => this.props.dataAdapter.filterCategoricalDimension("city", poi.label) }
        />
      </div>
    );
  }
}