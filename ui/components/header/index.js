import { extend } from "lodash";
import React, { Component } from "react";
import "./header.scss";

export default class Header extends Component {
  constructor(props) {
    super(props);
    this.state = {};

    this.onClickRefresh = this.onClickRefresh.bind(this);
    this.onClickApply = this.onClickApply.bind(this);
  }

  onClickRefresh(e) {
    console.log("Refresh clicked");
  }

  onClickApply(e) {
    console.log("Apply clicked");
  }

  render() {
    return (
      <div className="header-container">
        <span className="header-title-area">
          <h2>Coinbase Swing</h2>
        </span>
        <span className="header-button-area">
          <button onClick={this.onClickRefresh}>&#x21bb; Refresh</button>
          <button onClick={this.onClickApply}>&#x2713; Apply</button>
        </span>
      </div>
    );
  }
}
