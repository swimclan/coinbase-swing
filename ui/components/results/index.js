import React, { Component } from "react";
import "./results.scss";

import Result from "../result";
import TickerItem from "../ticker-item";

export default class Results extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const { gain, value } = this.props;
    return (
      <div className="results-container">
        <div className="results-metrics">
          <span className="results-data">
            <Result label="24H gain" type="percent" value={gain} />
          </span>
          <span className="results-data">
            <Result label="Account value" type="currency" value={value} />
          </span>
        </div>
        <div className="results-ticker">
          <TickerItem label="Market" value={0.00234} slope={3} />
          <TickerItem label="BTC-USD" value={0.032234} slope={1} />
          <TickerItem label="ETH-USD" value={-0.01234} slope={4} />
        </div>
      </div>
    );
  }
}
