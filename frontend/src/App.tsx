import React, { Component } from 'react';
import { eel, ScenarioPreset, ProgressionState } from './EelBridge';
import { getEelDataAdapter, EelDataAdapter, getPOIs } from './DataAdapter';
import ScatterplotRenderer from './ScatterplotRenderer';
import ProgressBar from './ProgressBar';
import MapViewerRenderer, { POI } from './MapViewer';
import DoubleSlider from './DoubleSlider';
import EvaluationMetric from './EvaluationMetric';
import { DEFAULT_EVALUATION_METRICS } from './EelBackendDummy';
import './App.css';

interface State {
  selectedPoints: any[],
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  showSideBySideView: boolean,
  selectedScenarioPreset: ScenarioPreset | null,
  stepsBeforePaddingGrows: number
}

const X_AXIS_SELECTOR = "x-dimension";
const Y_AXIS_SELECTOR = "y-dimension";
const STEPS_BEFORE_PADDING_GROWS = 1;

export class App extends Component<{}, State> {
  private dataAdapter: EelDataAdapter;

  constructor(props: {}) {
    super(props);

    // Test calling sayHelloJS, then call the corresponding Python function
    this.dataAdapter = getEelDataAdapter();
    this.dataAdapter.subscribeOnDataChanged(this.onNewDataReceived.bind(this));
    this.dataAdapter.subscribeOnFilterChanged(this.onFilterChanged.bind(this));
    this.dataAdapter.subscribeOnMetricChanged(this.onMetricChanged.bind(this));

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
      showHeatMap: true,
      showSideBySideView: true,
      selectedScenarioPreset: null,
      stepsBeforePaddingGrows: STEPS_BEFORE_PADDING_GROWS
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

  private onHighlightLatestPointChanged() {
    this.setState({ highlightLatestPoints: !this.state.highlightLatestPoints });
  }

  private onShowHeatMapChanged() {
    this.setState({ showHeatMap: !this.state.showHeatMap });
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

  private onDimensionForAxisSelected(axis: string, dimension: string) {
    if (axis === X_AXIS_SELECTOR) {
      this.dataAdapter.xDimension = dimension;
    } else if (axis === Y_AXIS_SELECTOR) {
      this.dataAdapter.yDimension = dimension;
    } else {
      return;
    }

    this.forceUpdate();
  }

  private onScenarioPresetSelected(event: React.ChangeEvent<HTMLSelectElement>) {
    const presetName = event.target.value;
    const preset = this.dataAdapter.scenarioPresets.find(preset => preset.name === presetName);

    this.setState({
      selectedScenarioPreset: preset || null
    });
  }

  private renderDimensionSelection(selector: string, label: string, activeValue: string) {
    const allDimensions = this.dataAdapter.dimensions;

    return (
      <div className={ `${selector} selection` }>
        <label htmlFor={ selector }>{ label }</label>
        <select name={ selector } id={ selector } value={ activeValue } onChange={ (e) =>
          this.onDimensionForAxisSelected(selector, e.target.value) }>{
          allDimensions.map(dim => <option key={dim} value={dim}>{dim}</option>)
        }</select>
      </div>
    );
  }

  private renderXYDimensionSelection() {
    return (
      <div className="dimension-selection">
        { this.renderDimensionSelection(X_AXIS_SELECTOR, "X Axis", this.dataAdapter.xDimension || "") }
        { this.renderDimensionSelection(Y_AXIS_SELECTOR, "Y Axis", this.dataAdapter.yDimension || "") }
      </div>
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
    return (
      <div className="dimension-sliders">
        { this.dataAdapter.dimensions.map(this.renderDimensionSlider.bind(this)) }
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
    const text = this.dataAdapter.progressionState === 'paused' ? 'RESTART' : 'PAUSE';
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
    if (this.dataAdapter.trainingState === "using tree") {
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

  public render() {
    const dimensionX = this.dataAdapter.xDimension;
    const dimensionY = this.dataAdapter.yDimension;

    const width = window.innerWidth - 1;
    const height = window.innerHeight - 85;

    return (
      <div className="App">
        <div className="header">
          { this.renderXYDimensionSelection() }
          { this.renderDimensionSliders() }
          { this.renderScenarioPresets() }
        </div>

        <div className="mainView" style={ {minHeight: height} }>
          <ScatterplotRenderer
            width={ width }
            height={ height }
            extentX={ this.dataAdapter.getDomain(dimensionX) }
            extentY={ this.dataAdapter.getDomain(dimensionY) }
            dimensionX={ dimensionX }
            dimensionY={ dimensionY }
            data={ this.dataAdapter.data }
            chunkSize={ this.dataAdapter.chunkSize }
            trainingState={ this.dataAdapter.trainingState }
            filters={ this.dataAdapter.getAllFilters() }
            highlightLastChunk={ this.state.highlightLatestPoints }
            showHeatMap={ this.state.showHeatMap }
            showNonSteeringData={ this.state.showSideBySideView }
            presetSelection={ this.state.selectedScenarioPreset }
            stepsBeforePaddingGrows={ this.state.stepsBeforePaddingGrows }
            onBrushedPoints={ this.onBrushedPoints.bind(this) }
            onBrushedRegion={ this.onBrushedRegion.bind(this) }
            onNewPointsInSelection={ this.onNewPointsInSelection.bind(this) }
          />
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
          { this.renderShowSideBySideViewToggle() }
          { this.renderPaddingStepsInput() }
          </div>

          <div className="right">
            <ProgressBar
              label="items processed"
              width={ 300 }
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
