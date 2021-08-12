import React, { Component } from 'react';

import { eel, ProgressionState, ScenarioPreset, subscribeToXYDimensions } from './Data/EelBridge';
import { getEelDataAdapter, EelDataAdapter } from './Data/DataAdapter';
import { Renderer } from './Renderers/Renderers';
import Header from './Layout/Header';
import MainView from './Layout/MainView';
import Footer from './Layout/Footer';
import { BrushMode } from './Renderers/BrushMode';

import './App.css';


const STEPS_BEFORE_PADDING_GROWS = 1;

interface State {
  progressionState: ProgressionState,
  selectedPoints: any[],
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  showDots: boolean,
  useDeltaHeatMap: boolean,
  showSideBySideView: boolean,
  selectedScenarioPreset: ScenarioPreset | null,
  stepsBeforePaddingGrows: number,
  activeRenderer: Renderer,
  activeBrushMode: BrushMode,
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

    subscribeToXYDimensions(this.onXYDimensionsChanged.bind(this));

    // Place des Vosges, VIS deadline
    const dummyData = {
      lat: 48.85565,
      lon: 2.365492,
      moneyRange: [60, 90],
      day: "2020-04-31",
      userMaxDistance: 10
    };

    eel.send_to_backend_userData(dummyData);

    this.state = {
      progressionState: "ready",
      selectedPoints: [],
      highlightLatestPoints: true,
      showHeatMap: true,
      showDots: true,
      useDeltaHeatMap: true,
      showSideBySideView: false,
      selectedScenarioPreset: null,
      stepsBeforePaddingGrows: STEPS_BEFORE_PADDING_GROWS,
      activeRenderer: "Scatter Plot",
      activeBrushMode: "box",
      includeDimensions: []
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

  private onXYDimensionsChanged(x: string|null, y: string|null) {
    if (x === null || y === null) {
      return;
    }

    const includeDimensions = this.state.includeDimensions;
    const xIndex = includeDimensions.indexOf(x);
    const yIndex = includeDimensions.indexOf(y);

    if (xIndex === -1) {
      includeDimensions.push(x);
    }
    if (yIndex === -1) {
      includeDimensions.push(y);
    }

    this.setState({ includeDimensions });
  }

  private onBrushedRegion(region: number[][]) {
    // no longer necessary to send the bounds of the region to the backend, since the backend is
    // oblivious to the shape of the selection. Keep this code in case we still need it somehow.
    // console.log(`user selected region from [${region[0]}] to [${region[1]}]. Updating steering ...`);
    // this.dataAdapter.selectRegion(region);
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

  private onRendererChanged(renderer: string) {
    const includeDimensions = this.state.includeDimensions;
    const remainingDimensions = this.dataAdapter.dimensions
      .filter(dim => includeDimensions.indexOf(dim) === -1);

    if (renderer === "RadViz" || renderer === "Star Coordinates") {

      if (includeDimensions.length === 2) {
        includeDimensions.push(...remainingDimensions.slice(0, 2));
      } else if (includeDimensions.length === 3) {
        includeDimensions.push(...remainingDimensions.slice(0, 1));
      }
    }

    this.setState({
      includeDimensions,
      activeRenderer: renderer as Renderer
    });
  }

  private onBrushModeChanged(brushMode: string) {
    this.setState({ activeBrushMode: brushMode as BrushMode });
  }

  private onProgressionReset() {
    this.onChangeProgressionState("ready");
    this.dataAdapter.reset();
  }

  private onChangeProgressionState(newState: ProgressionState) {
    this.dataAdapter.progressionState = newState;

    this.setState({
      progressionState: newState
    });
  }

  public render() {
    return (
      <div className="App">
        <Header
          dataAdapter={ this.dataAdapter }
          activeRenderer={ this.state.activeRenderer }
          includeDimensions={ this.state.includeDimensions }
          selectedScenarioPreset={ this.state.selectedScenarioPreset }
          onDimensionAdded={ this.onDimensionAdded.bind(this) }
          onDimensionRemoved={ this.onDimensionRemoved.bind(this) }
          onScenarioPresetSelected={ this.onScenarioPresetSelected.bind(this) }
        />

        <MainView
          dataAdapter={ this.dataAdapter }
          activeRenderer={ this.state.activeRenderer }
          activeBrushMode={ this.state.activeBrushMode }
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
          onBrushModeChanged={ this.onBrushModeChanged.bind(this) }
        />

        <Footer
          progressionState={ this.state.progressionState }
          dataAdapter={ this.dataAdapter }
          highlightLatestPoints={ this.state.highlightLatestPoints }
          showHeatMap={ this.state.showHeatMap }
          showDots={ this.state.showDots }
          showSideBySideView={ this.state.showSideBySideView }
          useDeltaHeatMap={ this.state.useDeltaHeatMap }
          stepsBeforePaddingGrows={ this.state.stepsBeforePaddingGrows }
          onProgressionReset={ this.onProgressionReset.bind(this) }
          onChangeProgressionState={ this.onChangeProgressionState.bind(this) }
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

  public componentDidMount() {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === " ") {
        if (this.state.progressionState === "running") {
          this.onChangeProgressionState("paused");
        } else if (this.state.progressionState === "paused") {
          this.onChangeProgressionState("running");
        } else if (this.state.progressionState === "ready") {
          this.onChangeProgressionState("running");
        }
      } else if (e.ctrlKey) {
        if (this.state.activeBrushMode === "lasso") {
          this.setState({ activeBrushMode: "box" });
        } else {
          this.setState({ activeBrushMode: "lasso" });
        }
      } else if (e.key === "Tab") {
        this.setState({ showSideBySideView: !this.state.showSideBySideView });
        e.preventDefault();
      } else if (e.key === "Backspace") {
        this.onProgressionReset();
        e.preventDefault();
      }
    });

    window.addEventListener("resize", () => {
      this.forceUpdate();
    });
  }

}

export default App;
