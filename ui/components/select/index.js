import React, { Component } from "react";
import "./select.scss";

export default class Select extends Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.onSelectChange = this.onSelectChange.bind(this);
  }

  onSelectChange(e) {
    const { onValueChange } = this.props;
    const { name, value } = e.target;
    onValueChange(name, value);
  }

  render() {
    const { label, options, name, value } = this.props;
    return (
      <div className="select-container">
        <span className="select-label">{label}</span>
        <select value={value} name={name} onChange={this.onSelectChange}>
          {Object.entries(options).map(([name, label]) => {
            return (
              <option key={name} value={name}>
                {label}
              </option>
            );
          })}
        </select>
      </div>
    );
  }
}
