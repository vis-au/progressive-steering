import React, { Component } from 'react';
import { eel } from './EelBridge';
import { getEelDataAdapter, EelDataAdapter, getPOIs } from './DataAdapter';
import ScatterplotRenderer from './ScatterplotRenderer';
import ProgressBar from './ProgressBar';
import MapViewerRenderer from './MapViewer';
import DoubleSlider from './DoubleSlider';
import './App.css';

interface State {
  selectedPoints: any[]
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

    eel.say_hello_py('Javascript World!');

    this.state = {
      selectedPoints: []
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

  private onBrushedPoints(brushedPoints: any[]) {
    this.dataAdapter.selectItems(brushedPoints);

    this.setState({ selectedPoints: brushedPoints });
  }

  private onBrushedRegion(region: number[][]) {
    this.dataAdapter.selectRegion(region);
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
    const extent = this.dataAdapter.getExtent(dimension).slice();
    // const bins = this.dataAdapter.getHistogram(dimension);

    return (
      <DoubleSlider
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

  public render() {
    const dimensionX = this.dataAdapter.xDimension;
    const dimensionY = this.dataAdapter.yDimension;

    const width = window.innerWidth - 10;
    const height = window.innerHeight - 100;

    return (
      <div className="App">
        <div className="header">
          { this.renderXYDimensionSelection() }
          { this.renderDimensionSliders() }
        </div>

        <div className="mainView">
          <ScatterplotRenderer
            width={ width * 0.66 }
            height={ height }
            extentX={ this.dataAdapter.getExtent(dimensionX) }
            extentY={ this.dataAdapter.getExtent(dimensionY) }
            dimensionX={ dimensionX }
            dimensionY={ dimensionY }
            data={ this.dataAdapter.data }
            chunkSize={ this.dataAdapter.chunkSize }
            filters={ this.dataAdapter.getAllFilters() }
            onBrushedPoints={ this.onBrushedPoints.bind(this) }
            onBrushedRegion={ this.onBrushedRegion.bind(this) }
          />
          <MapViewerRenderer
            width={ width * 0.3 }
            height={ height }
            pois={ getPOIs() }
            initialPOI={ null }
            onPOISelected={ (poi: string) => this.dataAdapter.filterCategoricalDimension("city", poi) }
          />
        </div>

        <div className="footer">
          <div className="metrics">
            <div className="metric">{ this.state.selectedPoints.length } Points selected</div>
            <div className="metric">{ this.dataAdapter.data.length } Data points received</div>
          </div>
          <ProgressBar
            label="items processed"
            max={ this.dataAdapter.getTotalDataSize() }
            current={ this.dataAdapter.data.length }
          />
        </div>

      </div>
    );
  }
}

export default App;
