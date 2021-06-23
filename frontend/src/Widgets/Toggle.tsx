import * as React from 'react';
import "./Toggle.css";

interface Props {
  id: string,
  checked: boolean,
  label: string,
  disabled: boolean,
  icon?: string,
  onChange: () => void,
}
interface State {
}

export default class Toggle extends React.Component<Props, State> {
  private onChange() {
    if (!this.props.disabled) {
      this.props.onChange();
    }
  }
  public render() {
    const isChecked = this.props.checked ? "checked" : "";
    const isDisabled = this.props.disabled ? "disabled" : "";

    return (
      <div className={ `toggle ${isChecked} ${isDisabled}` }>
        <input
          type="checkbox"
          name={ this.props.id }
          id={ this.props.id }
          checked={ this.props.checked  }
          onChange={ () => this.onChange() }/>
        <label htmlFor={ this.props.id }>
          {
            this.props.icon
              ? <i className="icon material-icons">{ this.props.icon }</i>
              : ""
          }
          { this.props.label }
        </label>
      </div>
    );
  }
}