import React, { Component } from 'react';

import { eel, ScenarioPreset, ProgressionState } from './Data/EelBridge';
import { DEFAULT_EVALUATION_METRICS } from './Data/EelBackendDummy';
import { getEelDataAdapter, EelDataAdapter, getPOIs } from './Data/DataAdapter';
import ScatterplotRenderer from './Renderers/ScatterplotRenderer';
import StarCoordinateRenderer from './Renderers/StarCoordinateRenderer';
import ProgressBar from './Widgets/ProgressBar';
import MapViewerRenderer, { POI } from './Widgets/MapViewer';
import DoubleSlider from './Widgets/DoubleSlider';
import EvaluationMetric from './Widgets/EvaluationMetric';
import RadVizRenderer from './Renderers/RadVizRenderer';

import './App.css';


const STEPS_BEFORE_PADDING_GROWS = 1;

const DEFAULT_SELECTED_DIMENSIONS = ["Distance", "Saving opportunity"];
const DEFAULT_UNSELECTED_DIMENSIONS = ["cleaning_fee", "price", "accommodates"];
const DEFAULT_X_DIMENSION = "Saving opportunity";
const DEFAULT_Y_DIMENSION = "Distance";

type Renderer = "Scatter Plot" | "Star Coordinates" | "RadViz";
const RENDERER_LABELS: Renderer[] = ["Scatter Plot", "Star Coordinates", "RadViz"];


interface State {
  selectedPoints: any[],
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  useDeltaHeatMap: boolean,
  showSideBySideView: boolean,
  selectedScenarioPreset: ScenarioPreset | null,
  stepsBeforePaddingGrows: number,
  activeRenderer: Renderer,
  remainingDimensions: string[],
  includeDimensions: string[]
}

export class App extends Component<{}, State> {
  private dataAdapter: EelDataAdapter;

  constructor(props: {}) {
    super(props);

    // Test calling sayHelloJS, then call the corresponding Python function
    this.dataAdapter = getEelDataAdapter();
    this.dataAdapter.subscribeOnDataChanged(this.onNewDataReceived.bind(this));
    this.dataAdapter.subscribeOnFilterChanged(this.onFilterChanged.bind(this));
    this.dataAdapter.subscribeOnMetricChanged(this.onMetricChanged.bind(this));

    this.dataAdapter.xDimension = DEFAULT_X_DIMENSION;
    this.dataAdapter.yDimension = DEFAULT_Y_DIMENSION;

    // Place des Vosges, VIS deadline
    const dummyData = {
      'lat':48.85565,
      'lon':2.365492,
      'moneyRange': [30, 70],
      'day':"2020-04-31",
      "userMaxDistance":10
    };

    eel.send_to_backend_userData(dummyData);

    this.state = {
      selectedPoints: [],
      highlightLatestPoints: true,
      showHeatMap: false,
      useDeltaHeatMap: true,
      showSideBySideView: false,
      selectedScenarioPreset: null,
      stepsBeforePaddingGrows: STEPS_BEFORE_PADDING_GROWS,
      activeRenderer: "Scatter Plot",
      remainingDimensions: DEFAULT_UNSELECTED_DIMENSIONS,
      includeDimensions: DEFAULT_SELECTED_DIMENSIONS
    };
  }

  private onNewDataReceived() {
    console.log("received new data chunk. Updating ...");
    this.forceUpdate();
  }

  private onFilterChanged() {
    console.log("new filter was set. Updating ...");
    this.forceUpdate();
  }

  private onMetricChanged() {
    console.log("metric has changed. Updating ...");
    this.forceUpdate();
  }

  private onBrushedPoints(brushedPoints: any[]) {
    console.log(`user selected ${brushedPoints.length} points. Updating steering ...`);
    this.dataAdapter.selectItems(brushedPoints);

    this.setState({ selectedPoints: brushedPoints });
  }

  private onBrushedRegion(region: number[][]) {
    console.log(`user selected region from [${region[0]}] to [${region[1]}]. Updating steering ...`);
    this.dataAdapter.selectRegion(region);
  }

  private onNewPointsInSelection(newPoints: any[], allPoints?: any[]) {
    console.log(`found ${newPoints.length} new points in current selection. Updating steering ...`);
    this.dataAdapter.selectItems(newPoints);

    if (!!allPoints) {
      this.dataAdapter.updateAllSelectedItems(allPoints);
    }
  }

