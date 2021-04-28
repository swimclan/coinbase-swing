import classNames from "classnames";
import React, { Component } from "react";
import "./ticker-item.scss";

import { renderTrendIcon } from "../../global/utils";

export default class TickerItem extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  _renderValue(val) {
    return `${(parseFloat(val) * 100).toFixed(2)}%`;
  }

  _renderTrend(val) {
    return renderTrendIcon(val);
  }

  render() {
    const { label, value, slope } = this.props;
    const tickerItemValueClasses = classNames({
      ["ticker-item-value"]: true,
      ["red"]: value < 0,
      ["green"]: value >= 0,
    });

    const tickerItemTrendClasses = classNames({
      ["ticker-item-trend"]: true,
      ["red"]: slope < 3,
      ["orange"]: slope === 3,
      ["green"]: slope > 3,
    });

    return (
      <div className="ticker-item-container">
        <div className="ticker-item-label">{label}</div>
        <div className={tickerItemValueClasses}>{this._renderValue(value)}</div>
        <div className={tickerItemTrendClasses}>{this._renderTrend(slope)}</div>
      </div>
    );
  }
}
