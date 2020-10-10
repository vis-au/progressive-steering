import * as React from 'react';

import { EelDataAdapter } from '../Data/DataAdapter';
import { ScenarioPreset } from '../Data/EelBridge';
import { Renderer } from '../Renderers/Renderers';
import Histogram from '../Widgets/Histogram';

import './Header.css';

interface Props {
  activeRenderer: Renderer,
  dataAdapter: EelDataAdapter,
  includeDimensions: string[],
  remainingDimensions: string[],
  selectedScenarioPreset: ScenarioPreset | null,
  onDimensionAdded: (event: React.ChangeEvent<HTMLSelectElement>) => void,
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
    return (
      <select
        className="dimension-selection"
        value={ "Select Dimension" }
        onChange={ this.props.onDimensionAdded }>
        <option value="Select Dimension" disabled={ true }>Include dimension</option>
        { this.props.remainingDimensions.map(this.renderDimensionOption.bind(this)) }
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
        onSelection={ (filter: [number, number]) => this.props.dataAdapter.filterNumericalDimension(dimension, filter) }
      />
    );
  }

  private renderDimensionHistograms() {
    const dims = this.props.activeRenderer === "Scatter Plot"
      ? this.props.includeDimensions.slice(0,4)
      : this.props.includeDimensions;

    return (
      <div className="dimension-histograms">
        { dims.map(this.renderDimensionHistogram.bind(this)) }
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
        { this.renderDimensionSelection() }
        { this.renderDimensionHistograms() }
        { this.renderScenarioPresets() }
      </div>
    );
  }
}