  private onNewNonSteeredPointsInSelection(newPoints: any[], allPoints?: any[]) {
    console.log(`found ${newPoints.length} new points in non-steered selection.`);

    if (!!allPoints) {
      this.dataAdapter.updateAllSelectedNonSteeredItems(allPoints);
    }
  }

  private onHighlightLatestPointChanged() {
    this.setState({ highlightLatestPoints: !this.state.highlightLatestPoints });
  }

  private onShowHeatMapChanged() {
    this.setState({ showHeatMap: !this.state.showHeatMap });
  }

  private onUseDeltaHeatMapChanged() {
    this.setState({ useDeltaHeatMap: !this.state.useDeltaHeatMap });
  }

  private onShowSideBySideViewChanged() {
    this.setState({ showSideBySideView: !this.state.showSideBySideView });
  }

  private onPaddingStepsChanged(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ stepsBeforePaddingGrows: +event.target.value });
  }

  private onProgressionStateChanged(newState: ProgressionState) {
    this.dataAdapter.progressionState = newState;
  }

  private onDimensionAdded(event: React.ChangeEvent<HTMLSelectElement>) {
    const includeDimensions = this.state.includeDimensions;
    includeDimensions.push(event.target.value);

    this.setState({ includeDimensions });
  }

  private onScenarioPresetSelected(event: React.ChangeEvent<HTMLSelectElement>) {
    const presetName = event.target.value;
    const preset = this.dataAdapter.scenarioPresets.find(preset => preset.name === presetName);

    this.setState({
      selectedScenarioPreset: preset || null
    });
  }

  private onRendererChanged(event: React.ChangeEvent<HTMLInputElement>) {
    const renderer = event.target.value as Renderer;
    this.setState({
      activeRenderer: renderer
    });
  }

  private updateDimensions() {
    const numberDimensions = this.state.includeDimensions.length + this.state.remainingDimensions.length;
    const hasReceivedData = this.dataAdapter.dimensions.length > 0;
    const hasUpdatedDimensions = numberDimensions === this.dataAdapter.dimensions.length;

    if (hasReceivedData && !hasUpdatedDimensions) {
      const oldIncludedDimensions = this.dataAdapter.dimensions
        .filter(d => this.state.includeDimensions.indexOf(d) > -1);

      const newDimensions = this.dataAdapter.dimensions
        .filter(d => this.state.includeDimensions.indexOf(d) === -1);

      this.dataAdapter.xDimension = DEFAULT_X_DIMENSION;
      this.dataAdapter.yDimension = DEFAULT_Y_DIMENSION;

      this.setState({
        includeDimensions: oldIncludedDimensions,
        remainingDimensions: newDimensions
      });
    }
  }

  private renderDimensionOption(dimension: string) {
    return (
      <option
        key={ dimension }
        className="dimension-option"
        value={ dimension }>

          { dimension }
      </option>
    );
  }

  private renderDimensionSelection() {
    return (
      <select
        className="dimension-selection"
        value={ "Select Dimension" }
        onChange={ this.onDimensionAdded.bind(this) }>
        <option value="Select Dimension" disabled={ true }>Include dimension</option>
        { this.state.remainingDimensions.map(this.renderDimensionOption.bind(this)) }
      </select>
    );
  }

  private renderDimensionSlider(dimension: string) {
    const extent = this.dataAdapter.getDomain(dimension).slice();
    const bins = this.dataAdapter.getHistogram(dimension);
    const selectedBins = this.dataAdapter.getHistogram(dimension, true);

    return (
      <DoubleSlider
        key={ dimension }
        label={ dimension }
        min={ extent[0] }
        max={ extent[1] }
        width={ 125 }
        bins={ bins }
        selectedBins={ selectedBins }
        onSelection={ (filter: [number, number]) => this.dataAdapter.filterNumericalDimension(dimension, filter) }
      />
    );
  }

  private renderDimensionSliders() {
    const dims = this.state.activeRenderer === "Scatter Plot"
      ? this.state.includeDimensions.slice(0,4)
      : this.state.includeDimensions;

    return (
      <div className="dimension-sliders">
        { dims.map(this.renderDimensionSlider.bind(this)) }
      </div>
    );
  }

  private renderScenarioPreset(preset: ScenarioPreset) {
    return (
      <option
        key={ preset.name }
        value={ preset.name }>

        { preset.name }
      </option>
    );
  }

  private renderScenarioPresets() {
    const value = this.state.selectedScenarioPreset === null
      ? ""
      : this.state.selectedScenarioPreset.name;

    return (
      <select
        name="scenario-presets"
        id="scenario-presets"
        onChange={ this.onScenarioPresetSelected.bind(this) }
        value={ value }>
        <option key="null">Select Scenario ...</option>

        { this.dataAdapter.scenarioPresets.map(this.renderScenarioPreset.bind(this)) }
      </select>
    );
  }

  private renderProgressionControls() {
    const text = this.dataAdapter.progressionState === 'paused' ? 'RESUME' : 'PAUSE';
    const onClickState: ProgressionState = this.dataAdapter.progressionState === 'paused' ? 'running' : 'paused';

    return (
      <div className="progression-controls">
          <button className="control" onClick={ () => this.onProgressionStateChanged(onClickState) }>{ text }</button>
      </div>
    );
  }

  private renderEvaluationMetrics() {
    return (
      <div className="metrics">
        <EvaluationMetric
          label={ "Points received" }
          values={ this.dataAdapter.cumulativeDataSize }
          trainingStates={ this.dataAdapter.trainingStateHistory } />
        {
          DEFAULT_EVALUATION_METRICS.map(metric => {
            const label = metric === "recall" ? "in selection" : metric;
            return (
              <EvaluationMetric
                key={ metric }
                label={ label }
                values={ this.dataAdapter.getEvaluationMetric(metric) }
                trainingStates={ this.dataAdapter.trainingStateHistory } />
            );
          })
        }
      </div>
    );
  }

  private renderHighlightLatestPointsToggle() {
    return (
      <div className="highlight-latest-point-toggle">
        <label htmlFor="highlight-latest-point-toggle">highlight last chunk</label>
        <input
          type="checkbox"
          name="highlight-latest-point-toggle"
          id="highlight-latest-point-toggle"
          checked={ this.state.highlightLatestPoints  }
          onChange={ this.onHighlightLatestPointChanged.bind(this) }/>
      </div>
    );
  }

  private renderShowHeatMapToggle() {
    return (
      <div className="show-heatmap-toggle">
        <label htmlFor="show-heatmap-toggle">show heatmap</label>
        <input
          type="checkbox"
          name="show-heatmap-toggle"
          id="show-heatmap-toggle"
          checked={ this.state.showHeatMap  }
          onChange={ this.onShowHeatMapChanged.bind(this) }/>
      </div>
    );
  }

  private renderUseDeltaHeatMapToggle() {
    return (
      <div className="use-delta-heatmap-toggle">
        <label htmlFor="use-delta-heatmap-toggle">delta heatmap</label>
        <input
          disabled={ !this.state.showHeatMap }
          type="checkbox"
          name="use-delta-heatmap-toggle"
          id="use-delta-heatmap-toggle"
          checked={ this.state.useDeltaHeatMap  }
          onChange={ this.onUseDeltaHeatMapChanged.bind(this) }/>
      </div>
    );
  }

  private renderShowSideBySideViewToggle() {
    return (
      <div className="show-sidebyside-toggle">
        <label htmlFor="show-sidebyside-toggle">show non-steered data</label>
        <input
          type="checkbox"
          name="show-sidebyside-toggle"
          id="show-sidebyside-toggle"
          checked={ this.state.showSideBySideView  }
          onChange={ this.onShowSideBySideViewChanged.bind(this) }/>
      </div>
    );
  }

  private renderPaddingStepsInput() {
    return (
      <div className="selection-padding-input">
        <label htmlFor="selection-padding-steps">Steps before padding: </label>
        <input id="selection-padding-steps" name="selection-padding-steps" type="number" value={ this.state.stepsBeforePaddingGrows } onChange={ this.onPaddingStepsChanged.bind(this) }/>
      </div>
    );
  }

  private renderTrainingState() {
    let trainingStateClass = "collecting";
    if (this.dataAdapter.trainingState === "usingTree") {
      trainingStateClass = "tree";
    } else if (this.dataAdapter.trainingState === "flushing") {
      trainingStateClass = "flushing";
    }

    return (
      <div className="training-state-indicator">
        <div className={ `indicator ${trainingStateClass}` }></div>
        <div>{ this.dataAdapter.trainingState }</div>
      </div>
    );
  }

  private renderRendererTab(renderer: Renderer) {
    const isActive = this.state.activeRenderer === renderer ? "active" : "inactive";

    return (
      <div className={ `renderer-tab ${isActive}` } key={ renderer } title={ `use ${renderer} layout.` }>
        <input
          type="radio"
          id={ `renderer-${renderer}` }
          className="renderer-tab"
          onChange={ this.onRendererChanged.bind(this)}
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

    if (this.state.activeRenderer === "RadViz") {
      return (
        <RadVizRenderer
          width={ width }
          height={ height }
          data={ this.dataAdapter.data }
          nonSteeringData={ this.dataAdapter.nonSteeringData }
          showNonSteeringData={ this.state.showSideBySideView }
          dimensions={ this.state.includeDimensions }
          extents={ [] }
          highlightLastChunk={ this.state.highlightLatestPoints }
          chunkSize={ this.dataAdapter.chunkSize }
          onBrushedPoints={ this.onBrushedPoints.bind(this) }
          onBrushedRegion={ this.onBrushedRegion.bind(this) }
        />
      );
    } else if (this.state.activeRenderer === "Star Coordinates") {
      const extents = this.state.includeDimensions.map(dim => {
        return this.dataAdapter.getDomain(dim);
      });

      return (
        <StarCoordinateRenderer
          width={ width }
          height={ height }
          data={ this.dataAdapter.data }
          nonSteeringData={ this.dataAdapter.nonSteeringData }
          showNonSteeringData={ this.state.showSideBySideView }
          dimensions={ this.state.includeDimensions }
          extents={ extents }
          highlightLastChunk={ this.state.highlightLatestPoints }
          chunkSize={ this.dataAdapter.chunkSize }
          onBrushedPoints={ this.onBrushedPoints.bind(this) }
          onBrushedRegion={ this.onBrushedRegion.bind(this) }
        />
      );
    }

    const dimensionX = this.dataAdapter.xDimension;
    const dimensionY = this.dataAdapter.yDimension;

    return (
      <ScatterplotRenderer
        width={ width }
        height={ height }
        extentX={ this.dataAdapter.getDomain(dimensionX) }
        extentY={ this.dataAdapter.getDomain(dimensionY) }
        dimensionX={ dimensionX }
        dimensionY={ dimensionY }
        data={ this.dataAdapter.data }
        nonSteeringData={ this.dataAdapter.nonSteeringData }
        chunkSize={ this.dataAdapter.chunkSize }
        trainingState={ this.dataAdapter.trainingState }
        highlightLastChunk={ this.state.highlightLatestPoints }
        showHeatMap={ this.state.showHeatMap }
        useDeltaHeatMap={ this.state.useDeltaHeatMap }
        showNonSteeringData={ this.state.showSideBySideView }
        presetSelection={ this.state.selectedScenarioPreset }
        stepsBeforePaddingGrows={ this.state.stepsBeforePaddingGrows }
        onBrushedPoints={ this.onBrushedPoints.bind(this) }
        onBrushedRegion={ this.onBrushedRegion.bind(this) }
        onNewPointsInSelection={ this.onNewPointsInSelection.bind(this) }
        onNewNonSteeredPointsInSelection={ this.onNewNonSteeredPointsInSelection.bind(this) }
      />
    );
  }

  public render() {
    const width = window.innerWidth - 1;
    const height = window.innerHeight - 85;

    this.updateDimensions();

    return (
      <div className="App">
        <div className="header">
          { this.renderDimensionSelection() }
          { this.renderDimensionSliders() }
          { this.renderScenarioPresets() }
        </div>

        <div className="mainView" style={ {minHeight: height} }>
          { this.renderRenderer() }
          { this.renderRendererTabs() }
          <MapViewerRenderer
            width={ width * 0.45 }
            height={ height - 1 }
            pois={ getPOIs() }
            initialPOI={ null }
            onPOISelected={ (poi: POI) => this.dataAdapter.filterCategoricalDimension("city", poi.label) }
          />
        </div>

        <div className="footer">
          <div className="left">
          { this.renderTrainingState() }
          { this.renderEvaluationMetrics() }
          { this.renderHighlightLatestPointsToggle() }
          { this.renderShowHeatMapToggle() }
          { this.renderUseDeltaHeatMapToggle() }
          { this.renderShowSideBySideViewToggle() }
          { this.renderPaddingStepsInput() }
          </div>

          <div className="right">
            <ProgressBar
              label="Progress"
              width={ 200 }
              max={ this.dataAdapter.getTotalDataSize() }
              current={ this.dataAdapter.data.length }
            />
            { this.renderProgressionControls() }
          </div>

        </div>

      </div>
    );
  }
}

export default App;
