import * as React from 'react';

import "./Alternatives.css";

interface Props {
  id: string,
  x: number,
  y: number,
  title: string
  options: string[],
  icons?: string[],
  activeOption: string,
  onChange: (newActiveOption: string) => void
}
interface State {
}

export default class Alternatives extends React.Component<Props, State> {
  private getId() {
    return `${this.props.id}-options`;
  }

  private renderOption(option: string, icon?: string) {
    const name = this.getId();
    const active = option === this.props.activeOption ? "active" : "";

    return (
      <div className={ `option ${active}` } key={ option } title={ `activate ${option} as ${this.props.title}` }>
        <input type="radio" name={ name } id={ `${name}-${option}` } checked={ this.props.activeOption === option } value={ option } onChange={ () => this.props.onChange(option) }/>
        <label htmlFor={ `${name}-${option}` }>
          {
            !!icon ? <i className="icon material-icons">{ icon }</i> : null
          }
          <span>{ option }</span>
        </label>
      </div>
    );
  }

  public render() {
    const icons = this.props.icons || [];

    return (
      <div className="alternatives" style={{ left: this.props.x, top: this.props.y }}>
        <h2>{ this.props.title }</h2>
        { this.props.options.map((opt, i) => this.renderOption(opt, icons[i])) }
      </div>
    );
  }
}