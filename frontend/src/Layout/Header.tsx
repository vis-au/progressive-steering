import * as React from 'react';

import { EelDataAdapter, getEelDataAdapter } from '../Data/DataAdapter';
import { ScenarioPreset } from '../Data/EelBridge';
import { Renderer } from '../Renderers/Renderers';
import Histogram from '../Widgets/Histogram';

import './Header.css';

interface Props {
  activeRenderer: Renderer,
  dataAdapter: EelDataAdapter,
  includeDimensions: string[],
  selectedScenarioPreset: ScenarioPreset | null,
  onDimensionAdded: (event: React.ChangeEvent<HTMLSelectElement>) => void,
  onDimensionRemoved: (dimension: string) => void,
  onScenarioPresetSelected: (event: React.ChangeEvent<HTMLSelectElement>) => void,
}
interface State {
}

export default class Header extends React.Component<Props, State> {

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
    const remainingDimensions = getEelDataAdapter().dimensions.filter(dim => {
      return this.props.includeDimensions.indexOf(dim) === -1;
    });

    return (
      <select
        className="dimension-selection"
        value={ "Select Dimension" }
        onChange={ this.props.onDimensionAdded }>
        <option value="Select Dimension" disabled={ true }>Add histogram ...</option>
        { remainingDimensions.map(this.renderDimensionOption.bind(this)) }
      </select>
    );
  }

  private renderDimensionHistogram(dimension: string) {
    const extent = this.props.dataAdapter.getDomain(dimension).slice();
    const bins = this.props.dataAdapter.getHistogram(dimension);
    const selectedBins = this.props.dataAdapter.getHistogram(dimension, true);

    return (
      <Histogram
        key={ dimension }
        label={ dimension }
        min={ extent[0] }
        max={ extent[1] }
        width={ 125 }
        bins={ bins }
        selectedBins={ selectedBins }
        onDelete={ () => this.props.onDimensionRemoved(dimension) }
        onBrush={ (filter: [number, number]) => this.props.dataAdapter.filterNumericalDimension(dimension, filter) }
      />
    );
  }

  private renderDimensionHistograms() {
    return (
      <div className="dimension-histograms">
        { this.props.includeDimensions.map(this.renderDimensionHistogram.bind(this)) }
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
    const value = this.props.selectedScenarioPreset === null
      ? ""
      : this.props.selectedScenarioPreset.name;

    return (
      <select
        name="scenario-presets"
        id="scenario-presets"
        onChange={ this.props.onScenarioPresetSelected }
        value={ value }>
        <option key="null">Select Scenario ...</option>

        { this.props.dataAdapter.scenarioPresets.map(this.renderScenarioPreset.bind(this)) }
      </select>
    );
  }

  public render() {
    return (
      <div className="header">
        <div className="left logo">
          <img src="./logo.svg" height="100%" alt="logo" />
        </div>
        <div className="center">
          { this.renderDimensionHistograms() }
        </div>
        <div className="right">
          { this.renderDimensionSelection() }
          { this.renderScenarioPresets() }
        </div>
      </div>
    );
  }
}