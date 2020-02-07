import * as React from 'react';
import "./EvaluationMetric.css";

interface Props {
  label: string,
  value: number
}
interface State {
}

export default class EvaluationMetric extends React.Component<Props, State> {
  public render() {
    return (
      <div className="evaluationMetric">
        <span className="label">{ this.props.label }:</span>
        <span className="value">{ this.props.value }</span>
      </div>
    );
  }
}