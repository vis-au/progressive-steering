import React, { Component } from 'react';
import { eel, sayHelloJS } from './EelBridge';
import { getEelDataAdapter, EelDataAdapter } from './DataAdapter';
import ScatterplotRenderer from './ScatterplotRenderer';
import ProgressBar from './ProgressBar';
import MapViewerRenderer from './MapViewer';
import DoubleSlider from './DoubleSlider';
import './App.css';

interface State {
  selectedPoints: any[]
}

export class App extends Component<{}, State> {
  private dataManager: EelDataAdapter;

  constructor(props: {}) {
    super(props);

    // Test calling sayHelloJS, then call the corresponding Python function
    sayHelloJS( 'Javascript World!' );
    this.dataManager = getEelDataAdapter();
    this.dataManager.registerOnDataChanged(this.onNewDataReceived.bind(this));

    eel.say_hello_py('Javascript World!');

    this.state = {
      selectedPoints: []
    };
  }

  private onNewDataReceived() {
    console.log("received new data chunk. Updating ...");
    this.forceUpdate();
  }

  onBrushedPoints(brushedPoints: any[]) {
    this.setState({ selectedPoints: brushedPoints });
  }

  private renderDimensionSelection(selector: string, label: string) {
    const allDimensions = this.dataManager.dimensions;

    return (
      <div className={ `${selector} selection` }>
        <label htmlFor={ selector }>{ label }</label>
        <select name={ selector } id={ selector }>{
          allDimensions.map(dim => <option key={dim} value={dim}>{dim}</option>)
        }</select>
      </div>
    );
  }

  private renderXYDimensionSelection() {
    return (
      <div className="dimension-selection">
        { this.renderDimensionSelection("x-dimension", "X Axis") }
        { this.renderDimensionSelection("y-dimension", "Y Axis") }
      </div>
    );
  }

  private renderDimensionSlider(dimension: string) {
    const extent = this.dataManager.getExtent(dimension);

    return (
      <DoubleSlider
        label={ dimension }
        min={ extent[0] }
        max={ extent[1] }
        width={ 125 }
        onSelection={ (filter: number[]) => this.dataManager.filterDimension(dimension, filter) }
      />
    );
  }

  private renderDimensionSliders() {
    return (
      <div className="dimension-sliders">
        { this.dataManager.dimensions.map(this.renderDimensionSlider.bind(this)) }
      </div>
    );
  }

  public render() {
    const dimensionX = this.dataManager.xDimension;
    const dimensionY = this.dataManager.yDimension;

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
            width={ width * 0.5 }
            height={ height }
            extentX={ this.dataManager.getExtent(dimensionX) }
            extentY={ this.dataManager.getExtent(dimensionY) }
            dimensionX={ dimensionX }
            dimensionY={ dimensionY }
            data={ this.dataManager.data }
            onBrushedPoints={ this.onBrushedPoints.bind(this) }
          />
          <MapViewerRenderer
            width={ width * 0.45 }
            height={ height }
          />
        </div>

        <div className="footer">
          <div className="metrics">
            <div className="metric">{ this.state.selectedPoints.length } Points selected</div>
            <div className="metric">{ this.dataManager.data.length } Data points received</div>
          </div>
          <ProgressBar
            label="items processed"
            max={ this.dataManager.getTotalDataSize() }
            current={ this.dataManager.data.length }
          />
        </div>

      </div>
    );
  }
}

export default App;
