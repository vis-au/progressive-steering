import * as React from 'react';

import { EelDataAdapter } from '../Data/DataAdapter';
import { ProgressionState, TrainingState } from '../Data/EelBridge';
import EvaluationMetric from '../Widgets/EvaluationMetric';
import ProgressBar from '../Widgets/ProgressBar';
import { DEFAULT_EVALUATION_METRICS, EvaluationMetricType } from '../Data/EelBackendDummy';

import './Footer.css';
import Toggle from '../Widgets/Toggle';

interface Props {
  dataAdapter: EelDataAdapter,
  highlightLatestPoints: boolean,
  showHeatMap: boolean,
  showDots: boolean,
  useDeltaHeatMap: boolean,
  showSideBySideView: boolean,
  stepsBeforePaddingGrows: number,
  onProgressionStateChanged: (newState: ProgressionState) => void,
  onProgressionReset: () => void,
  onHighlightLatestPointChanged: () => void,
  onShowHeatMapChanged: () => void,
  onShowDotsChanged: () => void,
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

  private renderProgressionControlOverlay() {
    if (this.props.dataAdapter.progressionState !== "ready")  {
      return null;
    }

    return (
      <div className="control-overlay"
        onClick={ () => this.props.onProgressionStateChanged("running") }>
        <label>launch here</label>
        <i className="icon material-icons">keyboard_return</i>
      </div>
    )
  }

  private renderProgressionControls() {
    let text = "play_arrow";
    let nextState: ProgressionState = "running";

    if (this.props.dataAdapter.progressionState === "done") {
      text = "repeat";
      nextState = "ready";
    } else if (this.props.dataAdapter.progressionState === "paused") {
      text = "play_arrow";
      nextState = "running";
    } else if (this.props.dataAdapter.progressionState === "running") {
      text = "pause";
      nextState = "paused";
    }

    return (
      <div className="progression-controls">
        { this.renderProgressionControlOverlay() }
        <button className="control material-icons" title="play/pause progression" onClick={ () => this.props.onProgressionStateChanged(nextState) }>{ text }</button>
        <button className="control material-icons" title="reset progression" onClick={ () => this.props.onProgressionReset() }>refresh</button>
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
          // these metrics are set by the backend through eel, not by the frontend
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
      <Toggle
        id="highlight-latest-point-toggle"
        checked={ this.props.highlightLatestPoints }
        disabled={ false }
        label="highlight last chunk"
        icon="track_changes"
        onChange={ this.props.onHighlightLatestPointChanged }
      />
    );
  }

  private renderShowDotsToggle() {
    return (
      <Toggle
        id="show-dots-toggle"
        checked={ this.props.showDots }
        disabled={ false }
        label="dots"
        icon="grain"
        onChange={ this.props.onShowDotsChanged }
      />
    );
  }

  private renderShowHeatMapToggle() {
    return (
      <Toggle
        id="show-heatmap-toggle"
        checked={ this.props.showHeatMap }
        disabled={ false }
        label="heatmap"
        icon="grid_on"
        onChange={ this.props.onShowHeatMapChanged }
      />
    );
  }

  private renderUseDeltaHeatMapToggle() {
    return (
      <Toggle
        id="use-delta-heatmap-toggle"
        checked={ this.props.useDeltaHeatMap }
        disabled={ !this.props.showHeatMap }
        label="delta heatmap"
        icon="change_history"
        onChange={ this.props.onUseDeltaHeatMapChanged }
      />
    );
  }

  private renderShowSideBySideViewToggle() {
    return (
      <Toggle
        id="show-sidebyside-toggle"
        checked={ this.props.showSideBySideView }
        disabled={ false }
        label="show non-steered data"
        icon="compare_arrows"
        onChange={ this.props.onShowSideBySideViewChanged }
      />
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
    let trainingLabel = "non-steering";
    if (this.props.dataAdapter.trainingState === "usingTree") {
      trainingLabel = "steering";
    } else if (this.props.dataAdapter.trainingState === "collectingData") {
      trainingLabel = "activation";
    }

    return (
      <div className="training-state-indicator">
        <div className={ `indicator ${trainingLabel}` }></div>
        <div>{ trainingLabel }</div>
      </div>
    );
  }

  public render() {
    return (
      <div className="footer">
        <div className="left">
          { this.renderTrainingState() }
          { this.renderEvaluationMetrics() }
        </div>

        <div className="center">
          { this.renderHighlightLatestPointsToggle() }
          { this.renderShowDotsToggle() }
          { this.renderShowHeatMapToggle() }
          { this.renderUseDeltaHeatMapToggle() }
          { this.renderShowSideBySideViewToggle() }
          { this.renderPaddingStepsInput() }
        </div>

        <div className="right">
          <ProgressBar
            label="Progress"
            width={ 95 }
            max={ this.props.dataAdapter.getTotalDataSize() }
            current={ this.props.dataAdapter.data.length }
          />
          { this.renderProgressionControls() }
        </div>
      </div>
    );
  }
}