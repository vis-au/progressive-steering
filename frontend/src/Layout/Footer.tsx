import * as React from 'react';

import { EelDataAdapter } from '../Data/DataAdapter';
import { ProgressionState } from '../Data/EelBridge';
import EvaluationMetric from '../Widgets/EvaluationMetric';
import ProgressBar from '../Widgets/ProgressBar';
import { DEFAULT_EVALUATION_METRICS, EvaluationMetricType } from '../Data/EelBackendDummy';

import './Footer.css';

interface Props {
  dataAdapter: EelDataAdapter,
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  useDeltaHeatMap: boolean,
  showSideBySideView: boolean,
  stepsBeforePaddingGrows: number,
  onProgressionStateChanged: (newState: ProgressionState) => void,
  onHighlightLatestPointChanged: () => void,
  onShowHeatMapChanged: () => void,
  onUseDeltaHeatMapChanged: () => void,
  onShowSideBySideViewChanged: () => void,
  onPaddingStepsChanged: (event: React.ChangeEvent<HTMLInputElement>) => void,
}
interface State {
  visibleEvaluationMetric: EvaluationMetricType | null
}

export default class Footer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      visibleEvaluationMetric: null
    };
  }

  private onMetricClicked(metric: EvaluationMetricType) {
    if (this.state.visibleEvaluationMetric === metric) {
      this.setState({
        visibleEvaluationMetric: null
      });
    } else {
      this.setState({
        visibleEvaluationMetric: metric
      });
    }
  }

  private renderProgressionControls() {
    const text = this.props.dataAdapter.progressionState === 'paused' ? 'RESUME' : 'PAUSE';
    const onClickState: ProgressionState = this.props.dataAdapter.progressionState === 'paused' ? 'running' : 'paused';

    return (
      <div className="progression-controls">
          <button className="control" onClick={ () => this.props.onProgressionStateChanged(onClickState) }>{ text }</button>
      </div>
    );
  }

  private renderEvaluationMetrics() {
    return (
      <div className="metrics">
        <EvaluationMetric
          canvasVisible={ this.state.visibleEvaluationMetric === "Points received"}
          label={ "Points received" }
          values={ this.props.dataAdapter.cumulativeDataSize }
          trainingStates={ this.props.dataAdapter.trainingStateHistory }
          onClick={ () => this.onMetricClicked("Points received") } />
        {
          DEFAULT_EVALUATION_METRICS.map(metric => {
            const label = metric === "recall" ? "in selection" : metric;
            return (
              <EvaluationMetric
                canvasVisible={ this.state.visibleEvaluationMetric === metric }
                key={ metric }
                label={ label }
                values={ this.props.dataAdapter.getEvaluationMetric(metric) }
                trainingStates={ this.props.dataAdapter.trainingStateHistory }
                onClick={ () => this.onMetricClicked(metric) }/>
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
          checked={ this.props.highlightLatestPoints }
          onChange={ this.props.onHighlightLatestPointChanged }/>
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
          checked={ this.props.showHeatMap  }
          onChange={ this.props.onShowHeatMapChanged }/>
      </div>
    );
  }

  private renderUseDeltaHeatMapToggle() {
    return (
      <div className="use-delta-heatmap-toggle">
        <label htmlFor="use-delta-heatmap-toggle">delta heatmap</label>
        <input
          disabled={ !this.props.showHeatMap }
          type="checkbox"
          name="use-delta-heatmap-toggle"
          id="use-delta-heatmap-toggle"
          checked={ this.props.useDeltaHeatMap  }
          onChange={ this.props.onUseDeltaHeatMapChanged }/>
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
          checked={ this.props.showSideBySideView  }
          onChange={ this.props.onShowSideBySideViewChanged }/>
      </div>
    );
  }

  private renderPaddingStepsInput() {
    return (
      <div className="selection-padding-input">
        <label htmlFor="selection-padding-steps">Steps before padding: </label>
        <input id="selection-padding-steps" name="selection-padding-steps" type="number" value={ this.props.stepsBeforePaddingGrows } onChange={ this.props.onPaddingStepsChanged }/>
      </div>
    );
  }

  private renderTrainingState() {
    let trainingStateClass = "collecting";
    if (this.props.dataAdapter.trainingState === "usingTree") {
      trainingStateClass = "tree";
    } else if (this.props.dataAdapter.trainingState === "flushing") {
      trainingStateClass = "flushing";
    }

    return (
      <div className="training-state-indicator">
        <div className={ `indicator ${trainingStateClass}` }></div>
        <div>{ this.props.dataAdapter.trainingState }</div>
      </div>
    );
  }

  public render() {
    return (
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
            width={ 210 }
            max={ this.props.dataAdapter.getTotalDataSize() }
            current={ this.props.dataAdapter.data.length }
          />
          { this.renderProgressionControls() }
        </div>
      </div>
    );
  }
}