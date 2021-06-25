import React, { Component } from 'react';

import { eel, ScenarioPreset, ProgressionState } from './Data/EelBridge';
import { getEelDataAdapter, EelDataAdapter } from './Data/DataAdapter';
import { Renderer } from './Renderers/Renderers';
import Header from './Layout/Header';
import MainView from './Layout/MainView';
import Footer from './Layout/Footer';

import './App.css';


const STEPS_BEFORE_PADDING_GROWS = 1;

const DEFAULT_SELECTED_DIMENSIONS = ["Distance", "Saving opportunity"];
const DEFAULT_UNSELECTED_DIMENSIONS = ["cleaning_fee", "price", "accommodates"];


interface State {
  selectedPoints: any[],
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  showDots: boolean,
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

    // Place des Vosges, VIS deadline
    const dummyData = {
      'lat': 48.85565,
      'lon': 2.365492,
      'moneyRange': [30, 70],
      'day': "2020-04-31",
      "userMaxDistance": 10
    };

    eel.send_to_backend_userData(dummyData);

    this.dataAdapter.dimensions.push(...DEFAULT_SELECTED_DIMENSIONS.concat(DEFAULT_UNSELECTED_DIMENSIONS));

    this.state = {
      selectedPoints: [],
      highlightLatestPoints: true,
      showHeatMap: false,
      showDots: true,
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

  private onShowDotsChanged() {
    this.setState({ showDots: !this.state.showDots });
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

  private onDimensionAdded(event: React.ChangeEvent<HTMLSelectElement>) {
    const includeDimensions = this.state.includeDimensions;
    includeDimensions.push(event.target.value);

    this.setState({ includeDimensions });
  }

  private onDimensionRemoved(dimension: string) {
    const includeDimensions = this.state.includeDimensions;
    const indexInDimensions = includeDimensions.indexOf(dimension);

    if (indexInDimensions === -1) {
      return;
    }

    includeDimensions.splice(indexInDimensions, 1);

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
    const includeDimensions = this.state.includeDimensions;
    const remainingDimensions = this.state.remainingDimensions;

    if (renderer === "RadViz" || renderer === "Star Coordinates") {

      if (includeDimensions.length === 2) {
        includeDimensions.push(...remainingDimensions.slice(0, 2));
      } else if (includeDimensions.length === 3) {
        includeDimensions.push(...remainingDimensions.slice(0, 1));
      }
    }

    this.setState({
      includeDimensions,
      remainingDimensions,
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

      this.setState({
        includeDimensions: oldIncludedDimensions,
        remainingDimensions: newDimensions
      });
    }
  }

  public render() {
    this.updateDimensions();

    return (
      <div className="App">
        <Header
          dataAdapter={ this.dataAdapter }
          activeRenderer={ this.state.activeRenderer }
          includeDimensions={ this.state.includeDimensions }
          remainingDimensions={ this.state.remainingDimensions }
          selectedScenarioPreset={ this.state.selectedScenarioPreset }
          onDimensionAdded={ this.onDimensionAdded.bind(this) }
          onDimensionRemoved={ this.onDimensionRemoved.bind(this) }
          onScenarioPresetSelected={ this.onScenarioPresetSelected.bind(this) }
        />

        <MainView
          dataAdapter={ this.dataAdapter }
          activeRenderer={ this.state.activeRenderer }
          highlightLatestPoints={ this.state.highlightLatestPoints }
          includeDimensions={ this.state.includeDimensions }
          selectedScenarioPreset={ this.state.selectedScenarioPreset }
          showHeatMap={ this.state.showHeatMap }
          showDots={ this.state.showDots }
          showSideBySideView={ this.state.showSideBySideView }
          stepsBeforePaddingGrows={ this.state.stepsBeforePaddingGrows }
          useDeltaHeatMap={ this.state.useDeltaHeatMap }
          onBrushedPoints={ this.onBrushedPoints.bind(this) }
          onBrushedRegion={ this.onBrushedRegion.bind(this) }
          onNewNonSteeredPointsInSelection={ this.onNewNonSteeredPointsInSelection.bind(this) }
          onNewPointsInSelection={ this.onNewPointsInSelection.bind(this) }
          onRendererChanged={ this.onRendererChanged.bind(this) }
        />

        <Footer
          dataAdapter={ this.dataAdapter }
          highlightLatestPoints={ this.state.highlightLatestPoints }
          showHeatMap={ this.state.showHeatMap }
          showDots={ this.state.showDots }
          showSideBySideView={ this.state.showSideBySideView }
          useDeltaHeatMap={ this.state.useDeltaHeatMap }
          stepsBeforePaddingGrows={ this.state.stepsBeforePaddingGrows }
          onHighlightLatestPointChanged={ this.onHighlightLatestPointChanged.bind(this) }
          onShowHeatMapChanged={ this.onShowHeatMapChanged.bind(this) }
          onShowDotsChanged={ this.onShowDotsChanged.bind(this) }
          onShowSideBySideViewChanged={ this.onShowSideBySideViewChanged.bind(this) }
          onUseDeltaHeatMapChanged={ this.onUseDeltaHeatMapChanged.bind(this) }
          onPaddingStepsChanged={ this.onPaddingStepsChanged.bind(this) }
        />

      </div>
    );
  }
}

export default App;
