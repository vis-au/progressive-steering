import * as React from 'react';
import "./ProgressBar.css";

interface Props {
  max: number,
  current: number,
  label: string
}
interface State {
}

export default class ProgressBar extends React.Component<Props, State> {
  public render() {
    const progress = Math.floor((this.props.current / this.props.max) * 1000) / 10;

    return (
      <div className="progressBarContainer">
        <div className="progressBarLabel">
          <div className="label">{ this.props.label }:</div>
          <div className="value">{ progress }%</div>
        </div>
        <div className="progressBar">
          <div className="progress" style={{ width: `${progress}%`}}>
          </div>
        </div>
      </div>
    );
  }
}