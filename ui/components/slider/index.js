import React, { Component } from "react";
import "./slider.scss";

export default class Slider extends Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.onSliderChange = this.onSliderChange.bind(this);
  }

  _renderValue(value, factor, unit, sig) {
    const valNum = parseFloat(value);
    const factoredNum = valNum * factor;
    return `${factoredNum.toFixed(sig)} ${unit}`;
  }

  onSliderChange(e) {
    const { onValueChange } = this.props;
    const { name, value } = e.target;
    onValueChange(name, value);
  }

  render() {
    const {
      name,
      min,
      max,
      unit,
      factor,
      value,
      label,
      sig,
      step,
    } = this.props;
    return (
      <div className="slider-container">
        <span className="slider-label">{label}</span>
        <input
          type="range"
          name={name}
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={this.onSliderChange}
        />
        <span className="slider-value">{`${this._renderValue(
          value,
          factor,
          unit,
          sig
        )}`}</span>
      </div>
    );
  }
}
