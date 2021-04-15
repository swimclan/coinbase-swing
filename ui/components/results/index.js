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
    const { gain, value, tickers } = this.props;
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
          {Object.entries(tickers).map(([key, [gain, slope]]) => {
            return (
              <TickerItem label={key} value={gain || 0} slope={slope || 3} />
            );
          })}
        </div>
      </div>
    );
  }
}
