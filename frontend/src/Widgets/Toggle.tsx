import * as React from 'react';
import "./Toggle.css";

interface Props {
  id: string,
  checked: boolean,
  label: string,
  disabled: boolean,
  onChange: () => void,
}
interface State {
}

export default class Toggle extends React.Component<Props, State> {
  public render() {
    const isChecked = this.props.checked ? "checked" : "";

    return (
      <div className={ `toggle ${isChecked}` }>
        <input
          type="checkbox"
          name={ this.props.id }
          id={ this.props.id }
          checked={ this.props.checked  }
          onChange={ this.props.onChange }/>
        <label htmlFor={ this.props.id }>{ this.props.label }</label>
      </div>
    );
  }
}