import * as React from 'react';
import "./ProgressBar.css";

interface Props {
  max: number,
  current: number,
  width: number,
  label: string
}
interface State {
}

export default class ProgressBar extends React.Component<Props, State> {
  public render() {
    const progress = Math.floor((this.props.current / this.props.max) * 1000) / 10;

    return (
      <div className="progressBarContainer" style={{ width: this.props.width }}>
        <div className="progressBarLabel">
          <span className="label">{ this.props.label }: </span>
          <span className="value">{ progress }%</span>
        </div>
        <div className="progressBar">
          <div className="progress" style={{ width: `${progress}%`}}>
          </div>
        </div>
      </div>
    );
  }
}