import React, { Component } from "react";
import classNames from "classnames";
import "./result.scss";

export default class Result extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  _renderValue(val, type) {
    let ret = val;
    switch (type) {
      case "percent":
        ret = `${(parseFloat(val) * 100).toFixed(2)}%`;
        break;
      case "integer":
        ret = parseInt(val).toString();
        break;
      case "float":
        ret = parseFloat(val).toFixed(2);
        break;
      case "currency":
        ret = `$${parseFloat(val).toFixed(2)}`;
        break;
      default:
        ret = val;
    }
    return ret;
  }

  render() {
    const { label, value, type } = this.props;
    const valueClasses = classNames({
      ["result-value"]: true,
      ["green"]: value >= 0,
      ["red"]: value < 0,
    });
    return (
      <div className="result-container">
        <div className="result-heading">{label}</div>
        <div className={valueClasses}>{this._renderValue(value, type)}</div>
      </div>
    );
  }
}
