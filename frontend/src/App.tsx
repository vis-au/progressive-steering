import React, { Component } from 'react';
import { eel, ScenarioPreset } from './EelBridge';
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
  selectedScenarioPreset: ScenarioPreset | null
}

const X_AXIS_SELECTOR = "x-dimension";
const Y_AXIS_SELECTOR = "y-dimension";

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
      selectedScenarioPreset: null
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

  private onNewPointsInSelection(points: any[]) {
    console.log(`found ${points.length} new points in current selection. Updating steering ...`);
    this.dataAdapter.selectItems(points);
  }

  private onHighlightLatestPointChanged() {
    this.setState({ highlightLatestPoints: !this.state.highlightLatestPoints });
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

    return (
      <DoubleSlider
        key={ dimension }
        label={ dimension }
        min={ extent[0] }
        max={ extent[1] }
        width={ 125 }
        // bins={ bins }
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
        value={ preset.name }
        selected={ preset === this.state.selectedScenarioPreset }>

        { preset.name }
      </option>
    );
  }

  private renderScenarioPresets() {
    return (
      <select name="scenario-presets" id="scenario-presets" onChange={ this.onScenarioPresetSelected.bind(this) } defaultValue={ "null" }>
        <option key="null">Select Scenario ...</option>
        { this.dataAdapter.scenarioPresets.map(this.renderScenarioPreset.bind(this)) }
      </select>
    );
  }

  private renderEvaluationMetrics() {
    return (
      <div className="metrics">
        <EvaluationMetric label={ "Points selected" } value={ this.state.selectedPoints.length } />
        <EvaluationMetric label={ "Points received" } value={ this.dataAdapter.data.length } />
        {
          DEFAULT_EVALUATION_METRICS.map(metric => {
            return (
              <EvaluationMetric
                key={ metric }
                label={metric}
                value={ this.dataAdapter.getEvaluationMetric(metric) }
              />
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

  public render() {
    const dimensionX = this.dataAdapter.xDimension;
    const dimensionY = this.dataAdapter.yDimension;

    const width = window.innerWidth - 1;
    const height = window.innerHeight - 100;

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
            filters={ this.dataAdapter.getAllFilters() }
            highlightLastChunk={ this.state.highlightLatestPoints }
            presetSelection={ this.state.selectedScenarioPreset }
            onBrushedPoints={ this.onBrushedPoints.bind(this) }
            onBrushedRegion={ this.onBrushedRegion.bind(this) }
            onNewPointsInSelection={ this.onNewPointsInSelection.bind(this) }
          />
          <MapViewerRenderer
            width={ width * 0.3 }
            height={ height }
            pois={ getPOIs() }
            initialPOI={ null }
            onPOISelected={ (poi: POI) => this.dataAdapter.filterCategoricalDimension("city", poi.label) }
          />
        </div>

        <div className="footer">
          <div className="left">
          { this.renderEvaluationMetrics() }
          { this.renderHighlightLatestPointsToggle() }
          </div>

          <ProgressBar
            label="items processed"
            width={ 300 }
            max={ this.dataAdapter.getTotalDataSize() }
            current={ this.dataAdapter.data.length }
          />
        </div>

      </div>
    );
  }
}

export default App;
