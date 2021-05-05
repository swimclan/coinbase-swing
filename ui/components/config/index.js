import React, { Component } from "react";
import classNames from "classnames";
import "./config.scss";

import Slider from "../slider";
import Select from "../select";

import { renderTrendIcon } from "../../global/utils";

/*
    wakeTime,
    fraction,
    margin,
    stopMargin,
    walkAway,
    strategy,
    isTesting,
    maxVwap,
    minSlope,
    maxOrders,
    maxVolatility,
    minLoss,
    maxRSI,
    minRelVol,
*/

export default class Config extends Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.onClickPowerButton = this.onClickPowerButton.bind(this);
  }

  onClickPowerButton() {
    const { config, onValueChange } = this.props;
    onValueChange("isTesting", !config.isTesting);
  }

  render() {
    const { onValueChange, onWalkChanged, config, frozen } = this.props;
    const powerButtonClasses = classNames({
      ["testing-button"]: true,
      ["red"]: !config.isTesting,
    });

    const walkButtonClasses = classNames({
      ["walk-button"]: true,
      ["active"]: frozen,
    });
    return (
      <div className="config-container">
        <header className="config-header">
          <h3>Trading parameters</h3>
        </header>
        <section className="config-body">
          <Select
            label="Strategy"
            name="strategy"
            value={config.strategy}
            options={{
              compositeScore: "VWAP/slope composite",
              vwap: "VWAP",
              slope: "Slope",
              change: "24hr change",
              volatility: "High volatility",
              relativeVolume: "Relative volume",
            }}
            onValueChange={onValueChange}
          />
          <Slider
            name="wakeTime"
            min={2}
            max={60}
            step={1}
            sig={0}
            factor={1}
            unit="m"
            value={config.wakeTime}
            label="Wake time"
            onValueChange={onValueChange}
          />
          <Slider
            name="maxRank"
            min={10}
            max={1000}
            step={10}
            sig={0}
            factor={1}
            unit=""
            value={config.maxRank}
            label="Lowest rank"
            onValueChange={onValueChange}
          />
          <Slider
            name="maxRounds"
            min={0}
            max={100}
            step={1}
            sig={0}
            factor={1}
            unit=""
            value={config.maxRounds}
            label="Max rounds"
            onValueChange={onValueChange}
          />
          <Slider
            name="minMarketSlopeCategory"
            min={1}
            max={5}
            step={1}
            sig={0}
            factor={1}
            unit=""
            value={config.minMarketSlopeCategory}
            label="Min market"
            onValueChange={onValueChange}
            valueRenderer={renderTrendIcon}
          />
          <Slider
            name="maxOrders"
            min={1}
            max={10}
            step={1}
            sig={0}
            factor={1}
            unit="orders"
            value={config.maxOrders}
            label="Max orders"
            onValueChange={onValueChange}
          />
          <Slider
            name="fraction"
            min={0.1}
            max={0.9}
            step={0.05}
            sig={0}
            factor={100}
            unit="%"
            value={config.fraction}
            label="Acct fraction"
            onValueChange={onValueChange}
          />
          <Slider
            name="margin"
            min={0.005}
            max={0.1}
            step={0.005}
            sig={1}
            factor={100}
            unit="%"
            value={config.margin}
            label="Profit margin"
            onValueChange={onValueChange}
          />
          <Slider
            name="stopMargin"
            min={0.005}
            max={0.1}
            step={0.005}
            sig={1}
            factor={100}
            unit="%"
            value={config.stopMargin}
            label="Stop loss"
            onValueChange={onValueChange}
          />
          <Slider
            name="walkAway"
            min={0.005}
            max={0.1}
            step={0.005}
            sig={1}
            factor={100}
            unit="%"
            value={config.walkAway}
            label="Walk away"
            onValueChange={onValueChange}
          />
          <Slider
            name="maxRSI"
            min={2}
            max={70}
            step={1}
            sig={0}
            factor={1}
            unit=""
            value={config.maxRSI}
            label="RSI"
            onValueChange={onValueChange}
          />
          {config.strategy === "relativeVolume" && (
            <Slider
              name="minRelVol"
              min={1}
              max={50}
              step={1}
              sig={0}
              factor={1}
              unit="x"
              value={config.minRelVol}
              label="Min rel volume"
              onValueChange={onValueChange}
            />
          )}
          {config.strategy === "change" && (
            <Slider
              name="minLoss"
              min={-0.5}
              max={-0.01}
              step={0.01}
              sig={0}
              factor={100}
              unit="%"
              value={config.minLoss}
              label="Min loss"
              onValueChange={onValueChange}
            />
          )}
          {config.strategy === "volatility" && (
            <Slider
              name="maxVolatility"
              min={0.001}
              max={0.05}
              step={0.001}
              sig={1}
              factor={100}
              unit="%"
              value={config.maxVolatility}
              label="Max volatility"
              onValueChange={onValueChange}
            />
          )}
          {(config.strategy === "vwap" ||
            config.strategy === "compositeScore") && (
            <Slider
              name="maxVwap"
              min={-0.05}
              max={-0.0001}
              step={0.0005}
              sig={2}
              factor={100}
              unit="%"
              value={config.maxVwap}
              label="Max VWAP"
              onValueChange={onValueChange}
            />
          )}
          {(config.strategy === "slope" ||
            config.strategy === "compositeScore") && (
            <Slider
              name="minSlope"
              min={-0.001}
              max={0.001}
              step={0.00005}
              sig={3}
              factor={100}
              unit="%"
              value={config.minSlope}
              label="Min slope"
              onValueChange={onValueChange}
            />
          )}
          <button
            onClick={this.onClickPowerButton}
            className={powerButtonClasses}
          >
            {config.isTesting ? "Off" : "On"}
          </button>
          <button onClick={onWalkChanged} className={walkButtonClasses}>
            {frozen ? "Resume" : "Walk"}
          </button>
        </section>
      </div>
    );
  }
}
